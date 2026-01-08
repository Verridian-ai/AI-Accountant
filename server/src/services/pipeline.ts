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
            const pdfBuffer = await readFile(filePath);
            const pdfData = await pdfParse(pdfBuffer);
            const pdfText = pdfData.text;

            console.log(`[Pipeline] Extracted ${pdfText.length} characters from PDF`);

            // 2. Use AI to parse the text content into structured transactions
            console.log(`[Pipeline] Sending to AI for parsing...`);
            const rawData = await aiService.parseStatementText(pdfText, settings?.modelParsingText);

            // 3. Save Transactions
            if (rawData && rawData.transactions && rawData.transactions.length > 0) {
                console.log(`[Pipeline] Extracted ${rawData.transactions.length} transactions. Categorizing in batch...`);

                // Batch Categorize
                const categorizations = await aiService.categorizeTransactionsBatch(rawData.transactions.map(tx => ({
                    description: tx.description,
                    amount_cents: tx.amount_cents
                })), settings?.modelCategorization);

                // Prepare Batch Insert
                const toInsert = rawData.transactions.map((tx, i) => {
                    const aiCat = categorizations[i] || { category: 'Uncategorized', gst: false, notes: 'Missing from batch' };
                    return {
                        id: crypto.randomUUID(),
                        statementId: statementId,
                        userId: userId, // Propagate userId to transactions
                        date: tx.date,
                        description: tx.description,
                        amount: tx.amount_cents,
                        balance: tx.balance_cents,
                        category: aiCat.category,
                        gstApplicable: aiCat.gst,
                        aiReasoningNotes: aiCat.notes,
                        confidenceScore: 0.9 // Placeholder
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
                    .set({ parsingStatus: 'COMPLETED', aiModelUsed: settings?.modelParsingText || 'google/gemini-3-flash-preview' })
                    .where(eq(statements.id, statementId));
                events.emit('update', { type: 'statement_updated', id: statementId, status: 'COMPLETED', userId });
            }

        } catch (err) {
            console.error(`[Pipeline Error]`, err);
            await db.update(statements)
                .set({ parsingStatus: 'FAILED' })
                .where(eq(statements.id, statementId));
            events.emit('update', { type: 'statement_updated', id: statementId, status: 'FAILED' });
        }
    }
}

export const pipeline = new PipelineService();
