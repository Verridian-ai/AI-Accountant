/**
 * Bulk-index all existing transactions into Cognee knowledge graph.
 * Run after enabling USE_COGNEE=true in .env
 *
 * Usage: npx tsx index-cognee.ts
 */
import Database from 'better-sqlite3';
import path from 'path';

const COGNEE_API_URL = process.env.COGNEE_API_URL || 'http://localhost:8000';
const BATCH_SIZE = 200;

const dbPath = path.resolve('sqlite.db');
const db = new Database(dbPath);

async function addToCognee(data: string[], dataset: string): Promise<boolean> {
    try {
        const content = data.join('\n\n');
        const formData = new FormData();
        formData.append('data', new Blob([content], { type: 'text/plain' }), `${dataset}.txt`);
        formData.append('datasetName', dataset);

        const res = await fetch(`${COGNEE_API_URL}/api/v1/add`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
            console.error(`  Cognee add failed: ${res.status}`);
            return false;
        }
        return true;
    } catch (err: any) {
        console.error(`  Cognee add error: ${err.message}`);
        return false;
    }
}

async function cognify(datasets: string[]): Promise<void> {
    try {
        const res = await fetch(`${COGNEE_API_URL}/api/v1/cognify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                datasets,
                run_in_background: true,
                custom_prompt: 'Extract financial entities: merchant names, transaction categories, ABN numbers, GST registration status, payment methods, account references, recurring transaction patterns, and financial relationships between entities.',
            }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
            console.warn(`  Cognify failed: ${res.status}`);
        } else {
            console.log(`  Cognify triggered for: ${datasets.join(', ')}`);
        }
    } catch (err: any) {
        console.warn(`  Cognify error: ${err.message}`);
    }
}

async function main() {
    // Check Cognee health
    try {
        const health = await fetch(`${COGNEE_API_URL}/api/v1/settings`, { signal: AbortSignal.timeout(5000) });
        if (!health.ok) throw new Error(`Status ${health.status}`);
        console.log(`Cognee is healthy at ${COGNEE_API_URL}`);
    } catch (err: any) {
        console.error(`Cognee not reachable at ${COGNEE_API_URL}: ${err.message}`);
        process.exit(1);
    }

    // Get all transactions
    const allTxs = db.prepare(`
        SELECT t.date, t.description, t.amount, t.category, t.gst_applicable,
               s.filename, s.period_start_date, s.period_end_date
        FROM transactions t
        LEFT JOIN statements s ON t.statement_id = s.id
        ORDER BY t.date
    `).all() as any[];

    console.log(`Found ${allTxs.length} transactions to index\n`);

    // Index transactions in batches
    let indexed = 0;
    for (let i = 0; i < allTxs.length; i += BATCH_SIZE) {
        const batch = allTxs.slice(i, i + BATCH_SIZE);
        const lines = batch.map((tx: any) =>
            `Date: ${tx.date}, Description: ${tx.description}, Amount: $${(tx.amount / 100).toFixed(2)}, Category: ${tx.category || 'Uncategorized'}, GST: ${tx.gst_applicable ? 'Yes' : 'No'}`
        );

        process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allTxs.length / BATCH_SIZE)} (${batch.length} txs)... `);
        const ok = await addToCognee(lines, 'bank_transactions');
        if (ok) {
            indexed += batch.length;
            console.log('OK');
        } else {
            console.log('FAILED');
        }
    }

    console.log(`\nIndexed ${indexed}/${allTxs.length} transactions`);

    // Index statement metadata
    const stmts = db.prepare(`
        SELECT id, filename, period_start_date, period_end_date, opening_balance, closing_balance, transaction_count
        FROM statements WHERE transaction_count > 0
    `).all() as any[];

    console.log(`\nIndexing ${stmts.length} statement metadata records...`);
    const stmtLines = stmts.map((s: any) =>
        `Statement: ${s.filename}, Period: ${s.period_start_date || 'N/A'} to ${s.period_end_date || 'N/A'}, Opening: $${s.opening_balance ? (s.opening_balance / 100).toFixed(2) : 'N/A'}, Closing: $${s.closing_balance ? (s.closing_balance / 100).toFixed(2) : 'N/A'}, Transactions: ${s.transaction_count}`
    );
    const stmtOk = await addToCognee(stmtLines, 'bank_formats');
    console.log(stmtOk ? '  Statement metadata indexed' : '  Statement metadata indexing FAILED');

    // Trigger cognify for both datasets
    console.log('\nTriggering Cognee knowledge graph build...');
    await cognify(['bank_transactions', 'bank_formats']);

    console.log('\nDone! Cognee will build the knowledge graph in the background.');
    db.close();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
