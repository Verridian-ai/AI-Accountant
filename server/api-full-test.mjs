/**
 * Full API test — hits every major endpoint and reports what works/fails
 * Run: node api-full-test.mjs
 */
const BASE = 'http://localhost:3501';

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!r.ok) throw new Error(`Login failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  
  // Extract tenantId from memberships
  const memberships = data.user?.memberships ?? data.memberships ?? [];
  const tenantId = data.tenantId 
    ?? memberships[0]?.tenant?.id 
    ?? memberships[0]?.tenantId
    ?? data.user?.tenantId;
  
  const token = data.token ?? data.accessToken;
  console.log(`✅ Login OK | token: ${token?.slice(0,20)}... | tenantId: ${tenantId}`);
  return { token, tenantId };
}

async function test(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✅ ${label}: ${result}`);
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message}`);
  }
}

async function get(url, token, tenantId) {
  const headers = { Authorization: `Bearer ${token}` };
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  const r = await fetch(`${BASE}${url}`, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  return data;
}

const { token, tenantId } = await login();

console.log('\n=== CORE DATA ENDPOINTS ===');
await test('GET /api/transactions?limit=5', async () => {
  const d = await get('/api/transactions?limit=5', token, tenantId);
  return `${d.total ?? d.transactions?.length ?? '?'} total, ${d.transactions?.length ?? 0} returned`;
});
await test('GET /api/accounts', async () => {
  const d = await get('/api/accounts', token, tenantId);
  const arr = Array.isArray(d) ? d : d.accounts ?? [];
  return `${arr.length} accounts`;
});
await test('GET /api/statements', async () => {
  const d = await get('/api/statements', token, tenantId);
  const arr = Array.isArray(d) ? d : d.statements ?? [];
  return `${arr.length} statements`;
});

console.log('\n=== TAX / BAS ENDPOINTS ===');
await test('GET /api/bas/quarters', async () => {
  const d = await get('/api/bas/quarters', token, tenantId);
  const arr = Array.isArray(d) ? d : d.quarters ?? d.periods ?? [];
  return `${arr.length} quarters`;
});
await test('GET /api/bas/history', async () => {
  const d = await get('/api/bas/history', token, tenantId);
  const arr = Array.isArray(d) ? d : d.history ?? d.periods ?? [];
  return `${arr.length} periods`;
});
await test('GET /api/tax/summary/2024-25', async () => {
  const d = await get('/api/tax/summary/2024-25', token, tenantId);
  return `grossIncome: ${d.grossIncome ?? d.gross_income ?? '?'}`;
});
await test('GET /api/tax/deductions/2024-25', async () => {
  const d = await get('/api/tax/deductions/2024-25', token, tenantId);
  const arr = Array.isArray(d) ? d : d.deductions ?? [];
  return `${arr.length} deductions`;
});

console.log('\n=== FINANCIAL ENDPOINTS ===');
await test('GET /api/invoices', async () => {
  const d = await get('/api/invoices', token, tenantId);
  const arr = Array.isArray(d) ? d : d.invoices ?? d.data ?? [];
  return `${arr.length} invoices`;
});
await test('GET /api/suppliers', async () => {
  const d = await get('/api/suppliers', token, tenantId);
  const arr = Array.isArray(d) ? d : d.suppliers ?? d.data ?? [];
  return `${arr.length} suppliers`;
});
await test('GET /api/bills', async () => {
  const d = await get('/api/bills', token, tenantId);
  const arr = Array.isArray(d) ? d : d.bills ?? d.data ?? [];
  return `${arr.length} bills`;
});
await test('GET /api/ledger/entries', async () => {
  const d = await get('/api/ledger/entries', token, tenantId);
  const arr = Array.isArray(d) ? d : d.entries ?? d.data ?? [];
  return `${arr.length} entries`;
});
await test('GET /api/chart-of-accounts', async () => {
  const d = await get('/api/chart-of-accounts', token, tenantId);
  const arr = Array.isArray(d) ? d : d.accounts ?? d.data ?? [];
  return `${arr.length} accounts`;
});

console.log('\n=== DASHBOARD / ANALYTICS ===');
await test('GET /api/dashboard/summary', async () => {
  const d = await get('/api/dashboard/summary', token, tenantId);
  return JSON.stringify(d).slice(0, 100);
});
await test('GET /api/financial-reports/profit-loss', async () => {
  const d = await get('/api/financial-reports/profit-loss', token, tenantId);
  return JSON.stringify(d).slice(0, 100);
});

console.log('\n=== HEALTH ===');
await test('GET /health', async () => {
  const d = await get('/health', token, null);
  return d.status ?? JSON.stringify(d).slice(0, 80);
});

console.log('\nDone.');
