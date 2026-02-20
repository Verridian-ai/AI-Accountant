# Agent-08: Tax/Analytics API Stubs + CSV Upload Pipeline

**Your role**: Fix 10 stubs in api/tax.ts, 4 stubs in api/analytics.ts, and wire the CSV parser into the upload pipeline.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every server change**: Run `cd server && npx tsc --noEmit`.
**After every client change**: Run `cd client && npx tsc --noEmit`.

---

## FIX 1: Wire 10 stubs in client/src/api/tax.ts

**File**: `client/src/api/tax.ts`
**Lines**: ~212-221

**Current stubs** (all return `Promise.resolve({} as any)` or `Promise.resolve([] as any[])`):
```typescript
fetchCompanyReturn: async (..._args: any[]) => Promise.resolve({} as any),
fetchPersonalReturn: async (..._args: any[]) => Promise.resolve({} as any),
fetchSoleTraderReturn: async (..._args: any[]) => Promise.resolve({} as any),
fetchTrustReturn: async (..._args: any[]) => Promise.resolve({} as any),
fetchStrategies: async (..._args: any[]) => Promise.resolve([] as any[]),
generateStrategies: async (..._args: any[]) => Promise.resolve({} as any),
updateStrategyStatus: async (..._args: any[]) => Promise.resolve({} as any),
scanEquity: async (..._args: any[]) => Promise.resolve({} as any),
confirmEquityEvent: async (..._args: any[]) => Promise.resolve({} as any),
fetchEquitySummary: async (..._args: any[]) => Promise.resolve({} as any),
```

**Step 1**: READ `server/src/routes/tax.ts` fully to understand what endpoints exist.
**Step 2**: READ `server/src/routes/tax-ext/` directory for additional tax routes.

Then wire each stub. For example:
```typescript
fetchCompanyReturn: async (year: number) => {
  const res = await fetch(`${API_URL}/tax/company-return/${year}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`fetchCompanyReturn failed: ${res.status}`);
  return res.json();
},

fetchPersonalReturn: async (year: number) => {
  const res = await fetch(`${API_URL}/tax/personal-return/${year}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`fetchPersonalReturn failed: ${res.status}`);
  return res.json();
},

fetchStrategies: async (year: number) => {
  const res = await fetch(`${API_URL}/tax/strategies?year=${year}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`fetchStrategies failed: ${res.status}`);
  return res.json() as Promise<any[]>;
},

generateStrategies: async (params: { year: number; income: number }) => {
  const res = await fetch(`${API_URL}/tax/strategies/generate`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`generateStrategies failed: ${res.status}`);
  return res.json();
},

updateStrategyStatus: async (id: string, status: string) => {
  const res = await fetch(`${API_URL}/tax/strategies/${id}/status`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`updateStrategyStatus failed: ${res.status}`);
  return res.json();
},
```

**IMPORTANT**: Use the EXACT endpoint paths from the server routes. Don't guess — READ the server route file first.

For stubs where there is NO server endpoint, leave stub with comment `// TODO: server endpoint at /api/tax/... doesn't exist yet`.

---

## FIX 2: Wire 4 stubs in client/src/api/analytics.ts

**File**: `client/src/api/analytics.ts`
**Lines**: ~138-141

**Current stubs**:
```typescript
fetchBillAlerts: async (..._args: any[]) => Promise.resolve([] as any[]),
projectRevenue: async (..._args: any[]) => Promise.resolve({} as any),
projectExpenses: async (..._args: any[]) => Promise.resolve({} as any),
calculateWealthProjection: async (..._args: any[]) => Promise.resolve({} as any),
```

**Step 1**: READ `server/src/routes/analytics.ts` fully.
**Step 2**: READ `server/src/routes/bills.ts` for bill alerts.

Wire what you find:
```typescript
fetchBillAlerts: async (params?: { days?: number }) => {
  const qp = new URLSearchParams();
  if (params?.days) qp.set('days', String(params.days));
  const res = await fetch(`${API_URL}/bills/alerts?${qp}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`fetchBillAlerts failed: ${res.status}`);
  return res.json() as Promise<any[]>;
},

projectRevenue: async (params: { months?: number }) => {
  const qp = new URLSearchParams();
  if (params?.months) qp.set('months', String(params.months));
  const res = await fetch(`${API_URL}/analytics/revenue-projection?${qp}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`projectRevenue failed: ${res.status}`);
  return res.json();
},
```

---

## FIX 3: Wire CSV parser into the upload pipeline

**Context**: The CSV parser (`server/src/services/parsers/formats/csv-parser.ts`) is fully implemented but NOT connected to the upload pipeline. When a user uploads a CSV, the pipeline tries to parse it as a PDF and fails.

**Server file to modify**: `server/src/services/pipeline/` — find the main pipeline orchestrator (likely `server/src/services/pipeline/text-extraction.ts` or `pipeline.ts`)

**Step 1**: READ `server/src/services/pipeline/text-extraction.ts` to understand the current flow.
**Step 2**: READ `server/src/services/parsers/formats/csv-parser.ts` to understand the CSV parser interface.
**Step 3**: READ `server/src/services/pipeline/` directory structure.

**Fix approach**: Add file-type detection at the start of `processStatement()`:

```typescript
// In the pipeline entry point (text-extraction.ts or pipeline.ts):
import { CSVStatementParser } from '../parsers/formats/csv-parser.js';

// Detect file type from extension:
function detectFileType(filePath: string): 'pdf' | 'csv' | 'xlsx' | 'ofx' | 'qif' | 'unknown' {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'ofx') return 'ofx';
  if (ext === 'qif') return 'qif';
  return 'unknown';
}

// In processStatement() or equivalent:
const fileType = detectFileType(filePath);

if (fileType === 'pdf') {
  // existing PDF path
  result = await extractPdfText(filePath);
} else if (fileType === 'csv') {
  const csvParser = new CSVStatementParser();
  result = await csvParser.parse(filePath);
  // result should be { transactions: ParsedTransaction[], accountInfo: AccountInfo }
} else {
  throw new Error(`Unsupported file type: ${fileType}`);
}
```

**IMPORTANT**: The CSV parser likely returns a different shape than `extractPdfText()`. You need to adapt the output to match what the rest of the pipeline expects. Read both to understand the shapes, then write an adapter.

Also add file type detection in `server/src/services/queue/job-processor.ts` — the batch upload queue processor at line ~130:
```typescript
// Same detectFileType logic — ensure batch processing also routes CSVs correctly
```

---

## VERIFICATION

After all fixes:
```bash
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

Commit:
```bash
git add client/src/api/tax.ts
git add client/src/api/analytics.ts
git add server/src/services/pipeline/
git commit -m "fix(api): wire tax/analytics stubs, connect CSV parser to upload pipeline"
```
