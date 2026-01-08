import { db, statements, transactions } from '../db.js';
import { aiService } from './ai.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import crypto from 'crypto';
// @ts-ignore - pdf-parse doesn't have proper ESM types
import pdfParse from 'pdf-parse';

export class PipelineService {

    async processStatement(statementId: string, filePath: string) {
        try {
            console.log(`[Pipeline] Starting processing for ${statementId}`);

            // Update status to PROCESSING
            await db.update(statements)
                .set({ parsingStatus: 'PROCESSING' })
                .where(eq(statements.id, statementId));

            // 1. Read and parse PDF text content
            console.log(`[Pipeline] Extracting text from PDF: ${filePath}`);
            const pdfBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(pdfBuffer);
            const pdfText = pdfData.text;

            console.log(`[Pipeline] Extracted ${pdfText.length} characters from PDF`);

            // 2. Use AI to parse the text content into structured transactions
            console.log(`[Pipeline] Sending to AI for parsing...`);
            const rawData = await aiService.parseStatementText(pdfText);

            // 3. Save Transactions
            if (rawData && rawData.transactions && rawData.transactions.length > 0) {
                console.log(`[Pipeline] Extracted ${rawData.transactions.length} transactions`);

                for (const tx of rawData.transactions) {
                    const txId = crypto.randomUUID();

                    // Categorize
                    const aiCat = await aiService.categorizeTransaction(tx.description, tx.amount_cents);

                    await db.insert(transactions).values({
                        id: txId,
                        statementId: statementId,
                        date: tx.date,
                        description: tx.description,
                        amount: tx.amount_cents,
                        balance: tx.balance_cents,
                        category: aiCat.category,
                        gstApplicable: aiCat.gst,
                        aiReasoningNotes: aiCat.notes,
                        confidenceScore: 0.9 // Placeholder
                    });
                }

                // Update status to COMPLETED
                await db.update(statements)
                    .set({ parsingStatus: 'COMPLETED', aiModelUsed: 'gpt-4o' })
                    .where(eq(statements.id, statementId));

                console.log(`[Pipeline] Processing complete for ${statementId}`);
            } else {
                console.log(`[Pipeline] No transactions found in statement ${statementId}`);
                await db.update(statements)
                    .set({ parsingStatus: 'COMPLETED', aiModelUsed: 'gpt-4o' })
                    .where(eq(statements.id, statementId));
            }

        } catch (err) {
            console.error(`[Pipeline Error]`, err);
            await db.update(statements)
                .set({ parsingStatus: 'FAILED' })
                .where(eq(statements.id, statementId));
        }
    }
}

export const pipeline = new PipelineService();
