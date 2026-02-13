const Database = require('better-sqlite3');
const db = new Database('./sqlite.db');
const uid = '29110d3f-958e-4a96-8711-67caf328020d';

// 1. Transactions missing merchant_normalized - sample by category
console.log('=== SAMPLE MISSING MERCHANT_NORMALIZED (by category) ===');
const missingMerchant = db.prepare("SELECT category, description, amount, id FROM transactions WHERE user_id = ? AND (merchant_normalized IS NULL OR merchant_normalized = '') ORDER BY category, date").all(uid);
const byCat = {};
missingMerchant.forEach(t => {
  if (!byCat[t.category]) byCat[t.category] = [];
  if (byCat[t.category].length < 5) byCat[t.category].push({ desc: t.description, amount: t.amount });
});
console.log(JSON.stringify(byCat, null, 2));
console.log('Total missing merchant_normalized:', missingMerchant.length);

// 2. Afterpay transactions
console.log('\n=== AFTERPAY TRANSACTIONS ===');
const afterpay = db.prepare("SELECT id, date, description, amount, category, gst_category, gst_amount, merchant_normalized FROM transactions WHERE user_id = ? AND LOWER(description) LIKE '%afterpay%' ORDER BY date").all(uid);
console.log(JSON.stringify(afterpay, null, 2));
console.log('Total Afterpay:', afterpay.length);

// 3. Bizloan/BizLend transactions
console.log('\n=== BIZLOAN/BIZLEND TRANSACTIONS ===');
const loans = db.prepare("SELECT id, date, description, amount, category, gst_category, gst_amount, merchant_normalized FROM transactions WHERE user_id = ? AND (LOWER(description) LIKE '%bizloan%' OR LOWER(description) LIKE '%bizlend%' OR LOWER(description) LIKE '%biz loan%') ORDER BY date").all(uid);
console.log(JSON.stringify(loans, null, 2));
console.log('Total Loan txs:', loans.length);

// 4. Large transactions (potential car purchase, owner contributions)
console.log('\n=== LARGE TRANSACTIONS (abs > $5000) ===');
const large = db.prepare("SELECT id, date, description, amount, category, gst_category, merchant_normalized FROM transactions WHERE user_id = ? AND (amount > 500000 OR amount < -500000) ORDER BY amount ASC").all(uid);
console.log(JSON.stringify(large, null, 2));
console.log('Total large:', large.length);

// 5. Wage/salary transactions
console.log('\n=== WAGE/SALARY TRANSACTIONS (sample) ===');
const wages = db.prepare("SELECT id, date, description, amount, category, gst_category FROM transactions WHERE user_id = ? AND (LOWER(description) LIKE '%salary%' OR LOWER(description) LIKE '%wage%' OR LOWER(description) LIKE '%payroll%') ORDER BY date LIMIT 20").all(uid);
console.log(JSON.stringify(wages, null, 2));

// 6. Transfer transactions sample
console.log('\n=== TRANSFER TRANSACTIONS (sample) ===');
const transfers = db.prepare("SELECT id, date, description, amount, category, is_transfer, transfer_link_id FROM transactions WHERE user_id = ? AND category = 'Transfer' ORDER BY date LIMIT 30").all(uid);
console.log(JSON.stringify(transfers, null, 2));

// 7. Date range
console.log('\n=== DATE RANGE ===');
const dateRange = db.prepare("SELECT MIN(date) as earliest, MAX(date) as latest FROM transactions WHERE user_id = ?").get(uid);
console.log(JSON.stringify(dateRange));

// 8. Transactions per statement
console.log('\n=== TRANSACTIONS PER STATEMENT ===');
const perStmt = db.prepare("SELECT s.filename, s.period_start_date, s.period_end_date, COUNT(t.id) as tx_count FROM statements s LEFT JOIN transactions t ON t.statement_id = s.id WHERE s.user_id = ? GROUP BY s.id ORDER BY s.period_start_date").all(uid);
console.log(JSON.stringify(perStmt, null, 2));

// 9. Interest/finance charges
console.log('\n=== INTEREST/FINANCE CHARGES ===');
const interest = db.prepare("SELECT id, date, description, amount, category, gst_category FROM transactions WHERE user_id = ? AND (LOWER(description) LIKE '%interest%' OR LOWER(description) LIKE '%finance charge%') ORDER BY date").all(uid);
console.log(JSON.stringify(interest, null, 2));
console.log('Total interest txs:', interest.length);

// 10. Rent transactions
console.log('\n=== RENT TRANSACTIONS ===');
const rent = db.prepare("SELECT id, date, description, amount, category, gst_category FROM transactions WHERE user_id = ? AND category = 'Rent' ORDER BY date").all(uid);
console.log(JSON.stringify(rent, null, 2));

// 11. Fuel transactions
console.log('\n=== FUEL TRANSACTIONS ===');
const fuel = db.prepare("SELECT id, date, description, amount, category, gst_category, merchant_normalized FROM transactions WHERE user_id = ? AND (category = 'Fuel' OR LOWER(description) LIKE '%bp %' OR LOWER(description) LIKE '%shell%' OR LOWER(description) LIKE '%caltex%' OR LOWER(description) LIKE '%7-eleven%' OR LOWER(description) LIKE '%ampol%') ORDER BY date").all(uid);
console.log(JSON.stringify(fuel, null, 2));
console.log('Total fuel:', fuel.length);

// 12. Uncategorized/Miscellaneous check
console.log('\n=== CATEGORY DISTRIBUTION FULL ===');
const allCats = db.prepare("SELECT category, gst_category, COUNT(*) as count FROM transactions WHERE user_id = ? GROUP BY category, gst_category ORDER BY category, gst_category").all(uid);
console.log(JSON.stringify(allCats, null, 2));

db.close();

