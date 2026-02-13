/**
 * Reprocess Failed/Empty Statements
 *
 * Queries DB for statements with transaction_count = 0 or parsing_status = 'FAILED',
 * resets them, and re-runs through the pipeline (now with Gemini Flash Vision as primary).
 *
 * Usage: cd server && npx tsx reprocess-failed.ts
 */

import { db, statements, transactions } from './src/schema.js';
import { pipeline } from './src/services/pipeline.js';
import { eq, or, sql } from 'drizzle-orm';
import path from 'path';
import { existsSync } from 'fs';

async function main() {
    console.log('=== Reprocess Failed/Empty Statements ===\n');

    // Find all statements with 0 transactions or FAILED status
    const toReprocess = await db.select()
        .from(statements)
        .where(
            or(
                eq(statements.parsingStatus, 'FAILED'),
                eq(statements.transactionCount, 0),
                sql`${statements.transactionCount} IS NULL`
            )
        )
        .all();

    if (toReprocess.length === 0) {
        console.log('No statements need reprocessing. All done!');
        return;
    }

    console.log(`Found ${toReprocess.length} statements to reprocess:\n`);
    for (const stmt of toReprocess) {
        console.log(`  [${stmt.id.slice(0, 8)}] ${stmt.filename} - status: ${stmt.parsingStatus}, txns: ${stmt.transactionCount ?? 0}`);
    }
    console.log('');

    let successes = 0;
    let failures = 0;
    let totalNewTxns = 0;

    for (let i = 0; i < toReprocess.length; i++) {
        const stmt = toReprocess[i];
        const filePath = path.resolve(process.cwd(), '../statements', stmt.filename);

        console.log(`\n--- [${i + 1}/${toReprocess.length}] Processing: ${stmt.filename} (${stmt.id.slice(0, 8)}) ---`);

        if (!existsSync(filePath)) {
            console.error(`  FILE NOT FOUND: ${filePath} — skipping`);
            failures++;
            continue;
        }

        try {
            // Delete existing transactions for this statement
            const deleted = await db.delete(transactions)
                .where(eq(transactions.statementId, stmt.id))
                .run();
            console.log(`  Cleared existing transactions`);

            // Reset statement status
            await db.update(statements)
                .set({
                    parsingStatus: 'PENDING',
                    errorMessage: null,
                    errorType: null,
                    errorDetails: null,
                    aiModelUsed: null,
                    validationErrors: null,
                    transactionCount: 0,
                    periodStartDate: null,
                    periodEndDate: null,
                    openingBalance: null,
                    closingBalance: null,
                })
                .where(eq(statements.id, stmt.id));
            console.log(`  Reset statement to PENDING`);

            // Process through pipeline (vision-first)
            await pipeline.processStatement(stmt.id, filePath);

            // Check result
            const updated = await db.select()
                .from(statements)
                .where(eq(statements.id, stmt.id))
                .get();

            if (updated && updated.parsingStatus === 'COMPLETED' && (updated.transactionCount ?? 0) > 0) {
                console.log(`  SUCCESS: ${updated.transactionCount} transactions, model: ${updated.aiModelUsed}`);
                successes++;
                totalNewTxns += updated.transactionCount ?? 0;
            } else if (updated && updated.parsingStatus === 'NEEDS_ACCOUNT_SETUP') {
                console.log(`  NEEDS SETUP: ${updated.transactionCount ?? 0} transactions extracted, needs account linking`);
                successes++;
                totalNewTxns += updated.transactionCount ?? 0;
            } else {
                console.log(`  FAILED: status=${updated?.parsingStatus}, error=${updated?.errorMessage}`);
                failures++;
            }
        } catch (err: any) {
            console.error(`  ERROR: ${err.message}`);
            failures++;
        }

        // Rate limiting delay between statements
        if (i < toReprocess.length - 1) {
            console.log(`  Waiting 3s before next statement...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.log(`\n=== REPROCESS SUMMARY ===`);
    console.log(`  Total processed: ${toReprocess.length}`);
    console.log(`  Successes: ${successes}`);
    console.log(`  Failures: ${failures}`);
    console.log(`  New transactions: ${totalNewTxns}`);
    console.log(`========================\n`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
