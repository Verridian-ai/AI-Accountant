import { db, statements, transactions, userSettings, pendingCategorization } from '../schema.js';
import { aiService } from './ai.js';
import { ragService } from './rag.js';
import { accountService } from './accounts.js';
import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import crypto from 'crypto';
import { events } from '../events.js';
import pdfParse from 'pdf-parse';
import { PdfParsingError, AiParseError } from '../errors.js';
import { logger } from '../utils/logger.js';

async function withRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000,
    operationName: string = "Operation"
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            logger.warn(`[${operationName}] Attempt ${i + 1} failed.`, error);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
            }
        }
    }
    throw lastError;
}

export interface AccountDetectionResult {
    accountId: string | null;
    isNewAccount: boolean;
    needsSetup: boolean;
    detectedInfo: {
        accountNumber: string | null;
        accountNumberMasked: string | null;
        bankName: string | null;
        accountType: string | null;
        openingBalance: number | null;
        closingBalance: number | null;
    };
}

export class PipelineService {

    async processStatement(statementId: string, filePath: string) {
        try {
            logger.info(`[Pipeline] Starting processing for ${statementId}`);

            // Fetch statement to get userId
            const stmt = await db.select().from(statements).where(eq(statements.id, statementId)).get();
            const userId = stmt?.userId ?? undefined;

            // Fetch user settings for models
            let settings = userId ? await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get() : null;
            if (!settings && userId) {
                settings = {
                    userId,
                    modelParsingText: 'google/gemini-3-flash-preview',
                    modelParsingVision: 'google/gemini-3-flash-preview',
                    modelCategorization: 'google/gemini-3-flash-preview',
                    modelChat: 'google/gemini-3-flash-preview',
                    modelEmbedding: 'openai/text-embedding-3-large',
                };
                await db.insert(userSettings).values(settings);
            }

            // Update status to PROCESSING
            await db.update(statements)
                .set({ parsingStatus: 'PROCESSING' })
                .where(eq(statements.id, statementId));
            events.emit('update', { type: 'statement_updated', id: statementId, status: 'PROCESSING', userId });

            // 1. Read and parse PDF text content
            logger.info(`[Pipeline] Extracting text from PDF: ${filePath}`);
            let pdfText = '';
            try {
                pdfText = await withRetry(async () => {
                    const pdfBuffer = await readFile(filePath);
                    const pdfData = await pdfParse(pdfBuffer);
                    const text = pdfData.text;
                    if (!text || text.trim().length < 50) {
                        throw new PdfParsingError("PDF contained very little readable text. It might be a scanned image without OCR, or a password-protected file.");
                    }
                    return text;
                }, 3, 1000, "PDF Extraction");

            } catch (pdfErr: any) {
                logger.error("[Pipeline PDF Error]", pdfErr, { filePath });
                await db.update(statements)
                    .set({
                        parsingStatus: 'FAILED',
                        errorType: 'PDF_READ_ERROR',
                        errorMessage: pdfErr.message || "Failed to read PDF content.",
                        errorDetails: JSON.stringify({ filename: stmt?.filename, originalError: pdfErr.message })
                    })
                    .where(eq(statements.id, statementId));
                events.emit('update', { type: 'statement_updated', id: statementId, status: 'FAILED', userId });
                return;
            }

            logger.info(`[Pipeline] Extracted ${pdfText.length} characters from PDF`);

            // 2. Extract account information from the statement
            logger.info(`[Pipeline] Extracting account information...`);
            const accountDetection: AccountDetectionResult = {
                accountId: null,
                isNewAccount: false,
                needsSetup: false,
                detectedInfo: {
                    accountNumber: null,
                    accountNumberMasked: null,
                    bankName: null,
                    accountType: null,
                    openingBalance: null,
                    closingBalance: null,
                }
            };

            try {
                const accountInfo = await withRetry(() => aiService.extractAccountInfo(pdfText, settings?.modelParsingText), 2, 1000, "Account Info Extraction");
                accountDetection.detectedInfo = {
                    accountNumber: accountInfo.accountNumber,
                    accountNumberMasked: accountInfo.accountNumberMasked,
                    bankName: accountInfo.bankName,
                    accountType: accountInfo.accountType,
                    openingBalance: accountInfo.openingBalance,
                    closingBalance: accountInfo.closingBalance,
                };

                // Check if this account already exists
                if (accountInfo.accountNumber && userId) {
                    const accountHash = accountService.hashAccountNumber(accountInfo.accountNumber);
                    const existingAccount = await accountService.findAccountByHash(userId, accountHash);

                    if (existingAccount) {
                        accountDetection.accountId = existingAccount.id;
                        accountDetection.isNewAccount = false;
                        logger.info(`[Pipeline] Found existing account: ${existingAccount.accountName}`);

                        // Update account balance if we have closing balance
                        if (accountInfo.closingBalance !== null) {
                            await accountService.updateAccountBalance(existingAccount.id, accountInfo.closingBalance);
                        }
                    } else {
                        accountDetection.isNewAccount = true;
                        accountDetection.needsSetup = true;
                        logger.info(`[Pipeline] New account detected, needs setup`);

                        // Emit event for frontend to show account setup wizard
                        events.emit('update', {
                            type: 'account_setup_needed',
                            statementId,
                            userId,
                            detectedInfo: accountDetection.detectedInfo
                        });
                    }
                }
            } catch (accErr) {
                logger.warn("[Pipeline Account Detection Error] Continuing without account info", accErr);
                // Continue processing even if account detection fails
            }

            // 3. Use AI to parse the text content into structured transactions
            logger.info(`[Pipeline] Sending to AI for parsing...`);
            let rawData;
            try {
                rawData = await withRetry(async () => {
                    const result = await aiService.parseStatementText(pdfText, settings?.modelParsingText);
                    if (!result || !result.transactions) {
                        throw new AiParseError("AI failed to return any transaction data from the text.");
                    }
                    return result;
                }, 3, 2000, "AI Transaction Parsing");

            } catch (aiErr: any) {
                logger.error("[Pipeline AI Error]", aiErr);
                await db.update(statements)
                    .set({
                        parsingStatus: 'FAILED',
                        errorType: 'AI_PARSE_ERROR',
                        errorMessage: "The AI was unable to find transactions in this document. Ensure it is a valid CBA bank statement.",
                        errorDetails: JSON.stringify({ rawError: aiErr.message })
                    })
                    .where(eq(statements.id, statementId));
                events.emit('update', { type: 'statement_updated', id: statementId, status: 'FAILED', userId });
                return;
            }

            // 4. Save Transactions with intelligent categorization
            if (rawData.transactions.length > 0) {
                logger.info(`[Pipeline] Extracted ${rawData.transactions.length} transactions. Categorizing with memory...`);

                // Get merchant memory for intelligent categorization
                const merchantMemoryData = userId ? await accountService.getMerchantMemory(userId) : [];
                const memoryPatterns = merchantMemoryData.map(m => ({
                    pattern: m.merchantPattern,
                    category: m.category,
                    gst: m.gstApplicable ?? false
                }));

                // Batch Categorize with memory
                let categorizations: Array<{
                    category: string;
                    gst: boolean;
                    notes: string;
                    confidence: number;
                    merchantNormalized: string;
                    needsReview: boolean;
                }> = [];

                try {
                    categorizations = await aiService.categorizeWithMemory(
                        rawData.transactions.map(tx => ({
                            description: tx.description,
                            amount_cents: tx.amount_cents
                        })),
                        memoryPatterns,
                        settings?.modelCategorization
                    );
                } catch (catErr) {
                    logger.warn("[Pipeline Category Error] Failed to categorize with memory, falling back to basic.", catErr);
                    // Fallback to basic categorization
                    try {
                        const basicCats = await aiService.categorizeTransactionsBatch(
                            rawData.transactions.map(tx => ({
                                description: tx.description,
                                amount_cents: tx.amount_cents
                            })),
                            settings?.modelCategorization
                        );
                        categorizations = basicCats.map(c => ({
                            ...c,
                            confidence: 0.5,
                            merchantNormalized: '',
                            needsReview: true
                        }));
                    } catch (fallbackErr) {
                        logger.error("[Pipeline Fallback Category Error] Both categorization methods failed.", fallbackErr);
                    }
                }

                // Prepare Batch Insert
                const toInsert = rawData.transactions.map((tx, i) => {
                    const aiCat = (categorizations && categorizations[i]) || {
                        category: 'Uncategorized',
                        gst: false,
                        notes: 'Missing from batch',
                        confidence: 0,
                        merchantNormalized: '',
                        needsReview: true
                    };
                    return {
                        id: crypto.randomUUID(),
                        statementId: statementId,
                        userId: userId,
                        accountId: accountDetection.accountId,
                        date: tx.date,
                        description: tx.description,
                        amount: tx.amount_cents,
                        balance: tx.balance_cents,
                        category: aiCat.category,
                        gstApplicable: aiCat.gst,
                        aiReasoningNotes: aiCat.notes,
                        confidenceScore: aiCat.confidence,
                        merchantNormalized: aiCat.merchantNormalized || null,
                        isTransfer: false,
                    };
                });

                if (toInsert.length > 0) {
                    logger.info(`[Pipeline] Inserting ${toInsert.length} transactions into database...`);

                    await db.transaction(async (tx) => {
                        // 4.1 Insert Transactions
                        await tx.insert(transactions).values(toInsert);

                        // 5. Batch Insert Pending Categorizations
                        const pendingItems: typeof pendingCategorization.$inferInsert[] = [];
                        for (let i = 0; i < categorizations.length; i++) {
                            const cat = categorizations[i];
                            const t = toInsert[i];
                            if (cat && cat.needsReview && cat.confidence < 0.7 && userId) {
                                pendingItems.push({
                                    id: crypto.randomUUID(),
                                    userId,
                                    transactionId: t.id,
                                    suggestedCategory: t.category,
                                    suggestedConfidence: cat.confidence,
                                    aiReasoning: cat.notes || null,
                                    status: 'pending',
                                    createdAt: new Date().toISOString(),
                                });
                            }
                        }

                        if (pendingItems.length > 0) {
                            logger.info(`[Pipeline] Batch adding ${pendingItems.length} items to pending categorization queue...`);
                            await tx.insert(pendingCategorization).values(pendingItems);
                        }

                        // 6. Batch Update Merchant Memory
                        if (userId) {
                            const highConfidenceItems = categorizations.filter(c => c.confidence >= 0.8 && c.merchantNormalized);
                            const memoryUpdates = highConfidenceItems.map(cat => ({
                                merchantPattern: cat.merchantNormalized,
                                merchantDisplayName: undefined,
                                category: cat.category,
                                gstApplicable: cat.gst,
                                isUserConfirmed: false,
                                createdAt: new Date().toISOString() // Helper for new items
                            }));

                            if (memoryUpdates.length > 0) {
                                // Note: This runs outside the transaction scope (using global db) but that's acceptable for side-effects
                                await accountService.batchUpdateMerchantMemory(userId, memoryUpdates);
                            }
                        }
                    });
                }

                // 7. Link statement to account if we have one
                if (accountDetection.accountId) {
                    await accountService.linkStatementToAccount(statementId, accountDetection.accountId);
                }

                // 8. Index in Cognee for RAG
                logger.info(`[Pipeline] Indexing ${toInsert.length} transactions in Cognee...`);
                try {
                    await ragService.indexTransactions(toInsert);
                } catch (ragErr) {
                    logger.error("[Pipeline Cognee Error]", ragErr);
                }

                // Determine final status
                const finalStatus = accountDetection.needsSetup ? 'NEEDS_ACCOUNT_SETUP' : 'COMPLETED';

                // Calculate statement period from transactions
                const sortedDates = rawData?.transactions.map(t => t.date).sort() || [];
                const periodStartDate = sortedDates[0] || null;
                const periodEndDate = sortedDates[sortedDates.length - 1] || null;

                // Get opening and closing balances from first and last transactions
                const sortedByDate = rawData?.transactions ? [...rawData.transactions].sort((a, b) => a.date.localeCompare(b.date)) : [];
                const openingBalance = sortedByDate[0]?.balance_cents ?? null;
                const closingBalance = sortedByDate[sortedByDate.length - 1]?.balance_cents ?? null;

                // Update status with period information
                await db.update(statements)
                    .set({
                        parsingStatus: finalStatus,
                        aiModelUsed: settings?.modelParsingText || 'google/gemini-3-flash-preview',
                        periodStartDate,
                        periodEndDate,
                        openingBalance,
                        closingBalance,
                        transactionCount: rawData?.transactions.length || 0,
                        isComplete: true
                    })
                    .where(eq(statements.id, statementId));

                events.emit('update', {
                    type: 'statement_updated',
                    id: statementId,
                    status: finalStatus,
                    userId,
                    accountDetection: accountDetection.needsSetup ? accountDetection : undefined
                });

                logger.info(`[Pipeline] Processing complete for ${statementId} (status: ${finalStatus})`);
            } else {
                logger.warn(`[Pipeline] No transactions found in statement ${statementId}`);
                await db.update(statements)
                    .set({
                        parsingStatus: 'FAILED',
                        errorType: 'EMPTY_STATEMENT',
                        errorMessage: "No transactions were detected. Please check if this is a valid transaction statement page.",
                    })
                    .where(eq(statements.id, statementId));
                events.emit('update', { type: 'statement_updated', id: statementId, status: 'FAILED', userId });
            }

        } catch (err: any) {
            logger.error(`[Pipeline Critical Error]`, err);
            await db.update(statements)
                .set({
                    parsingStatus: 'FAILED',
                    errorType: 'CRITICAL_ERROR',
                    errorMessage: err.message || "An unexpected system error occurred during processing."
                })
                .where(eq(statements.id, statementId));
            events.emit('update', { type: 'statement_updated', id: statementId, status: 'FAILED' });
        }
    }
}

export const pipeline = new PipelineService();
