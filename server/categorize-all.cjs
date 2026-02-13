/**
 * Bulk Rule-Based Transaction Categorizer
 *
 * Categorizes all 10,320 uncategorized transactions using pattern matching.
 * Uses the accounting chart-of-accounts categories from the client taxonomy
 * plus agent personal finance categories where no accounting category fits.
 *
 * Also sets gstCategory, gstAmount, gstApplicable, and merchantNormalized.
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'sqlite.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better write performance
db.pragma('journal_mode = WAL');

/** Calculate GST from inclusive amount (amount / 11) */
function gstFromInclusive(amountCents) {
  return Math.round(Math.abs(amountCents) / 11);
}

/**
 * Rules: [pattern (regex or string), category, gstCategory, merchantNormalized]
 * gstCategory: 'taxable_10' | 'gst_free' | 'input_taxed' | 'capital' | 'private'
 * Order matters — first match wins.
 */
const RULES = [
  // ============================================================
  // TRANSFERS (gst_free) — match first since very common
  // ============================================================
  [/transfer (to|from) .* wages/i, 'Wages & Salaries', 'gst_free', null],
  [/transfer (to|from) .* owner contribut/i, 'Other Income', 'gst_free', null],
  [/transfer (to|from) .* legal fee/i, 'Professional Fees', 'taxable_10', null],
  [/transfer (to|from) .* rent/i, 'Rent', 'taxable_10', null],
  [/transfer (to|from) .* amica beauty/i, 'Transfer', 'gst_free', 'Amica Beauty'],
  [/transfer (to|from) .* total beauty/i, 'Transfer', 'gst_free', 'Total Beauty'],
  [/transfer (to|from) .* coastal rental/i, 'Rent', 'taxable_10', 'Coastal Rental Trust'],
  [/transfer (to|from) xx\d{4}/i, 'Transfer', 'gst_free', null],
  [/transfer (to|from) .* payid/i, 'Transfer', 'gst_free', null],
  [/transfer (to|from) cba a\/c/i, 'Transfer', 'gst_free', null],
  [/transfer (to|from) other bank/i, 'Transfer', 'gst_free', null],
  [/transfer (to|from)/i, 'Transfer', 'gst_free', null],

  // ============================================================
  // BANK FEES & CHARGES (gst_free / input_taxed)
  // ============================================================
  [/unpaid (payment|netbank) fee/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/non cba atm withdrawal fee/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/cba merchant fee/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/^account fee$/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/overdraw fee/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/overdrawn fee/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/card payment fee/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/monthly card fee/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/international transaction fee/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/annual card fee/i, 'Bank Fees', 'input_taxed', 'CBA'],
  [/loan.*fee/i, 'Bank Fees', 'input_taxed', 'CBA'],

  // ============================================================
  // INTEREST (gst_free)
  // ============================================================
  [/debit excess interest/i, 'Interest Expense', 'gst_free', 'CBA'],
  [/credit interest/i, 'Interest Income', 'gst_free', 'CBA'],
  [/interest charged/i, 'Interest Expense', 'gst_free', 'CBA'],
  [/interest earned/i, 'Interest Income', 'gst_free', 'CBA'],
  [/loan pymt dishonour/i, 'Bank Fees', 'input_taxed', 'CBA'],

  // ============================================================
  // LOAN REPAYMENTS (gst_free)
  // ============================================================
  [/creditline.*bpay/i, 'Interest Expense', 'gst_free', 'CBA Creditline'],
  [/ezi\*moneyme/i, 'Interest Expense', 'gst_free', 'MoneyMe'],
  [/bizcap/i, 'Interest Expense', 'gst_free', 'Bizcap'],
  [/afterpay afterpay/i, 'Miscellaneous', 'taxable_10', 'Afterpay'],

  // ============================================================
  // UTILITIES (taxable_10)
  // ============================================================
  [/agl sales/i, 'Utilities', 'taxable_10', 'AGL Energy'],
  [/energyaustralia/i, 'Utilities', 'taxable_10', 'EnergyAustralia'],
  [/origin energy/i, 'Utilities', 'taxable_10', 'Origin Energy'],
  [/sydney water/i, 'Utilities', 'taxable_10', 'Sydney Water'],
  [/shoalhaven water/i, 'Utilities', 'taxable_10', 'Shoalhaven Water'],
  [/wcc whytes gully/i, 'Utilities', 'taxable_10', 'Wollongong City Council'],
  [/jj richards/i, 'Utilities', 'taxable_10', 'JJ Richards Waste'],

  // ============================================================
  // TELECOMMUNICATIONS (taxable_10)
  // ============================================================
  [/telstra/i, 'Telephone & Internet', 'taxable_10', 'Telstra'],
  [/optus/i, 'Telephone & Internet', 'taxable_10', 'Optus'],
  [/vodafone/i, 'Telephone & Internet', 'taxable_10', 'Vodafone'],
  [/tpg/i, 'Telephone & Internet', 'taxable_10', 'TPG'],
  [/iinet/i, 'Telephone & Internet', 'taxable_10', 'iiNet'],
  [/aussie broadband/i, 'Telephone & Internet', 'taxable_10', 'Aussie Broadband'],

  // ============================================================
  // INSURANCE (gst_free / input_taxed)
  // ============================================================
  [/nrma insurance/i, 'Insurance', 'input_taxed', 'NRMA Insurance'],
  [/nrma web/i, 'Insurance', 'input_taxed', 'NRMA'],
  [/budget direct/i, 'Insurance', 'input_taxed', 'Budget Direct'],
  [/pet insurance/i, 'Insurance', 'input_taxed', 'Pet Insurance'],
  [/allianz/i, 'Insurance', 'input_taxed', 'Allianz'],
  [/qbe insurance/i, 'Insurance', 'input_taxed', 'QBE Insurance'],
  [/youi/i, 'Insurance', 'input_taxed', 'Youi'],
  [/suncorp.*insurance/i, 'Insurance', 'input_taxed', 'Suncorp Insurance'],
  [/real insurance/i, 'Insurance', 'input_taxed', 'Real Insurance'],

  // ============================================================
  // SUBSCRIPTIONS & SOFTWARE (taxable_10)
  // ============================================================
  [/adobe/i, 'Subscriptions', 'taxable_10', 'Adobe'],
  [/google storage/i, 'Subscriptions', 'taxable_10', 'Google Storage'],
  [/google youtube/i, 'Subscriptions', 'taxable_10', 'YouTube Premium'],
  [/google nest/i, 'Subscriptions', 'taxable_10', 'Google Nest'],
  [/google one/i, 'Subscriptions', 'taxable_10', 'Google One'],
  [/google play/i, 'Subscriptions', 'taxable_10', 'Google Play'],
  [/netflix/i, 'Subscriptions', 'taxable_10', 'Netflix'],
  [/spotify/i, 'Subscriptions', 'taxable_10', 'Spotify'],
  [/disney\+/i, 'Subscriptions', 'taxable_10', 'Disney+'],
  [/amazon prime/i, 'Subscriptions', 'taxable_10', 'Amazon Prime'],
  [/stan\.com/i, 'Subscriptions', 'taxable_10', 'Stan'],
  [/kayo sports/i, 'Subscriptions', 'taxable_10', 'Kayo Sports'],
  [/binge/i, 'Subscriptions', 'taxable_10', 'Binge'],
  [/paramount\+/i, 'Subscriptions', 'taxable_10', 'Paramount+'],
  [/paypal \*apple/i, 'Subscriptions', 'taxable_10', 'Apple'],
  [/apple\.com\/bill/i, 'Subscriptions', 'taxable_10', 'Apple'],
  [/vagaro/i, 'Subscriptions', 'taxable_10', 'Vagaro'],
  [/intuit quickbooks/i, 'Subscriptions', 'taxable_10', 'QuickBooks'],
  [/xero/i, 'Subscriptions', 'taxable_10', 'Xero'],
  [/canva/i, 'Subscriptions', 'taxable_10', 'Canva'],
  [/microsoft/i, 'Subscriptions', 'taxable_10', 'Microsoft'],
  [/newbook accom/i, 'Subscriptions', 'taxable_10', 'Newbook'],

  // ============================================================
  // MOTOR VEHICLE & TRANSPORT (taxable_10)
  // ============================================================
  [/figtree fuel/i, 'Motor Vehicle Expenses', 'taxable_10', 'Figtree Fuel'],
  [/7[- ]?eleven/i, 'Motor Vehicle Expenses', 'taxable_10', '7-Eleven'],
  [/linkt/i, 'Motor Vehicle Expenses', 'taxable_10', 'Linkt Tolls'],
  [/e-?way/i, 'Motor Vehicle Expenses', 'taxable_10', 'E-Way Tolls'],
  [/caltex/i, 'Motor Vehicle Expenses', 'taxable_10', 'Caltex'],
  [/ampol/i, 'Motor Vehicle Expenses', 'taxable_10', 'Ampol'],
  [/bp\s/i, 'Motor Vehicle Expenses', 'taxable_10', 'BP'],
  [/shell\s/i, 'Motor Vehicle Expenses', 'taxable_10', 'Shell'],
  [/united petroleum/i, 'Motor Vehicle Expenses', 'taxable_10', 'United Petroleum'],
  [/uber\s(?!eats)/i, 'Motor Vehicle Expenses', 'taxable_10', 'Uber'],
  [/didi\s/i, 'Motor Vehicle Expenses', 'taxable_10', 'DiDi'],
  [/nrma.*(?!insurance)/i, null, null, null], // skip - handled above

  // ============================================================
  // GROCERIES & SUPERMARKETS (taxable_10)
  // ============================================================
  [/woolworths/i, 'Miscellaneous', 'taxable_10', 'Woolworths'],
  [/coles\s/i, 'Miscellaneous', 'taxable_10', 'Coles'],
  [/aldi\s/i, 'Miscellaneous', 'taxable_10', 'ALDI'],
  [/iga\s/i, 'Miscellaneous', 'taxable_10', 'IGA'],
  [/costco/i, 'Miscellaneous', 'taxable_10', 'Costco'],
  [/harris farm/i, 'Miscellaneous', 'taxable_10', 'Harris Farm'],

  // ============================================================
  // DINING & FOOD (taxable_10)
  // ============================================================
  [/uber.*eats/i, 'Entertainment', 'taxable_10', 'Uber Eats'],
  [/paypal.*ubereats/i, 'Entertainment', 'taxable_10', 'Uber Eats'],
  [/doordash/i, 'Entertainment', 'taxable_10', 'DoorDash'],
  [/menulog/i, 'Entertainment', 'taxable_10', 'Menulog'],
  [/mcdonald/i, 'Entertainment', 'taxable_10', 'McDonalds'],
  [/kfc\s/i, 'Entertainment', 'taxable_10', 'KFC'],
  [/subway\s/i, 'Entertainment', 'taxable_10', 'Subway'],
  [/domino/i, 'Entertainment', 'taxable_10', 'Dominos'],
  [/pizza/i, 'Entertainment', 'taxable_10', 'Pizza'],
  [/starbucks/i, 'Entertainment', 'taxable_10', 'Starbucks'],
  [/coffee/i, 'Entertainment', 'taxable_10', null],
  [/figtree hotel/i, 'Entertainment', 'taxable_10', 'Figtree Hotel'],
  [/collegians/i, 'Entertainment', 'taxable_10', 'Collegians RLFC'],
  [/illawarra master/i, 'Entertainment', 'taxable_10', 'Illawarra Master Builders Club'],
  [/hotel\s/i, 'Entertainment', 'taxable_10', null],
  [/tavern/i, 'Entertainment', 'taxable_10', null],
  [/club\s/i, 'Entertainment', 'taxable_10', null],
  [/pub\s/i, 'Entertainment', 'taxable_10', null],
  [/bar\s/i, 'Entertainment', 'taxable_10', null],
  [/bakery/i, 'Entertainment', 'taxable_10', null],
  [/cafe/i, 'Entertainment', 'taxable_10', null],
  [/sushi/i, 'Entertainment', 'taxable_10', null],
  [/thai\s/i, 'Entertainment', 'taxable_10', null],
  [/chinese/i, 'Entertainment', 'taxable_10', null],
  [/kebab/i, 'Entertainment', 'taxable_10', null],
  [/chicken/i, 'Entertainment', 'taxable_10', null],
  [/hungry jack/i, 'Entertainment', 'taxable_10', 'Hungry Jacks'],
  [/guzman/i, 'Entertainment', 'taxable_10', 'Guzman y Gomez'],
  [/nando/i, 'Entertainment', 'taxable_10', 'Nandos'],

  // ============================================================
  // HEALTH & MEDICAL (gst_free)
  // ============================================================
  [/capital chemist/i, 'Miscellaneous', 'gst_free', 'Capital Chemist'],
  [/chemist/i, 'Miscellaneous', 'gst_free', null],
  [/pharmacy/i, 'Miscellaneous', 'gst_free', null],
  [/priceline/i, 'Miscellaneous', 'gst_free', 'Priceline Pharmacy'],
  [/medibank/i, 'Insurance', 'input_taxed', 'Medibank'],
  [/bupa/i, 'Insurance', 'input_taxed', 'Bupa'],
  [/hcf\s/i, 'Insurance', 'input_taxed', 'HCF'],
  [/doctor/i, 'Miscellaneous', 'gst_free', null],
  [/dental/i, 'Miscellaneous', 'gst_free', null],
  [/physio/i, 'Miscellaneous', 'gst_free', null],
  [/medical/i, 'Miscellaneous', 'gst_free', null],
  [/health/i, 'Miscellaneous', 'gst_free', null],

  // ============================================================
  // EDUCATION & CHILDCARE (gst_free)
  // ============================================================
  [/flexischools/i, 'Miscellaneous', 'gst_free', 'Flexischools'],
  [/munchmonitor/i, 'Miscellaneous', 'gst_free', 'Munchmonitor'],
  [/schoolsonline|0schoolsonline/i, 'Miscellaneous', 'gst_free', 'SchoolsOnline'],
  [/school\s/i, 'Miscellaneous', 'gst_free', null],
  [/childcare/i, 'Miscellaneous', 'gst_free', null],

  // ============================================================
  // PROFESSIONAL FEES (taxable_10)
  // ============================================================
  [/equifax/i, 'Professional Fees', 'taxable_10', 'Equifax'],
  [/foye legal/i, 'Professional Fees', 'taxable_10', 'Foye Legal'],
  [/lawyer/i, 'Professional Fees', 'taxable_10', null],
  [/legal\s/i, 'Professional Fees', 'taxable_10', null],
  [/accountant/i, 'Professional Fees', 'taxable_10', null],
  [/bookkeep/i, 'Professional Fees', 'taxable_10', null],

  // ============================================================
  // ADVERTISING & MARKETING (taxable_10)
  // ============================================================
  [/rural press.*acm/i, 'Advertising & Marketing', 'taxable_10', 'Rural Press ACM'],
  [/facebook/i, 'Advertising & Marketing', 'taxable_10', 'Facebook/Meta'],
  [/google ads/i, 'Advertising & Marketing', 'taxable_10', 'Google Ads'],
  [/instagram/i, 'Advertising & Marketing', 'taxable_10', 'Instagram'],

  // ============================================================
  // BEAUTY / BUSINESS SUPPLIES (taxable_10) - Amica Beauty context
  // ============================================================
  [/inskin cosmedics/i, 'Cost of Goods Sold', 'taxable_10', 'Inskin Cosmedics'],
  [/hair.*beauty collect/i, 'Cost of Goods Sold', 'taxable_10', 'Hair & Beauty Collective'],
  [/beauty\s/i, 'Cost of Goods Sold', 'taxable_10', null],
  [/salon/i, 'Cost of Goods Sold', 'taxable_10', null],

  // ============================================================
  // RETAIL / SHOPPING (taxable_10)
  // ============================================================
  [/big\s*w/i, 'Miscellaneous', 'taxable_10', 'Big W'],
  [/kmart/i, 'Miscellaneous', 'taxable_10', 'Kmart'],
  [/target\s/i, 'Miscellaneous', 'taxable_10', 'Target'],
  [/bunnings/i, 'Repairs & Maintenance', 'taxable_10', 'Bunnings'],
  [/officeworks/i, 'Office Supplies', 'taxable_10', 'Officeworks'],
  [/jb hi-?fi/i, 'Computer & IT', 'taxable_10', 'JB Hi-Fi'],

  // ============================================================
  // INCOME PATTERNS (credits)
  // ============================================================
  [/^pos\s\d+/i, 'Sales Revenue', 'taxable_10', 'EFTPOS Sale'],
  [/cash deposit/i, 'Sales Revenue', 'taxable_10', 'Cash Deposit'],
  [/refund purchase/i, 'Miscellaneous', 'taxable_10', null],
  [/^refund/i, 'Miscellaneous', 'taxable_10', null],

  // ============================================================
  // GOVERNMENT & TAX (gst_free)
  // ============================================================
  [/ato\s/i, 'Miscellaneous', 'gst_free', 'ATO'],
  [/centrelink/i, 'Other Income', 'gst_free', 'Centrelink'],
  [/family tax/i, 'Other Income', 'gst_free', 'Centrelink FTB'],
  [/child care sub/i, 'Other Income', 'gst_free', 'Child Care Subsidy'],

  // ============================================================
  // BPAY catch-all (taxable_10 default for unmatched BPAY)
  // ============================================================
  [/bpay/i, 'Miscellaneous', 'taxable_10', null],

  // ============================================================
  // DIRECT DEBIT catch-all
  // ============================================================
  [/direct debit/i, 'Miscellaneous', 'taxable_10', null],

  // ============================================================
  // PAYPAL catch-all
  // ============================================================
  [/paypal/i, 'Miscellaneous', 'taxable_10', null],

  // ============================================================
  // ATM
  // ============================================================
  [/atm withdrawal/i, 'Miscellaneous', 'gst_free', 'ATM'],
  [/atm\s/i, 'Miscellaneous', 'gst_free', 'ATM'],
];

// ============================================================
// MAIN EXECUTION
// ============================================================

console.log('=== Transaction Categorization Script ===\n');

// Get all uncategorized transactions
const uncategorized = db.prepare(`
  SELECT id, description, amount
  FROM transactions
  WHERE category IS NULL OR category = '' OR category = 'Uncategorized'
`).all();

console.log(`Found ${uncategorized.length} uncategorized transactions\n`);

// Prepare update statement (snake_case column names)
const updateStmt = db.prepare(`
  UPDATE transactions
  SET category = ?,
      gst_category = ?,
      gst_amount = ?,
      gst_applicable = ?,
      merchant_normalized = COALESCE(?, merchant_normalized),
      confidence_score = 0.75
  WHERE id = ?
`);

// Process in a transaction for speed
const stats = { categorized: 0, uncategorized: 0, byCategory: {} };

const runBatch = db.transaction(() => {
  for (const tx of uncategorized) {
    const desc = tx.description || '';
    let matched = false;

    for (const [pattern, category, gstCategory, merchant] of RULES) {
      // Skip null rules (used for ordering/skip logic)
      if (category === null) continue;

      const isMatch = pattern instanceof RegExp
        ? pattern.test(desc)
        : desc.toLowerCase().includes(pattern.toLowerCase());

      if (isMatch) {
        const gstAmount = gstCategory === 'taxable_10'
          ? gstFromInclusive(tx.amount)
          : 0;
        const gstApplicable = gstCategory === 'taxable_10' || gstCategory === 'capital' ? 1 : 0;

        updateStmt.run(
          category,
          gstCategory,
          gstAmount,
          gstApplicable,
          merchant, // may be null
          tx.id
        );

        stats.categorized++;
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        matched = true;
        break;
      }
    }

    if (!matched) {
      stats.uncategorized++;
    }
  }
});

runBatch();

// Print results
console.log('=== RESULTS ===');
console.log(`Categorized: ${stats.categorized} / ${uncategorized.length}`);
console.log(`Still uncategorized: ${stats.uncategorized}`);
console.log(`Coverage: ${((stats.categorized / uncategorized.length) * 100).toFixed(1)}%\n`);

console.log('=== BY CATEGORY ===');
const sorted = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);
for (const [cat, count] of sorted) {
  console.log(`  ${String(count).padStart(5)}  ${cat}`);
}

// Show remaining uncategorized samples
if (stats.uncategorized > 0) {
  const remaining = db.prepare(`
    SELECT description, COUNT(*) as cnt
    FROM transactions
    WHERE category IS NULL OR category = '' OR category = 'Uncategorized'
    GROUP BY description
    ORDER BY cnt DESC
    LIMIT 30
  `).all();

  console.log(`\n=== TOP 30 STILL UNCATEGORIZED ===`);
  for (const r of remaining) {
    console.log(`  ${String(r.cnt).padStart(5)}  ${r.description}`);
  }
}

// Also mark transfers with is_transfer = 1
const transferUpdate = db.prepare(`
  UPDATE transactions SET is_transfer = 1
  WHERE category = 'Transfer' AND is_transfer = 0
`);
const tfResult = transferUpdate.run();
console.log(`\nMarked ${tfResult.changes} transactions as is_transfer=1`);

db.close();
console.log('\nDone!');
