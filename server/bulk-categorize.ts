/**
 * Bulk Transaction Categorization Script
 *
 * Uses Cognee merchant knowledge + Gemini Flash for fast batch categorization.
 * Processes unique descriptions first, then applies to all matching transactions.
 *
 * Run: npx tsx server/bulk-categorize.ts
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import OpenAI from 'openai';

const DB_PATH = './sqlite.db';
const BATCH_SIZE = 50;
const PAUSE_MS = 1000;
const API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || process.env.AI_API_KEY;

const CATEGORIES = [
  'Sales Revenue', 'Service Revenue', 'Interest Income', 'Other Income', 'Export Revenue',
  'Cost of Goods Sold', 'Direct Labour', 'Freight Costs',
  'Advertising & Marketing', 'Bank Fees', 'Computer & IT', 'Depreciation',
  'Entertainment', 'Insurance', 'Interest Expense', 'Motor Vehicle Expenses',
  'Office Supplies', 'Professional Fees', 'Rent', 'Repairs & Maintenance',
  'Subscriptions', 'Telephone & Internet', 'Travel', 'Utilities',
  'Wages & Salaries', 'Superannuation', 'Work from Home Expenses', 'Miscellaneous',
  'Transfer', 'Groceries', 'Dining & Takeaway', 'Transport', 'Fuel',
  'Medical & Health', 'Education', 'Clothing & Personal', 'Cash Withdrawal',
];

const GST_FREE_CATS = new Set([
  'Bank Fees', 'Insurance', 'Interest Expense', 'Interest Income',
  'Wages & Salaries', 'Superannuation', 'Transfer', 'Cash Withdrawal',
  'Medical & Health', 'Education', 'Work from Home Expenses',
  'Depreciation', 'Direct Labour',
]);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== Bulk Transaction Categorization (Gemini Flash) ===\n');

  if (!API_KEY) {
    console.error('FATAL: No API key found. Set OPENROUTER_API_KEY or VITE_OPENROUTER_API_KEY in .env');
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const { total } = db.prepare(
    "SELECT COUNT(*) as total FROM transactions WHERE category = 'Miscellaneous' OR category IS NULL OR category = ''"
  ).get() as { total: number };
  console.log(`Transactions to re-categorize: ${total}`);
  if (total === 0) { console.log('Done!'); return; }

  // Get unique descriptions
  const uniques = db.prepare(
    "SELECT DISTINCT description FROM transactions WHERE category = 'Miscellaneous' OR category IS NULL OR category = ''"
  ).all() as Array<{ description: string }>;
  console.log(`Unique descriptions: ${uniques.length}\n`);

  // AI batch categorization
  const remaining = uniques;
  console.log(`--- AI Batch Categorization (${remaining.length} descriptions) ---`);

  const client = new OpenAI({
    apiKey: API_KEY,
    baseURL: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const aiMap = new Map<string, { category: string; gst: boolean; notes: string }>();
  const batches = [];
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    batches.push(remaining.slice(i, i + BATCH_SIZE));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const txList = batch.map((d, i) => ({ idx: i, description: d.description }));

    try {
      console.log(`Batch ${bi + 1}/${batches.length} (${batch.length} items)...`);
      const response = await client.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: `You are an Australian bank transaction categorizer for a small business.

Categorize each transaction into EXACTLY one of these categories:
${CATEGORIES.filter(c => c !== 'Miscellaneous').join(', ')}

IMPORTANT RULES:
- NEVER use "Miscellaneous". Always pick the BEST matching category.
- "Direct Debit" with "Autopay" or loan refs = "Interest Expense" (loan repayments)
- "AFTERPAY" = "Subscriptions" (buy-now-pay-later)
- "KMART", "BIG W", "TARGET", "DUSK" = "Clothing & Personal" (retail)
- "LIQUORLAND" = "Entertainment"
- "SERVICE NSW" = "Professional Fees" (government fees)
- "LEAS" in description = "Rent" (equipment lease)
- "PAYPAL" = categorize by merchant name after PAYPAL*
- "Return" prefix = same category as original transaction

Transactions:
${txList.map(t => `${t.idx}. "${t.description}"`).join('\n')}

Return JSON: {"results": [{"idx": 0, "category": "...", "gst": true/false, "notes": "1-3 words"}]}
- gst=true for standard business expenses, gst=false for bank fees, insurance, interest, wages, super, transfers, medical, education`
        }],
      });

      const raw = response.choices[0]?.message?.content || '{"results":[]}';
      const parsed = JSON.parse(raw);
      if (parsed.results) {
        for (const r of parsed.results) {
          const desc = batch[r.idx]?.description;
          if (desc && r.category && r.category !== 'Miscellaneous') {
            aiMap.set(desc, { category: r.category, gst: r.gst ?? !GST_FREE_CATS.has(r.category), notes: r.notes || '' });
          }
        }
      }
      console.log(`  +${parsed.results?.length || 0} categorized (AI total: ${aiMap.size})`);
    } catch (err: any) {
      console.error(`  Batch ${bi + 1} FAILED: ${err.message}`);
    }

    if (bi < batches.length - 1) await sleep(PAUSE_MS);
  }

  // Step 2: Apply to DB
  console.log(`\n--- Applying to ${total} transactions ---`);
  console.log(`Unique categorizations: ${aiMap.size}`);

  const updateStmt = db.prepare(`
    UPDATE transactions SET
      category = ?, gst_applicable = ?, gst_category = ?, gst_amount = ?,
      merchant_normalized = ?, ai_reasoning_notes = ?, confidence_score = ?
    WHERE id = ?
  `);

  const allMisc = db.prepare(
    "SELECT id, description, amount FROM transactions WHERE category = 'Miscellaneous' OR category IS NULL OR category = ''"
  ).all() as Array<{ id: string; description: string; amount: number }>;

  let updated = 0, skipped = 0;
  const updateAll = db.transaction((txs: typeof allMisc) => {
    for (const tx of txs) {
      const m = aiMap.get(tx.description);
      if (m) {
        const gstFree = GST_FREE_CATS.has(m.category);
        const gstAmt = gstFree ? 0 : Math.round(Math.abs(tx.amount) / 11);
        updateStmt.run(
          m.category, gstFree ? 0 : 1,
          gstFree ? 'gst_free' : 'taxable_10', gstAmt,
          tx.description.substring(0, 40),
          'notes' in m ? (m as any).notes : '',
          0.75, tx.id
        );
        updated++;
      } else {
        skipped++;
      }
    }
  });
  updateAll(allMisc);

  // Results
  console.log(`\n=== Results ===`);
  console.log(`Re-categorized: ${updated}`);
  console.log(`Still Miscellaneous: ${skipped}`);

  const topCats = db.prepare(`
    SELECT category, COUNT(*) as cnt FROM transactions
    WHERE category IS NOT NULL GROUP BY category ORDER BY cnt DESC LIMIT 20
  `).all() as any[];
  console.log('\n--- Category Distribution ---');
  for (const c of topCats) {
    console.log(`  ${c.category.padEnd(30)} ${c.cnt}`);
  }

  console.log('\nDone!');
  db.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
