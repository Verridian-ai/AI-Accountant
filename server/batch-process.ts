/**
 * Batch process all PDF statements in the statements/ directory.
 * Uses the CBA regex parser directly (no AI calls needed for CBA statements).
 *
 * Usage: npx tsx batch-process.ts
 */
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import pdfParse from 'pdf-parse';
import { CBAParser } from './src/services/parsers/banks/cba';

const statementsDir = path.resolve('..', 'statements');
const dbPath = path.resolve('sqlite.db');
const db = new Database(dbPath);

// Get a test user ID (use the first user)
const user = db.prepare('SELECT id FROM users LIMIT 1').get() as any;
const userId: string | null = user?.id || null;
console.log(`Using user ID: ${userId}`);

async function main() {
    // Get all PDF files
    const files = (await readdir(statementsDir)).filter(f => f.endsWith('.pdf'));
    console.log(`Found ${files.length} PDF files in ${statementsDir}\n`);

    const parser = new CBAParser();
    let totalStatementsProcessed = 0;
    let totalTransactionsInserted = 0;
    const errors: Array<{ filename: string; error: string }> = [];

    for (const filename of files) {
        const filePath = path.join(statementsDir, filename);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Processing: ${filename}`);

        try {
            // 1. Compute hash for dedup
            const fileBuffer = await readFile(filePath);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            // 2. Check if already in DB
            let stmt = db.prepare('SELECT id, parsing_status, transaction_count FROM statements WHERE hash = ?').get(hash) as any;

            let statementId: string;
            if (stmt) {
                statementId = stmt.id;
                if (stmt.transaction_count > 0) {
                    console.log(`  Already parsed with ${stmt.transaction_count} transactions, skipping.`);
                    continue;
                }
                console.log(`  Exists in DB (status: ${stmt.parsing_status}), reprocessing...`);
                // Reset for reprocessing
                db.prepare(`UPDATE statements SET parsing_status='PROCESSING', error_message=NULL, error_type=NULL,
                    transaction_count=0, period_start_date=NULL, period_end_date=NULL, opening_balance=NULL, closing_balance=NULL
                    WHERE id=?`).run(statementId);
            } else {
                statementId = crypto.randomUUID();
                db.prepare(`INSERT INTO statements (id, filename, hash, upload_date, parsing_status, user_id)
                    VALUES (?, ?, ?, ?, 'PROCESSING', ?)`).run(
                    statementId, filename, hash, new Date().toISOString(), userId
                );
                console.log(`  Registered in DB: ${statementId}`);
            }

            // 3. Extract text from PDF
            const pdfResult = await pdfParse(fileBuffer);
            const pdfText = pdfResult.text;
            console.log(`  PDF text: ${pdfText.length} chars, ${pdfResult.numpages} pages`);

            // 4. Detect bank
            const detection = parser.detect(pdfText);
            console.log(`  CBA confidence: ${(detection.confidence * 100).toFixed(0)}% (matched: ${detection.matchedPatterns.join(', ')})`);

            if (detection.confidence < 0.3) {
                console.log(`  Not a CBA statement (confidence too low), marking for AI parsing`);
                db.prepare(`UPDATE statements SET parsing_status='PENDING', error_message='Not CBA - needs AI parser' WHERE id=?`).run(statementId);
                errors.push({ filename, error: 'Not CBA statement' });
                continue;
            }

            // 5. Parse transactions
            const transactions = await parser.parseTransactions(pdfText);
            console.log(`  Parsed: ${transactions.length} transactions`);

            if (transactions.length === 0) {
                console.log(`  WARNING: No transactions found`);
                db.prepare(`UPDATE statements SET parsing_status='COMPLETED', transaction_count=0, error_message='Parser returned 0 transactions' WHERE id=?`).run(statementId);
                errors.push({ filename, error: '0 transactions parsed' });
                continue;
            }

            // 6. Extract account info
            const accountInfo = await parser.extractAccountInfo(pdfText);
            console.log(`  Account: ${accountInfo.accountType} ${accountInfo.accountNumber || 'N/A'} (BSB: ${accountInfo.bsb || 'N/A'})`);

            // 7. Delete existing transactions for this statement (reprocess)
            const deleted = db.prepare('DELETE FROM transactions WHERE statement_id = ?').run(statementId);
            if (deleted.changes > 0) {
                console.log(`  Deleted ${deleted.changes} old transactions`);
            }

            // 8. Insert transactions
            const insertTx = db.prepare(`INSERT INTO transactions
                (id, date, description, amount, balance, category, statement_id, user_id, is_transfer, gst_applicable, transaction_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`);

            const insertMany = db.transaction((txs: typeof transactions) => {
                for (const tx of txs) {
                    const txId = crypto.randomUUID();
                    const txHash = crypto.createHash('sha256')
                        .update(`${tx.date}|${tx.description}|${tx.amount}|`)
                        .digest('hex');
                    insertTx.run(
                        txId,
                        tx.date,
                        tx.description,
                        tx.amount,              // Already in cents from parser
                        tx.balance ?? null,      // Already in cents
                        null,                    // category - set by AI later
                        statementId,
                        userId,
                        txHash
                    );
                }
            });

            insertMany(transactions);
            console.log(`  Inserted: ${transactions.length} transactions`);

            // 9. Compute metadata
            const dates = transactions.map(t => t.date).filter(Boolean).sort();
            const opening = accountInfo.openingBalance ?? (transactions[0]?.balance ?? null);
            const closing = accountInfo.closingBalance ?? (transactions[transactions.length - 1]?.balance ?? null);

            // 10. Update statement metadata
            db.prepare(`UPDATE statements SET
                parsing_status='COMPLETED',
                ai_model_used='bank-regex-parser',
                transaction_count=?,
                period_start_date=?,
                period_end_date=?,
                opening_balance=?,
                closing_balance=?,
                is_complete=1,
                error_message=NULL,
                error_type=NULL
                WHERE id=?`).run(
                transactions.length,
                dates[0] || null,
                dates[dates.length - 1] || null,
                opening,
                closing,
                statementId
            );

            // Print summary
            const debits = transactions.filter(t => t.amount < 0);
            const credits = transactions.filter(t => t.amount > 0);
            const totalDebits = debits.reduce((s, t) => s + Math.abs(t.amount), 0);
            const totalCredits = credits.reduce((s, t) => s + t.amount, 0);

            console.log(`  Period: ${dates[0]} to ${dates[dates.length - 1]}`);
            console.log(`  Opening: $${opening ? (opening / 100).toFixed(2) : 'N/A'}, Closing: $${closing ? (closing / 100).toFixed(2) : 'N/A'}`);
            console.log(`  Debits: ${debits.length} ($${(totalDebits / 100).toFixed(2)}), Credits: ${credits.length} ($${(totalCredits / 100).toFixed(2)})`);

            totalStatementsProcessed++;
            totalTransactionsInserted += transactions.length;

        } catch (err: any) {
            console.error(`  ERROR: ${err.message}`);
            errors.push({ filename, error: err.message });

            // Try to update DB status
            try {
                db.prepare(`UPDATE statements SET parsing_status='FAILED', error_message=?, error_type='PARSE_ERROR' WHERE filename=?`)
                    .run(err.message, filename);
            } catch(e) {}
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`BATCH COMPLETE`);
    console.log(`  Statements processed: ${totalStatementsProcessed}`);
    console.log(`  Total transactions inserted: ${totalTransactionsInserted}`);
    if (errors.length > 0) {
        console.log(`  Errors: ${errors.length}`);
        errors.forEach(e => console.log(`    - ${e.filename}: ${e.error}`));
    }

    // Final summary from DB
    const allStmts = db.prepare('SELECT id, filename, parsing_status, transaction_count FROM statements ORDER BY filename').all() as any[];
    console.log(`\nDB Summary (${allStmts.length} statements):`);
    allStmts.forEach((s: any) => {
        console.log(`  ${s.filename}: ${s.parsing_status} (${s.transaction_count || 0} txs)`);
    });

    const totalTx = db.prepare('SELECT COUNT(*) as cnt FROM transactions').get() as any;
    console.log(`\nTotal transactions in DB: ${totalTx.cnt}`);

    db.close();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
