# Agent-06: Wire misc.ts API Stubs — Part 1 (Budgets, Compliance, Documents, Knowledge)

**Your role**: Replace stub functions in `client/src/api/misc.ts` with real fetch() calls for: budgets, anomaly/compliance, documents, and knowledge/cognee APIs.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every client file change**: Run `cd client && npx tsc --noEmit` — must stay at 0 errors.

---

## CONTEXT: The Stub Problem

`client/src/api/misc.ts` contains 130+ functions that return `Promise.resolve({})` or `Promise.resolve([])` — no real fetch() calls. This causes 15+ feature tabs to show completely blank/empty data.

Your job is to replace the stubs with real fetch() calls that hit existing server endpoints.

**Always use `API_URL` from `client/src/api/client.ts`** for the base URL.
**Always pass `getAuthHeaders()` from `client/src/api/client.ts`** for auth headers.

**Pattern for every stub replacement**:
```typescript
// BEFORE (stub):
fetchSomething: async (..._args: any[]) => Promise.resolve({} as any),

// AFTER (real fetch):
fetchSomething: async (params?: SomeType) => {
  const res = await fetch(`${API_URL}/some-endpoint`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`fetchSomething failed: ${res.status}`);
  return res.json();
},
```

---

## Part 1A: budgetsApi stubs

**File**: `client/src/api/misc.ts` — find `budgetsApi` object (lines ~88-96 approx)

The server has a budgets route mounted at `/api` (not `/api/budgets`). Check what routes exist:
- Read `server/src/routes/budgets.ts` to see what endpoints are available
- The budget route currently only has `POST /debt-recommendations`
- For missing endpoints (like list, create, update budgets), check `server/src/routes/` for any budget-related files

If the server route doesn't exist for a specific function, leave that stub as-is and add a `// TODO: needs server endpoint` comment.

**Common budget endpoints to wire** (verify these exist in the server):
```typescript
budgetsApi: {
  list: async (params?: { year?: number; month?: number }) => {
    const qp = new URLSearchParams();
    if (params?.year) qp.set('year', String(params.year));
    if (params?.month) qp.set('month', String(params.month));
    const res = await fetch(`${API_URL}/budgets?${qp}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`budgets list failed: ${res.status}`);
    return res.json();
  },
  // wire other methods similarly
}
```

---

## Part 1B: anomalyApi stubs

**File**: `client/src/api/misc.ts` — find `anomalyApi` object

**Server endpoint**: `server/src/routes/analytics.ts` contains anomaly-related routes. Check what's available.

Also check: `server/src/routes/tax.ts` may have anomaly/review endpoints.

Wire the stubs:
```typescript
anomalyApi: {
  list: async (params?: { limit?: number; offset?: number }) => {
    const qp = new URLSearchParams();
    if (params?.limit) qp.set('limit', String(params.limit));
    if (params?.offset) qp.set('offset', String(params.offset));
    const res = await fetch(`${API_URL}/analytics/anomalies?${qp}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`anomaly list failed: ${res.status}`);
    return res.json();
  },
  stats: async () => {
    const res = await fetch(`${API_URL}/analytics/anomalies/stats`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`anomaly stats failed: ${res.status}`);
    return res.json();
  },
  // acknowledge, resolve, dismiss — POST requests:
  acknowledge: async (id: string) => {
    const res = await fetch(`${API_URL}/analytics/anomalies/${id}/acknowledge`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`anomaly acknowledge failed: ${res.status}`);
    return res.json();
  },
  // add resolve and dismiss similarly
}
```

---

## Part 1C: complianceApi stubs

**File**: `client/src/api/misc.ts` — find `complianceApi` object

**Server endpoint**: Check `server/src/routes/tax.ts` and `server/src/routes/tax-ext/` for compliance-related routes.

Also check if there's a compliance route file: `ls server/src/routes/ | grep compliance`

Wire the available ones. For any that have no server endpoint, leave stub with `// TODO: needs server endpoint` comment.

---

## Part 1D: documentsApi stubs

**File**: `client/src/api/misc.ts` — find `documentsApi` object

**Server endpoint**: Check if there's a documents route. Look for `server/src/routes/` files related to documents or OCR. Check `server/src/routes/pipeline.ts` or `server/src/routes/statements.ts`.

If server routes exist, wire them:
```typescript
documentsApi: {
  list: async (params?: { page?: number; status?: string }) => {
    const qp = new URLSearchParams();
    if (params?.page) qp.set('page', String(params.page));
    if (params?.status) qp.set('status', params.status);
    const res = await fetch(`${API_URL}/documents?${qp}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`documents list failed: ${res.status}`);
    return res.json();
  },
  // wire classify, process similarly
}
```

---

## Part 1E: knowledgeApi stubs

**File**: `client/src/api/misc.ts` — find `knowledgeApi` object

**Server endpoint**: `server/src/routes/cognee.ts` — this should have knowledge/cognee endpoints.

Check what routes cognee.ts provides. Wire accordingly:
```typescript
knowledgeApi: {
  search: async (query: string, searchType?: string) => {
    const res = await fetch(`${API_URL}/cognee/search`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, searchType: searchType ?? 'GRAPH_COMPLETION' }),
    });
    if (!res.ok) throw new Error(`knowledge search failed: ${res.status}`);
    return res.json();
  },
  // wire other knowledge methods
}
```

---

## Part 1F: Admin standalone stubs (fetchSystemHealth, fetchSystemMetrics, etc.)

**File**: `client/src/api/misc.ts` — lines ~199-271 (standalone stubs)

**Server endpoints**: Check `server/src/routes/admin-ext.ts` for admin endpoints.

Wire the health/metrics stubs:
```typescript
export const fetchSystemHealth = async () => {
  const res = await fetch(`${API_URL}/admin/system-health`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`system health failed: ${res.status}`);
  return res.json();
};

export const fetchSystemMetrics = async () => {
  const res = await fetch(`${API_URL}/admin/metrics`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`system metrics failed: ${res.status}`);
  return res.json();
};

export const fetchFeatureFlags = async () => {
  const res = await fetch(`${API_URL}/admin/feature-flags`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`feature flags failed: ${res.status}`);
  return res.json();
};
```

Check the admin routes file to confirm the exact endpoint paths before using them.

---

## HOW TO APPROACH THIS

1. READ `client/src/api/misc.ts` in full to see the current stubs
2. READ `client/src/api/client.ts` to get `API_URL` and `getAuthHeaders()` usage pattern
3. For EACH stub you want to wire, READ the corresponding server route to confirm the endpoint exists and understand its request/response shape
4. Replace the stub with a real fetch() call matching the server route
5. If the server endpoint doesn't exist — LEAVE THE STUB, add `// TODO: no server endpoint yet` comment
6. Run `cd client && npx tsc --noEmit` after each group of stubs

---

## VERIFICATION

```bash
cd client && npx tsc --noEmit
```

Then commit:
```bash
git add client/src/api/misc.ts
git commit -m "fix(api): wire budget/anomaly/compliance/docs/knowledge stubs to real endpoints"
```
