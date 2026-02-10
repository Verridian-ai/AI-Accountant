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
import { orchestrator } from './claude/orchestrator.js';
import { isClaudeAgentsEnabled } from './claude/config.js';

// GST auto-calculation helpers
const GST_RATE = 0.10; // 10% Australian GST

function calculateGstAmount(amountCents: number): number {
    return Math.round(Math.abs(amountCents) * GST_RATE / (1 + GST_RATE));
}

// Map transaction categories to GST categories
const GST_FREE_CATEGORIES = new Set([
    'Government & Tax', 'Internal Transfer', 'Transfer',
    'Interest & Dividends', 'Loan/Liability Payment',
    'Superannuation', 'Insurance', 'Medical & Health',
    'Education & Childcare', 'Donations & Charity',
    'Employment Income', 'Salary & Wages',
]);

const INPUT_TAXED_CATEGORIES = new Set([
    'Interest & Dividends', 'Financial Services',
]);

function inferGstCategory(category: string, gstApplicable: boolean): string {
    if (!gstApplicable) return 'gst_free';
    if (INPUT_TAXED_CATEGORIES.has(category)) return 'input_taxed';
    if (GST_FREE_CATEGORIES.has(category)) return 'gst_free';
    return 'taxable_10';
}

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

            // --- Claude Agent Mode ---
            if (isClaudeAgentsEnabled()) {
                logger.info(`[Pipeline] Using Claude agent orchestrator`);
                try {
                    const merchantMemoryData = userId ? await accountService.getMerchantMemory(userId) : [];
                    const memoryPatterns = merchantMemoryData.map(m => ({
                        pattern: m.merchantPattern,
                        category: m.category,
                        gst: m.gstApplicable ?? false
                    }));

                    const agentResult = await orchestrator.processStatement(
                        parseInt(statementId, 10) || 0,
                        pdfText,
                        stmt?.filename || 'unknown.pdf',
                        memoryPatterns
                    );

                    // Map agent output to existing format
                    rawData = {
                        transactions: agentResult.parsed.transactions.map(tx => ({
                            date: tx.date,
                            description: tx.description,
                            amount_cents: tx.amount,
                            balance_cents: tx.balance,
                        }))
                    };

                    // Map categorizations from agent output
                    const categorizations: Array<{
                        category: string;
                        gst: boolean;
                        notes: string;
                        confidence: number;
                        merchantNormalized: string;
                        needsReview: boolean;
                    }> = agentResult.categorized.results.map(r => ({
                        category: r.category,
                        gst: r.gstCategory === 'gst_applicable' || r.gstCategory === 'taxable_10',
                        notes: r.aiReasoningNotes,
                        confidence: r.confidence,
                        merchantNormalized: r.merchantKey || '',
                        needsReview: r.confidence < 0.7,
                    }));

                    // Update account detection from agent parser output
                    if (agentResult.parsed.accountInfo) {
                        const info = agentResult.parsed.accountInfo;
                        accountDetection.detectedInfo.accountNumber = info.accountNumber || null;
                        accountDetection.detectedInfo.bankName = agentResult.parsed.bankId || null;
                        accountDetection.detectedInfo.accountType = info.accountType || null;
                        accountDetection.detectedInfo.openingBalance = info.openingBalance ?? null;
                        accountDetection.detectedInfo.closingBalance = info.closingBalance ?? null;
                    }

                    // Jump to the insertion section with these categorizations
                    if (rawData.transactions.length > 0) {
                        logger.info(`[Pipeline] Claude agents extracted ${rawData.transactions.length} transactions`);

                        const toInsert = rawData.transactions.map((tx: any, i: number) => {
                            const aiCat = (categorizations && categorizations[i]) || {
                                category: 'Uncategorized', gst: false, notes: 'Missing from batch',
                                confidence: 0, merchantNormalized: '', needsReview: true
                            };
                            return {
                                id: crypto.randomUUID(),
                                statementId, userId,
                                accountId: accountDetection.accountId,
                                date: tx.date, description: tx.description,
                                amount: tx.amount_cents, balance: tx.balance_cents,
                                category: aiCat.category, gstApplicable: aiCat.gst,
                                aiReasoningNotes: aiCat.notes, confidenceScore: aiCat.confidence,
                                merchantNormalized: aiCat.merchantNormalized || null,
                                isTransfer: false,
                            };
                        });

                        if (toInsert.length > 0) {
                            await db.transaction(async (tx) => {
                                await tx.insert(transactions).values(toInsert);

                                const pendingItems: typeof pendingCategorization.$inferInsert[] = [];
                                for (let i = 0; i < categorizations.length; i++) {
                                    const cat = categorizations[i];
                                    const t = toInsert[i];
                                    if (cat && cat.needsReview && cat.confidence < 0.7 && userId) {
                                        pendingItems.push({
                                            id: crypto.randomUUID(), userId,
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
                                    await tx.insert(pendingCategorization).values(pendingItems);
                                }

                                if (userId) {
                                    const highConf = categorizations.filter(c => c.confidence >= 0.8 && c.merchantNormalized);
                                    if (highConf.length > 0) {
                                        await accountService.batchUpdateMerchantMemory(userId, highConf.map(cat => ({
                                            merchantPattern: cat.merchantNormalized,
                                            merchantDisplayName: undefined,
                                            category: cat.category,
                                            gstApplicable: cat.gst,
                                            isUserConfirmed: false,
                                            createdAt: new Date().toISOString(),
                                        })));
                                    }
                                }
                            });
                        }

                        if (accountDetection.accountId) {
                            await accountService.linkStatementToAccount(statementId, accountDetection.accountId);
                        }

                        try { await ragService.indexTransactions(toInsert); } catch (ragErr) {
                            logger.error("[Pipeline Cognee Error]", ragErr);
                        }

                        const finalStatus = accountDetection.needsSetup ? 'NEEDS_ACCOUNT_SETUP' : 'COMPLETED';
                        const sortedDates = rawData.transactions.map((t: any) => t.date).sort();

                        await db.update(statements).set({
                            parsingStatus: finalStatus,
                            aiModelUsed: 'claude-agent-orchestrator',
                            periodStartDate: sortedDates[0] || null,
                            periodEndDate: sortedDates[sortedDates.length - 1] || null,
                            openingBalance: rawData.transactions[0]?.balance_cents ?? null,
                            closingBalance: rawData.transactions[rawData.transactions.length - 1]?.balance_cents ?? null,
                            transactionCount: rawData.transactions.length,
                            isComplete: true,
                        }).where(eq(statements.id, statementId));

                        events.emit('update', {
                            type: 'statement_updated', id: statementId, status: finalStatus, userId,
                            accountDetection: accountDetection.needsSetup ? accountDetection : undefined,
                        });

                        logger.info(`[Pipeline] Claude agent processing complete for ${statementId}`);
                        return; // Done — skip the legacy path below
                    }
                } catch (agentErr: any) {
                    logger.warn(`[Pipeline] Claude agent failed, falling back to legacy AI: ${agentErr.message}`);
                    // Fall through to legacy path
                }
            }

            // --- Legacy AI Mode (fallback) ---
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
                        errorMessage: "The AI was unable to find transactions in this document. Ensure it is a valid bank statement.",
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
                    const gstApplicable = aiCat.gst;
                    const gstCategory = inferGstCategory(aiCat.category, gstApplicable);
                    const gstAmount = (gstApplicable && gstCategory === 'taxable_10')
                        ? calculateGstAmount(tx.amount_cents)
                        : 0;

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
                        gstApplicable: gstApplicable,
                        gstAmount: gstAmount,
                        gstCategory: gstCategory,
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

                // 9. Emit events to trigger auto-recalculation of BAS/tax on client
                events.emit('update', { type: 'bas_updated', userId });
                events.emit('update', { type: 'tax_updated', userId });

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
