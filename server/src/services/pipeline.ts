import { db, statements, transactions, accounts, userSettings, pendingCategorization } from '../schema.js';
import { aiService } from './ai.js';
import { ragService } from './rag.js';
import { accountService } from './accounts.js';
import { cogneeClient } from './cognee_client.js';
import { enrichmentService } from './enrichment.js';
import { eq, and } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import crypto from 'crypto';
import { events } from '../events.js';
import pdfParse from 'pdf-parse';
import { PdfParsingError, AiParseError } from '../errors.js';
import { logger } from '../utils/logger.js';
import { orchestrator } from './claude/orchestrator.js';
import { isClaudeAgentsEnabled } from './claude/config.js';
import { parserRegistry } from './parsers/registry.js';
import { TransferDetector, type TransferCandidate, type AccountContext } from './transfers/index.js';
import { persistTransferMatches, markOwnerContributions } from './transfers/persistence.js';
import { detectCreditCardStatement, parseCreditCardStatement } from './parsers/documents/credit-card/index.js';
import { hasCreditCardIndicators } from './parsers/detector.js';

// Transaction deduplication helper
function computeTransactionHash(date: string, description: string, amount: number, accountId: string | null): string {
    const raw = `${date}|${description}|${amount}|${accountId ?? ''}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
}

// Transfer-like description patterns for fallback flagging
const TRANSFER_KEYWORDS = /\b(transfer|tfr|trf|internal|bpay\s+transfer|pay\s+anyone|direct\s+credit|direct\s+debit)\b/i;

/** Flag transactions as likely transfers based on description keywords when full detection fails */
async function flagLikelyTransfersByDescription(txList: Array<{ id: string; description: string; category?: string }>) {
    let flagged = 0;
    for (const tx of txList) {
        if (TRANSFER_KEYWORDS.test(tx.description) || tx.category === 'Internal Transfer' || tx.category === 'Transfer') {
            try {
                await db.update(transactions)
                    .set({ isTransfer: true })
                    .where(eq(transactions.id, tx.id));
                flagged++;
            } catch (err: any) {
                logger.warn(`[Pipeline] Failed to flag transfer ${tx.id}: ${err.message}`);
            }
        }
    }
    if (flagged > 0) {
        logger.info(`[Pipeline] Flagged ${flagged} transactions as likely transfers by description`);
    }
}

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
    'Financial Services',
]);

function inferGstCategory(category: string, gstApplicable: boolean): string {
    if (!gstApplicable) return 'gst_free';
    if (INPUT_TAXED_CATEGORIES.has(category)) return 'input_taxed';
    if (GST_FREE_CATEGORIES.has(category)) return 'gst_free';
    return 'taxable_10';
}

/** Compute statement metadata from parsed transactions */
function computeStatementMetadata(
    txs: Array<{ date: string; amount_cents: number; balance_cents?: number }>,
    accountDetection: AccountDetectionResult
) {
    const sortedDates = txs.map(t => t.date).filter(Boolean).sort();
    const sortedByDate = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const openingBalance = accountDetection.detectedInfo.openingBalance ?? sortedByDate[0]?.balance_cents ?? null;
    const closingBalance = accountDetection.detectedInfo.closingBalance ?? sortedByDate[sortedByDate.length - 1]?.balance_cents ?? null;

    // Balance invariant validation: opening + sum(transactions) should equal closing
    if (openingBalance !== null && closingBalance !== null) {
        const txSum = txs.reduce((sum, tx) => sum + tx.amount_cents, 0);
        const expectedClosing = openingBalance + txSum;
        if (expectedClosing !== closingBalance) {
            logger.warn(`[Pipeline] Balance invariant failed: ${openingBalance} + ${txSum} = ${expectedClosing}, expected ${closingBalance}, diff=${expectedClosing - closingBalance}`);
        }
    }

    return {
        periodStartDate: sortedDates[0] || null,
        periodEndDate: sortedDates[sortedDates.length - 1] || null,
        openingBalance,
        closingBalance,
        transactionCount: txs.length,
    };
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
                // Try parser's extractAccountInfo first (faster, no AI cost)
                let accountInfo: any = null;
                const bankDetections = parserRegistry.detectBank(pdfText);
                if (bankDetections.length > 0 && bankDetections[0].confidence >= 0.5) {
                    const parser = parserRegistry.getParser(bankDetections[0].bankId);
                    if (parser) {
                        try {
                            const parserAccountInfo = await parser.extractAccountInfo(pdfText);
                            if (parserAccountInfo && parserAccountInfo.accountNumber && parserAccountInfo.accountNumber !== 'UNKNOWN') {
                                logger.info(`[Pipeline] Parser extracted account info (bank: ${bankDetections[0].bankId})`);
                                accountInfo = parserAccountInfo;
                            }
                        } catch (parserAccErr: any) {
                            logger.warn(`[Pipeline] Parser account info extraction failed: ${parserAccErr.message}`);
                        }
                    }
                }

                // Fall back to AI if parser didn't produce account info
                if (!accountInfo) {
                    accountInfo = await withRetry(() => aiService.extractAccountInfo(pdfText, settings?.modelParsingText), 2, 1000, "Account Info Extraction");
                }

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
                        // Auto-create account from detected information
                        accountDetection.isNewAccount = true;
                        logger.info(`[Pipeline] New account detected — auto-creating`);

                        try {
                            const accountType = accountDetection.detectedInfo.accountType || 'transaction';
                            const bankName = accountDetection.detectedInfo.bankName || 'Unknown Bank';
                            const accountName = `${bankName} ${accountType.charAt(0).toUpperCase() + accountType.slice(1)}`;

                            const newAccount = await accountService.createAccount({
                                userId,
                                accountNumber: accountInfo.accountNumber,
                                accountName,
                                accountType,
                                bankName,
                            });

                            // Update balance if we have closing balance info
                            if (accountInfo.closingBalance !== null && accountInfo.closingBalance !== undefined) {
                                await accountService.updateAccountBalance(newAccount.id, accountInfo.closingBalance);
                            }

                            accountDetection.accountId = newAccount.id;
                            accountDetection.needsSetup = false;
                            logger.info(`[Pipeline] Auto-created account: ${newAccount.id} (${accountName})`);

                            events.emit('update', {
                                type: 'account_created',
                                statementId,
                                userId,
                                accountId: newAccount.id,
                                detectedInfo: accountDetection.detectedInfo
                            });
                        } catch (createErr: any) {
                            logger.warn(`[Pipeline] Auto-create account failed, marking for manual setup: ${createErr.message}`);
                            accountDetection.needsSetup = true;

                            events.emit('update', {
                                type: 'account_setup_needed',
                                statementId,
                                userId,
                                detectedInfo: accountDetection.detectedInfo
                            });
                        }
                    }
                }
            } catch (accErr) {
                logger.warn("[Pipeline Account Detection Error] Continuing without account info", accErr);
                // Continue processing even if account detection fails
            }

            // 2b. Check if this is a credit card statement
            let isCreditCardStatement = false;
            let isBusinessCreditCard = false;
            const ccIndicators = hasCreditCardIndicators(pdfText);
            if (ccIndicators.isLikely) {
                logger.info(`[Pipeline] Credit card indicators detected (score: ${ccIndicators.score.toFixed(2)}, patterns: ${ccIndicators.matchedPatterns.length})`);
                isCreditCardStatement = true;
                // Update account type detection
                accountDetection.detectedInfo.accountType = 'credit';

                // Check if this is a business credit card (for GST auto-flagging)
                const businessKeywords = /business\s*(card|credit|account)|corporate\s*(card|credit)|company\s*(card|credit)/i;
                if (businessKeywords.test(pdfText)) {
                    isBusinessCreditCard = true;
                    logger.info(`[Pipeline] Business credit card detected — will auto-flag GST`);
                }

                // Update account with credit card info if we have an account
                if (accountDetection.accountId) {
                    try {
                        const ccLimitMatch = pdfText.match(/credit\s*limit[:\s]*\$?([\d,]+\.?\d*)/i);
                        const ccMinPayMatch = pdfText.match(/minimum\s*(?:payment|amount\s*due)[:\s]*\$?([\d,]+\.?\d*)/i);
                        const updateData: Record<string, any> = {};
                        if (ccLimitMatch) {
                            updateData.creditLimit = Math.round(parseFloat(ccLimitMatch[1].replace(/,/g, '')) * 100);
                        }
                        if (ccMinPayMatch) {
                            updateData.minimumPayment = Math.round(parseFloat(ccMinPayMatch[1].replace(/,/g, '')) * 100);
                        }
                        if (Object.keys(updateData).length > 0) {
                            await db.update(accounts)
                                .set(updateData)
                                .where(eq(accounts.id, accountDetection.accountId));
                            logger.info(`[Pipeline] Updated credit card account with: ${JSON.stringify(updateData)}`);
                        }
                    } catch (ccUpdateErr: any) {
                        logger.warn(`[Pipeline] Credit card info update failed: ${ccUpdateErr.message}`);
                    }
                }
            }

            // 3. Try bank-specific regex parser first (fastest, most reliable for known banks)
            logger.info(`[Pipeline] Trying bank-specific parser...`);
            let rawData: { transactions: Array<{ date: string; description: string; amount_cents: number; balance_cents?: number }> } | undefined;

            // 3a. If credit card, try credit card parser first
            if (isCreditCardStatement) {
                try {
                    const ccResult = await parseCreditCardStatement(pdfText);
                    if (ccResult.success && ccResult.result && ccResult.result.transactions.length > 0) {
                        logger.info(`[Pipeline] Credit card parser extracted ${ccResult.result.transactions.length} transactions`);

                        rawData = {
                            transactions: ccResult.result.transactions.map(tx => ({
                                date: tx.date,
                                description: tx.description,
                                amount_cents: tx.amount,
                                balance_cents: tx.balance,
                            }))
                        };

                        // Update account detection from credit card parser
                        if (ccResult.result.accountInfo) {
                            const info = ccResult.result.accountInfo;
                            accountDetection.detectedInfo.bankName = ccResult.result.bankName || accountDetection.detectedInfo.bankName;
                            accountDetection.detectedInfo.accountType = 'credit';
                            if (info.cardNumber) {
                                accountDetection.detectedInfo.accountNumber = info.cardNumber;
                            }
                            if (info.openingBalance !== undefined) {
                                accountDetection.detectedInfo.openingBalance = info.openingBalance ?? null;
                            }
                            if (info.closingBalance !== undefined) {
                                accountDetection.detectedInfo.closingBalance = info.closingBalance ?? null;
                            }
                        }

                        logger.info(`[Pipeline] Credit card parser success — skipping regular bank parser`);
                    } else {
                        logger.info(`[Pipeline] Credit card parser returned 0 transactions, trying regular bank parser`);
                    }
                } catch (ccErr: any) {
                    logger.warn(`[Pipeline] Credit card parser error, trying regular bank parser: ${ccErr.message}`);
                }
            }

            // 3b. Try regular bank parser if credit card parser didn't produce results
            if (!rawData || rawData.transactions.length === 0) {
            try {
                const parseResult = await parserRegistry.parseStatement(pdfText, { fallbackToAI: false });
                if (parseResult.success && parseResult.transactions.length > 0) {
                    logger.info(`[Pipeline] Bank parser (${parseResult.bankId}) extracted ${parseResult.transactions.length} transactions (confidence: ${parseResult.detectionConfidence.toFixed(2)})`);

                    // Map ParsedTransaction to pipeline format
                    rawData = {
                        transactions: parseResult.transactions.map(tx => ({
                            date: tx.date,
                            description: tx.description,
                            amount_cents: tx.amount,      // Already in cents from parser
                            balance_cents: tx.balance,     // Already in cents from parser
                        }))
                    };

                    // Update account detection from parser results
                    if (parseResult.accountInfo) {
                        const info = parseResult.accountInfo;
                        accountDetection.detectedInfo.bankName = parseResult.bankName || accountDetection.detectedInfo.bankName;
                        accountDetection.detectedInfo.accountType = info.accountType || accountDetection.detectedInfo.accountType;
                        if (info.accountNumber && info.accountNumber !== 'UNKNOWN') {
                            accountDetection.detectedInfo.accountNumber = info.accountNumber;
                        }
                        if (info.openingBalance !== undefined) {
                            accountDetection.detectedInfo.openingBalance = info.openingBalance;
                        }
                        if (info.closingBalance !== undefined) {
                            accountDetection.detectedInfo.closingBalance = info.closingBalance;
                        }
                    }

                    logger.info(`[Pipeline] Bank parser success — skipping AI text parsing`);
                } else {
                    logger.info(`[Pipeline] Bank parser returned 0 transactions (${parseResult.parseWarnings.join(', ')}), falling through to AI`);
                }
            } catch (parserErr: any) {
                logger.warn(`[Pipeline] Bank parser error, falling through to AI: ${parserErr.message}`);
            }
            } // end if (!rawData) for regular parser

            // 4. If regex parser didn't produce results, try AI parsing
            if (!rawData || rawData.transactions.length === 0) {
            logger.info(`[Pipeline] Sending to AI for parsing...`);

            // --- Claude Agent Mode ---
            if (isClaudeAgentsEnabled()) {
                logger.info(`[Pipeline] Using Claude agent orchestrator`);
                try {
                    const merchantMemoryData = userId ? await accountService.getMerchantMemory(userId) : [];
                    const memoryPatterns = merchantMemoryData.map((m: any) => ({
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

                        const allAgentInserts = rawData.transactions.map((tx: any, i: number) => {
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
                                transactionHash: computeTransactionHash(tx.date, tx.description, tx.amount_cents, accountDetection.accountId),
                            };
                        });

                        // Deduplicate agent path
                        const toInsert: typeof allAgentInserts = [];
                        for (const tx of allAgentInserts) {
                            const existing = await db.select({ id: transactions.id })
                                .from(transactions)
                                .where(
                                    and(
                                        eq(transactions.transactionHash, tx.transactionHash),
                                        eq(transactions.statementId, statementId)
                                    )
                                )
                                .get();
                            if (!existing) {
                                toInsert.push(tx);
                            } else {
                                logger.info(`[Pipeline] Agent path: skipping duplicate ${tx.date} ${tx.description} ${tx.amount}`);
                            }
                        }

                        if (toInsert.length > 0) {
                            await db.transaction(async (tx: any) => {
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

                        // Index in Cognee
                        try {
                            await ragService.indexTransactions(toInsert);
                            await cogneeClient.addStatementData({
                                id: statementId,
                                filename: stmt?.filename || 'unknown.pdf',
                                bankName: accountDetection.detectedInfo.bankName || undefined,
                                periodStart: rawData.transactions[0]?.date,
                                periodEnd: rawData.transactions[rawData.transactions.length - 1]?.date,
                            });
                        } catch (ragErr) {
                            logger.error("[Pipeline Cognee Error]", ragErr);
                        }

                        // Run enrichment for uncategorized transactions
                        const agentUncategorized = toInsert
                            .filter(t => !t.category || t.category === 'Uncategorized')
                            .map(t => t.id);
                        if (agentUncategorized.length > 0 && userId) {
                            try {
                                await enrichmentService.enrichTransactions(agentUncategorized, userId);
                            } catch (enrichErr: any) {
                                logger.warn(`[Pipeline] Agent path enrichment error: ${enrichErr.message}`);
                            }
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

                        // Emit typed events
                        events.emitParsingComplete({
                            statementId,
                            transactionCount: toInsert.length,
                            accountId: accountDetection.accountId,
                            bankName: accountDetection.detectedInfo.bankName,
                        });
                        events.emit('update', { type: 'bas_updated', userId });
                        events.emit('update', { type: 'tax_updated', userId });

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
            } // end if (!rawData || rawData.transactions.length === 0)

            // 4b. Vision-based secondary verification (always runs as double-check)
            // This ensures we can handle any statement regardless of bank
            try {
                const visionModel = settings?.modelParsingVision || 'google/gemini-3-flash-preview';
                logger.info(`[Pipeline] Running vision-based secondary check with ${visionModel}...`);

                const visionResult = await aiService.parseWithVisionBatched(filePath, visionModel);
                const visionTxCount = visionResult.transactions?.length || 0;
                const primaryTxCount = rawData?.transactions?.length || 0;

                logger.info(`[Pipeline] Vision check: ${visionTxCount} transactions (primary: ${primaryTxCount})`);

                if (primaryTxCount === 0 && visionTxCount > 0) {
                    // Primary parser failed entirely — use vision results
                    logger.info(`[Pipeline] Primary parser returned 0, using vision results (${visionTxCount} txs)`);
                    rawData = { transactions: visionResult.transactions };
                } else if (primaryTxCount > 0 && visionTxCount > 0) {
                    // Both have results — log discrepancy for review but trust primary
                    const discrepancy = Math.abs(primaryTxCount - visionTxCount);
                    const discrepancyPct = discrepancy / Math.max(primaryTxCount, visionTxCount) * 100;
                    const needsReview = discrepancyPct > 10;
                    if (discrepancyPct > 20) {
                        logger.warn(`[Pipeline] Vision discrepancy: primary=${primaryTxCount}, vision=${visionTxCount} (${discrepancyPct.toFixed(1)}% diff) — investigate`);
                    } else {
                        logger.info(`[Pipeline] Vision verification passed: counts within ${discrepancyPct.toFixed(1)}% tolerance`);
                    }

                    // Store verification results on statement
                    const visionVerification = JSON.stringify({
                        primaryCount: primaryTxCount,
                        visionCount: visionTxCount,
                        discrepancyPct: Math.round(discrepancyPct * 10) / 10,
                        needsReview,
                        verifiedAt: new Date().toISOString(),
                    });
                    await db.update(statements)
                        .set({ validationErrors: visionVerification })
                        .where(eq(statements.id, statementId));

                    // Emit typed vision verification event
                    events.emitVisionVerification({
                        statementId,
                        confidence: Math.round((100 - discrepancyPct) * 10) / 1000,
                        matches: Math.min(primaryTxCount, visionTxCount),
                        discrepancies: discrepancy,
                        needsReview,
                    });
                }
            } catch (visionErr: any) {
                logger.warn(`[Pipeline] Vision secondary check failed (non-fatal): ${visionErr.message}`);
                // Vision is supplementary — don't block pipeline on vision failure
            }

            // 5. Save Transactions with intelligent categorization
            if (rawData.transactions.length > 0) {
                logger.info(`[Pipeline] Extracted ${rawData.transactions.length} transactions. Categorizing with memory...`);

                // Get merchant memory for intelligent categorization
                const merchantMemoryData = userId ? await accountService.getMerchantMemory(userId) : [];
                const memoryPatterns = merchantMemoryData.map((m: any) => ({
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

                // Prepare Batch Insert with deduplication
                const allToInsert = rawData.transactions.map((tx, i) => {
                    const aiCat = (categorizations && categorizations[i]) || {
                        category: 'Uncategorized',
                        gst: false,
                        notes: 'Missing from batch',
                        confidence: 0,
                        merchantNormalized: '',
                        needsReview: true
                    };
                    // Auto-flag GST for business credit card transactions
                    const gstApplicable = isBusinessCreditCard ? true : aiCat.gst;
                    const gstCategory = isBusinessCreditCard
                        ? inferGstCategory(aiCat.category, true)
                        : inferGstCategory(aiCat.category, gstApplicable);
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
                        transactionHash: computeTransactionHash(tx.date, tx.description, tx.amount_cents, accountDetection.accountId),
                    };
                });

                // Deduplicate: check for existing transactions with the same hash
                const toInsert: typeof allToInsert = [];
                for (const tx of allToInsert) {
                    const existing = await db.select({ id: transactions.id })
                        .from(transactions)
                        .where(
                            and(
                                eq(transactions.transactionHash, tx.transactionHash),
                                eq(transactions.statementId, statementId)
                            )
                        )
                        .get();
                    if (existing) {
                        logger.info(`[Pipeline] Skipping duplicate transaction: ${tx.date} ${tx.description} ${tx.amount}`);
                    } else {
                        toInsert.push(tx);
                    }
                }
                if (allToInsert.length !== toInsert.length) {
                    logger.info(`[Pipeline] Dedup: ${allToInsert.length - toInsert.length} duplicates skipped, ${toInsert.length} to insert`);
                }

                if (toInsert.length > 0) {
                    logger.info(`[Pipeline] Inserting ${toInsert.length} transactions into database...`);

                    await db.transaction(async (tx: any) => {
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

                // 7b. Auto-detect transfers across accounts
                if (userId && toInsert.length > 0) {
                    try {
                        logger.info(`[Pipeline] Running transfer detection...`);

                        // Get all user transactions (including newly inserted ones)
                        const allUserTxs = await db.select().from(transactions)
                            .where(eq(transactions.userId, userId)).all();

                        // Get all user accounts
                        const userAccounts = await db.select().from(accounts)
                            .where(eq(accounts.userId, userId)).all();

                        if (userAccounts.length > 1 && allUserTxs.length > 1) {
                            // Convert to TransferCandidate format
                            const candidates: TransferCandidate[] = allUserTxs.map((t: any) => ({
                                id: t.id,
                                accountId: t.accountId || '',
                                date: t.date,
                                description: t.description,
                                amount: t.amount,
                                isLinked: t.isTransfer || false,
                                linkedTransactionId: t.transferLinkId || undefined,
                            }));

                            // Convert accounts to AccountContext format
                            const accountContexts: AccountContext[] = userAccounts.map((a: any) => ({
                                id: a.id,
                                accountNumber: a.accountNumber,
                                bankId: a.bankName || '',
                                accountName: a.accountName,
                                accountType: a.accountType,
                                ownershipTag: a.ownershipTag || 'business',
                            }));

                            const detector = new TransferDetector();
                            const matches = detector.detectTransfers(candidates, accountContexts);

                            if (matches.length > 0) {
                                logger.info(`[Pipeline] Found ${matches.length} potential transfers, persisting...`);
                                const persistResult = await persistTransferMatches(matches, { userId });
                                logger.info(`[Pipeline] Transfer persistence: ${persistResult.created} created, ${persistResult.skipped} skipped, ${persistResult.errors.length} errors`);

                                // Emit typed SSE events for each detected transfer
                                for (let mi = 0; mi < matches.length; mi++) {
                                    const m = matches[mi];
                                    const linkId = persistResult.linkIds[mi] || '';
                                    if (linkId) {
                                        events.emitTransferDetected({
                                            sourceAccountId: String(m.sourceTransaction.accountId) || null,
                                            destinationAccountId: String(m.targetTransaction.accountId) || null,
                                            amount: Math.abs(m.sourceTransaction.amount),
                                            confidence: m.confidence,
                                            linkId,
                                        });
                                    }
                                }

                                // Detect owner contributions (personal → business)
                                const ownerContribIds: string[] = [];
                                for (const match of matches) {
                                    const srcAcct = accountContexts.find(a => a.id === match.sourceTransaction.accountId);
                                    const dstAcct = accountContexts.find(a => a.id === match.targetTransaction.accountId);
                                    if (srcAcct?.ownershipTag === 'personal' && dstAcct?.ownershipTag === 'business') {
                                        ownerContribIds.push(String(match.targetTransaction.id));
                                    }
                                }
                                if (ownerContribIds.length > 0) {
                                    const ownerUpdated = await markOwnerContributions(ownerContribIds);
                                    logger.info(`[Pipeline] Marked ${ownerUpdated} transactions as owner contributions`);
                                }

                                events.emit('update', { type: 'transfers_updated', userId });
                            } else {
                                logger.info(`[Pipeline] No transfer matches found`);
                            }
                        }
                    } catch (transferErr: any) {
                        logger.warn(`[Pipeline] Transfer detection error (non-fatal): ${transferErr.message}`);
                        // Flag transactions that look like transfers by description keywords
                        await flagLikelyTransfersByDescription(toInsert);
                    }
                } else if (userId && toInsert.length > 0) {
                    // Only 1 account or no accounts — still flag description-based transfers
                    await flagLikelyTransfersByDescription(toInsert);
                }

                // 8. Index in Cognee for RAG
                logger.info(`[Pipeline] Indexing ${toInsert.length} transactions in Cognee...`);
                try {
                    await ragService.indexTransactions(toInsert);

                    // Also index statement metadata in Cognee
                    await cogneeClient.addStatementData({
                        id: statementId,
                        filename: stmt?.filename || 'unknown.pdf',
                        bankName: accountDetection.detectedInfo.bankName || undefined,
                        periodStart: rawData.transactions[0]?.date,
                        periodEnd: rawData.transactions[rawData.transactions.length - 1]?.date,
                    });
                } catch (ragErr) {
                    logger.error("[Pipeline Cognee Error]", ragErr);
                }

                // 8b. Run enrichment pipeline for uncategorized transactions
                const uncategorizedIds = toInsert
                    .filter(t => !t.category || t.category === 'Uncategorized')
                    .map(t => t.id);
                if (uncategorizedIds.length > 0 && userId) {
                    try {
                        logger.info(`[Pipeline] Running enrichment on ${uncategorizedIds.length} uncategorized transactions...`);
                        await enrichmentService.enrichTransactions(uncategorizedIds, userId);
                    } catch (enrichErr: any) {
                        logger.warn(`[Pipeline] Enrichment error (non-fatal): ${enrichErr.message}`);
                    }
                }

                // 9. Emit events to trigger auto-recalculation of BAS/tax on client
                events.emit('update', { type: 'bas_updated', userId });
                events.emit('update', { type: 'tax_updated', userId });

                // Emit parsing_complete event
                events.emitParsingComplete({
                    statementId,
                    transactionCount: toInsert.length,
                    accountId: accountDetection.accountId,
                    bankName: accountDetection.detectedInfo.bankName,
                });

                // Determine final status
                const finalStatus = accountDetection.needsSetup ? 'NEEDS_ACCOUNT_SETUP' : 'COMPLETED';

                // Compute metadata using helper
                const metadata = computeStatementMetadata(rawData.transactions, accountDetection);

                // Update status with period information
                await db.update(statements)
                    .set({
                        parsingStatus: finalStatus,
                        aiModelUsed: settings?.modelParsingText || 'bank-regex-parser',
                        ...metadata,
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
            events.emitPipelineError({
                statementId,
                errorType: 'CRITICAL_ERROR',
                message: err.message || 'An unexpected system error occurred during processing.',
            });
        }
    }
}

export const pipeline = new PipelineService();
