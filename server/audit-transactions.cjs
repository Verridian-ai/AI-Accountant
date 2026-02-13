const Database = require('better-sqlite3');
const db = new Database('./sqlite.db');

// Debug: check what's in the database
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('=== TABLES ===');
console.log(tables.map(t => t.name).join(', '));

const totalTx = db.prepare('SELECT COUNT(*) as c FROM transactions').get();
console.log('\n=== TOTAL TX IN DB:', totalTx.c, '===');

const userIds = db.prepare('SELECT DISTINCT user_id FROM transactions').all();
console.log('\n=== USER IDS IN TRANSACTIONS ===');
console.log(JSON.stringify(userIds, null, 2));

const stmtUserIds = db.prepare('SELECT DISTINCT user_id FROM statements').all();
console.log('\n=== USER IDS IN STATEMENTS ===');
console.log(JSON.stringify(stmtUserIds, null, 2));

const users = db.prepare('SELECT id, username FROM users').all();
console.log('\n=== USERS ===');
console.log(JSON.stringify(users, null, 2));

// Now get the actual user_id from the data
if (userIds.length > 0) {
    const uid = userIds[0].user_id;
    console.log('\n=== Using user_id:', uid, '===');

    // 1. All transactions
    const txs = db.prepare('SELECT id, date, description, amount, balance, category, gst_category, gst_amount, merchant_normalized, is_transfer, transfer_link_id, statement_id, account_id FROM transactions WHERE user_id = ? ORDER BY date ASC').all(uid);
    console.log('\n=== TOTAL TRANSACTIONS:', txs.length, '===');
    console.log(JSON.stringify(txs, null, 2));

    // 2. Statements
    const stmts = db.prepare('SELECT * FROM statements WHERE user_id = ?').all(uid);
    console.log('\n=== STATEMENTS ===');
    console.log(JSON.stringify(stmts, null, 2));

    // 3. Accounts
    const accts = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(uid);
    console.log('\n=== ACCOUNTS ===');
    console.log(JSON.stringify(accts, null, 2));

    // 4. Category summary
    const cats = db.prepare("SELECT category, COUNT(*) as count, SUM(amount) as total FROM transactions WHERE user_id = ? GROUP BY category ORDER BY count DESC").all(uid);
    console.log('\n=== CATEGORY SUMMARY ===');
    console.log(JSON.stringify(cats, null, 2));

    // 5. Null/missing fields
    const nullCat = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND (category IS NULL OR category = '' OR category = 'Uncategorized' OR category = 'Miscellaneous')").get(uid);
    console.log('\n=== NULL/MISSING CATEGORIES:', nullCat.count, '===');

    const nullMerchant = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND (merchant_normalized IS NULL OR merchant_normalized = '')").get(uid);
    console.log('=== NULL MERCHANT_NORMALIZED:', nullMerchant.count, '===');

    const nullGst = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND (gst_category IS NULL OR gst_category = '')").get(uid);
    console.log('=== NULL GST_CATEGORY:', nullGst.count, '===');
} else {
    console.log('\n=== NO TRANSACTIONS FOUND IN DATABASE ===');
}

db.close();

