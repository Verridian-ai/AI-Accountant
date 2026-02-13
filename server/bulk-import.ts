/**
 * Bulk Import Statements from /statements/ directory
 *
 * Scans the statements directory for PDF files not yet in the database,
 * creates statement records, and processes them through the vision-first pipeline.
 *
 * Usage: cd server && npx tsx bulk-import.ts
 * Docker: docker exec cba-server sh -c "node --import tsx/esm bulk-import.ts"
 */

import { db, statements } from './src/schema.js';
import { pipeline } from './src/services/pipeline.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import { readdirSync, readFileSync } from 'fs';
import crypto from 'crypto';

// Default user ID — set to the admin user
const DEFAULT_USER_ID = '0ca3af13-f3fb-4486-b461-c49e89e8bde2';

async function main() {
    console.log('=== Bulk Import Statements ===\n');

    const statementsDir = path.resolve(process.cwd(), '../statements');
    console.log(`Scanning: ${statementsDir}\n`);

    // List all PDFs
    const files = readdirSync(statementsDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    console.log(`Found ${files.length} PDF files on disk\n`);

    // Get all existing hashes from DB
    const existingStatements = await db.select({
        id: statements.id,
        hash: statements.hash,
        filename: statements.filename,
        parsingStatus: statements.parsingStatus,
        transactionCount: statements.transactionCount,
    }).from(statements).all();

    const existingHashes = new Set(existingStatements.map(s => s.hash));
    console.log(`${existingStatements.length} statements already in DB\n`);

    // Find new files
    const newFiles: Array<{ filename: string; filePath: string; hash: string }> = [];
    const duplicates: string[] = [];

    for (const filename of files) {
        const filePath = path.join(statementsDir, filename);
        const buffer = readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');

        if (existingHashes.has(hash)) {
            duplicates.push(filename);
        } else {
            newFiles.push({ filename, filePath, hash });
            existingHashes.add(hash); // Prevent same-content dupes within this batch
        }
    }

    console.log(`New files to import: ${newFiles.length}`);
    console.log(`Duplicates skipped: ${duplicates.length}`);
    if (duplicates.length > 0) {
        for (const d of duplicates) {
            console.log(`  [SKIP] ${d}`);
        }
    }
    console.log('');

    if (newFiles.length === 0) {
        console.log('Nothing new to import!');
        return;
    }

    let successes = 0;
    let failures = 0;
    let totalTxns = 0;

    for (let i = 0; i < newFiles.length; i++) {
        const { filename, filePath, hash } = newFiles[i];
        const id = crypto.randomUUID();

        console.log(`\n--- [${i + 1}/${newFiles.length}] Importing: ${filename} ---`);

        try {
            // Insert statement record
            await db.insert(statements).values({
                id,
                filename,
                hash,
                uploadDate: new Date().toISOString(),
                parsingStatus: 'PENDING',
                userId: DEFAULT_USER_ID,
            });
            console.log(`  Created statement: ${id.slice(0, 8)}`);

            // Process through pipeline
            await pipeline.processStatement(id, filePath);

            // Check result
            const updated = await db.select()
                .from(statements)
                .where(eq(statements.id, id))
                .get();

            const txCount = updated?.transactionCount ?? 0;
            const status = updated?.parsingStatus ?? 'UNKNOWN';

            if (status === 'COMPLETED' || status === 'NEEDS_ACCOUNT_SETUP') {
                console.log(`  SUCCESS: ${txCount} transactions (${updated?.aiModelUsed})`);
                successes++;
                totalTxns += txCount;
            } else {
                console.log(`  FAILED: status=${status}, error=${updated?.errorMessage?.slice(0, 80)}`);
                failures++;
            }
        } catch (err: any) {
            console.error(`  ERROR: ${err.message}`);
            failures++;
        }

        // Rate limit: 3s between statements
        if (i < newFiles.length - 1) {
            console.log('  Waiting 3s...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    // Final summary
    console.log(`\n=== BULK IMPORT SUMMARY ===`);
    console.log(`  Files scanned: ${files.length}`);
    console.log(`  Already in DB: ${duplicates.length}`);
    console.log(`  New imported: ${newFiles.length}`);
    console.log(`  Successes: ${successes}`);
    console.log(`  Failures: ${failures}`);
    console.log(`  New transactions: ${totalTxns}`);

    // Show final DB state
    const finalStatements = await db.select({
        parsingStatus: statements.parsingStatus,
    }).from(statements).all();

    const statusCounts: Record<string, number> = {};
    for (const s of finalStatements) {
        statusCounts[s.parsingStatus] = (statusCounts[s.parsingStatus] || 0) + 1;
    }
    console.log(`\n  DB Statement Status:`);
    for (const [status, count] of Object.entries(statusCounts)) {
        console.log(`    ${status}: ${count}`);
    }
    console.log(`===========================\n`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
