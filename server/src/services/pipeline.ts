import { db, statements, transactions, userSettings } from '../schema.js';
import { aiService } from './ai.js';
import { ragService } from './rag.js';
import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import crypto from 'crypto';
import { events } from '../events.js';
import pdfParse from 'pdf-parse';

export class PipelineService {

    async processStatement(statementId: string, filePath: string) {
        try {
            console.log(`[Pipeline] Starting processing for ${statementId}`);

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
            console.log(`[Pipeline] Extracting text from PDF: ${filePath}`);
            let pdfText = '';
            try {
                const pdfBuffer = await readFile(filePath);
                const pdfData = await pdfParse(pdfBuffer);
                pdfText = pdfData.text;

                if (!pdfText || pdfText.trim().length < 50) {
                    throw new Error("PDF contained very little readable text. It might be a scanned image without OCR, or a password-protected file.");
                }
            } catch (pdfErr: any) {
                console.error("[Pipeline PDF Error]", pdfErr);
                await db.update(statements)
                    .set({
                        parsingStatus: 'FAILED',
                        errorType: 'PDF_READ_ERROR',
                        errorMessage: pdfErr.message || "Failed to read PDF content.",
                        errorDetails: JSON.stringify({ filename: stmt?.filename })
                    })
                    .where(eq(statements.id, statementId));
                events.emit('update', { type: 'statement_updated', id: statementId, status: 'FAILED', userId });
                return;
            }

            console.log(`[Pipeline] Extracted ${pdfText.length} characters from PDF`);

            // 2. Use AI to parse the text content into structured transactions
            console.log(`[Pipeline] Sending to AI for parsing...`);
            let rawData;
            try {
                rawData = await aiService.parseStatementText(pdfText, settings?.modelParsingText);
                if (!rawData || !rawData.transactions) {
                    throw new Error("AI failed to return any transaction data from the text.");
                }
            } catch (aiErr: any) {
                console.error("[Pipeline AI Error]", aiErr);
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

            // 3. Save Transactions
            if (rawData.transactions.length > 0) {
                console.log(`[Pipeline] Extracted ${rawData.transactions.length} transactions. Categorizing in batch...`);

                // Batch Categorize
                let categorizations: Array<{ category: string, gst: boolean, notes: string }> = [];

                try {
                    categorizations = await aiService.categorizeTransactionsBatch(rawData.transactions.map(tx => ({
                        description: tx.description,
                        amount_cents: tx.amount_cents
                    })), settings?.modelCategorization);
                } catch (catErr) {
                    console.error("[Pipeline Category Error]", catErr);
                }

                // Prepare Batch Insert
                const toInsert = rawData.transactions.map((tx, i) => {
                    const aiCat = (categorizations && categorizations[i]) || { category: 'Uncategorized', gst: false, notes: 'Missing from batch' };
                    return {
                        id: crypto.randomUUID(),
                        statementId: statementId,
                        userId: userId,
                        date: tx.date,
                        description: tx.description,
                        amount: tx.amount_cents,
                        balance: tx.balance_cents,
                        category: aiCat.category,
                        gstApplicable: aiCat.gst,
                        aiReasoningNotes: aiCat.notes,
                        confidenceScore: 0.9
                    };
                });

                if (toInsert.length > 0) {
                    console.log(`[Pipeline] Inserting ${toInsert.length} transactions into database...`);
                    await db.insert(transactions).values(toInsert);

                    // 4. Index in Cognee for RAG
                    console.log(`[Pipeline] Indexing ${toInsert.length} transactions in Cognee...`);
                    try {
                        await ragService.indexTransactions(toInsert);
                    } catch (ragErr) {
                        console.error("[Pipeline Cognee Error]", ragErr);
                    }
                }

                // Update status to COMPLETED
                await db.update(statements)
                    .set({ parsingStatus: 'COMPLETED', aiModelUsed: settings?.modelParsingText || 'google/gemini-3-flash-preview' })
                    .where(eq(statements.id, statementId));
                events.emit('update', { type: 'statement_updated', id: statementId, status: 'COMPLETED', userId });

                console.log(`[Pipeline] Processing complete for ${statementId}`);
            } else {
                console.log(`[Pipeline] No transactions found in statement ${statementId}`);
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
            console.error(`[Pipeline Critical Error]`, err);
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
