#!/usr/bin/env node
/**
 * Test the transactions API endpoint to see if admin transactions are returned
 */

// First, we need to login as admin to get a JWT token
const BASE_URL = 'http://localhost:3501';

async function testTransactionsAPI() {
  console.log('Testing Transactions API...\n');

  // Step 1: Login as admin
  console.log('[1] Logging in as admin...');
  const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123',
    }),
  });

  if (!loginResponse.ok) {
    console.log(`❌ Login failed: ${loginResponse.status}`);
    const text = await loginResponse.text();
    console.log(text);
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  const tenants = loginData.tenants || [];
  const activeTenant = loginData.activeTenant;

  console.log(`  ✅ Logged in successfully`);
  console.log(`  Token: ${token.substring(0, 20)}...`);
  console.log(`  Tenants: ${tenants.length}`);
  if (activeTenant) {
    console.log(`  Active Tenant: ${activeTenant.tenant.name} (${activeTenant.tenant.id})`);
  }
  console.log();

  // Determine tenant ID to use
  let tenantId = null;
  if (activeTenant) {
    tenantId = activeTenant.tenant.id;
  } else if (tenants.length > 0) {
    tenantId = tenants[0].tenant.id;
  }

  if (!tenantId) {
    console.log('❌ No tenant found for admin user!');
    console.log('   Admin user needs to be part of a tenant to access transactions.');
    return;
  }

  // Step 2: Fetch transactions
  console.log(`[2] Fetching transactions for tenant ${tenantId}...`);
  const txnResponse = await fetch(`${BASE_URL}/api/transactions?limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
    },
  });

  if (!txnResponse.ok) {
    console.log(`❌ Fetch failed: ${txnResponse.status}`);
    const text = await txnResponse.text();
    console.log(text);
    return;
  }

  const txnData = await txnResponse.json();
  console.log(`  ✅ Response received`);
  console.log(`  Total transactions: ${txnData.total}`);
  console.log(`  Transactions in response: ${txnData.transactions.length}\n`);

  if (txnData.transactions.length > 0) {
    console.log('[3] Sample transactions:');
    txnData.transactions.slice(0, 5).forEach((txn, i) => {
      console.log(`  ${i + 1}. ${txn.date} - ${txn.description}`);
      console.log(`     Amount: $${(txn.amount / 100).toFixed(2)}`);
      console.log(`     Category: ${txn.category || 'Uncategorized'}`);
    });
  } else {
    console.log('❌ No transactions returned!');
    console.log('   The API is working but returning empty results.');
    console.log('   This suggests the transactions are not visible to the admin user.');
  }

  console.log();
  console.log('='.repeat(80));
  if (txnData.total > 0) {
    console.log('✅ SUCCESS: Transactions are visible in the API!');
  } else {
    console.log('❌ PROBLEM: No transactions found for admin user.');
    console.log('   Check if the user_id in the transactions table matches the admin user ID.');
  }
}

testTransactionsAPI().catch(console.error);

