# Agent-07: Wire misc.ts API Stubs — Part 2 (Matching, Reconciliation, Forecasts, Entities, Assets)

**Your role**: Replace stub functions in `client/src/api/misc.ts` with real fetch() calls for: matching, reconciliation, forecasts, entities, and assets APIs.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every client file change**: Run `cd client && npx tsc --noEmit` — must stay at 0 errors.

---

## CONTEXT

Same as Agent-06 — `client/src/api/misc.ts` has 130+ stubs. Agent-06 handles budgets/compliance/docs/knowledge. You handle matching/reconciliation/forecasts/entities/assets.

**Always use `API_URL` from `client/src/api/client.ts`** for base URL.
**Always use `getAuthHeaders()` from `client/src/api/client.ts`** for auth.

**Fetch pattern**:
```typescript
// Real fetch replacing a stub:
myFunction: async (params?: Type) => {
  const res = await fetch(`${API_URL}/endpoint`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`myFunction failed: ${res.status}`);
  return res.json();
},
```

---

## Part 2A: matchesApi stubs (payment matching)

**File**: `client/src/api/misc.ts` — find `matchesApi` object

**Server endpoint**: Check `server/src/routes/` for a matching route file. The payment matching system lives in `server/src/services/payment-matching/`. Look for a route that exposes it.

Check `server/src/routes/accounts.ts` or `server/src/routes/transfers.ts` for matching endpoints.
Check if there's `server/src/routes/merchant-ops.ts` which has reconciliation-alerts.

Wire what you can find:
```typescript
matchesApi: {
  list: async (params?: { status?: string; limit?: number }) => {
    const qp = new URLSearchParams();
    if (params?.status) qp.set('status', params.status);
    if (params?.limit) qp.set('limit', String(params.limit));
    const res = await fetch(`${API_URL}/matching?${qp}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`matches list failed: ${res.status}`);
    return res.json();
  },
  // add autoMatch, confirm, reject similarly
}
```

---

## Part 2B: reconApi stubs (bank reconciliation)

**File**: `client/src/api/misc.ts` — find `reconApi` object

**Server endpoint**: The `BankReconciliationService` (`server/src/services/bank-reconciliation/`) provides reconciliation. Look for what route exposes it.

Check `server/src/routes/` for a reconciliation route. It may be in accounts-ext or merchant-ops.

Wire available endpoints. For each stub method, confirm the server route exists first by reading the route file.

---

## Part 2C: forecastApi stubs (cash flow forecasting)

**File**: `client/src/api/misc.ts` — find `forecastApi` object (7 stubs)

**Server endpoint**: The cash flow forecasting service is `server/src/services/cash-flow-forecast/`. Look for the route that exposes it.

Check if `server/src/routes/analytics.ts` has `/cash-flow-forecast` endpoint. Check `server/src/routes/reports.ts` for forecast-related routes.

The `forecastApi` object has these stubs:
- `list` — get list of forecasts
- `getById` — get single forecast with periods
- `generate` — generate new forecast
- `archive` — archive a forecast
- `compare` — compare two forecasts
- `calculateAccuracy` — calculate forecast accuracy
- `updateActuals` — update actuals

Wire whichever have matching server routes:
```typescript
forecastApi: {
  list: async (params?: { archived?: boolean }) => {
    const qp = new URLSearchParams();
    if (params?.archived !== undefined) qp.set('archived', String(params.archived));
    const res = await fetch(`${API_URL}/analytics/cash-flow-forecast?${qp}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`forecast list failed: ${res.status}`);
    return res.json();
  },
  generate: async (params: { months?: number; model?: string }) => {
    const res = await fetch(`${API_URL}/analytics/cash-flow-forecast/generate`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`forecast generate failed: ${res.status}`);
    return res.json();
  },
  // wire others similarly
}
```

---

## Part 2D: entityApi stubs (multi-entity management)

**File**: `client/src/api/misc.ts` — find `entityApi` object (6 stubs)

**Server endpoint**: Check `server/src/routes/tenants/` or `server/src/routes/tenants.ts` for entity/multi-entity endpoints.

The entity concept may map to tenants (each tenant = entity in multi-company setups). If so:
```typescript
entityApi: {
  list: async () => {
    const res = await fetch(`${API_URL}/tenants`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`entity list failed: ${res.status}`);
    return res.json();
  },
  // other entity methods
}
```

---

## Part 2E: assetApi stubs (asset register & depreciation)

**File**: `client/src/api/misc.ts` — find `assetApi` object (5 stubs)

**Server endpoint**: Check `server/src/routes/` for an assets route file. Check the accounts route (assets may be a subset of accounts with type='asset').

If no dedicated asset route exists, leave stub with `// TODO: needs server route` comment.

---

## Part 2F: loanApi stubs

**File**: `client/src/api/misc.ts` — find `loanApi` object (5 stubs)

**Server endpoint**: The loan calculator is in `server/src/services/loan-calculator/`. Look for the route that exposes it.

Check `server/src/routes/accounts.ts` — loans may be in accounts with type='loan'.

---

## Part 2G: Admin dashboard stubs (fetchAgentConfigs, fetchAgentCosts, etc.)

**File**: `client/src/api/misc.ts` — lines ~209-270

**Server endpoints**: Check `server/src/routes/admin-ext.ts` for these endpoints.

Wire what you find:
```typescript
export const fetchAgentConfigs = async () => {
  const res = await fetch(`${API_URL}/admin/agent-configs`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`agent configs failed: ${res.status}`);
  return res.json();
};

export const fetchAgentCosts = async (params?: { startDate?: string; endDate?: string }) => {
  const qp = new URLSearchParams();
  if (params?.startDate) qp.set('startDate', params.startDate);
  if (params?.endDate) qp.set('endDate', params.endDate);
  const res = await fetch(`${API_URL}/admin/agent-costs?${qp}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`agent costs failed: ${res.status}`);
  return res.json();
};
```

---

## HOW TO APPROACH THIS

1. READ `client/src/api/misc.ts` — find all the stub objects you're responsible for
2. For EACH stub object/function:
   a. Check what server routes exist: read `server/src/routes/` files
   b. If the endpoint exists → wire the fetch() call
   c. If not → leave stub, add `// TODO: no server endpoint` comment
3. Run `cd client && npx tsc --noEmit` after every group of changes

---

## VERIFICATION

```bash
cd client && npx tsc --noEmit
```

Then commit:
```bash
git add client/src/api/misc.ts
git commit -m "fix(api): wire matching/reconciliation/forecast/entity/asset stubs to real endpoints"
```
