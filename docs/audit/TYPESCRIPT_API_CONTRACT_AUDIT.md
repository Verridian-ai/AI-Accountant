# TypeScript & API Contract Audit Report

**Auditor:** Teammate 1 — TypeScript & API Contract Enforcer
**Date:** 2026-02-11
**Scope:** TypeScript strictness, shared types, request/response contracts, implicit `any` elimination, end-to-end type safety, dual-DB Proxy layer

---

## 1. TypeScript Strict Flags

### Server (`server/tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,        // ✅ Enabled
    "skipLibCheck": true,   // ⚠️ Skips third-party type checking
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist"
  }
}
```

**Findings:**
- ✅ `strict: true` is enabled (includes `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, etc.)
- ⚠️ **MISSING** `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess` — all present in client but absent in server
- ⚠️ **MISSING** `noImplicitReturns` — present in client but absent in server
- ⚠️ `skipLibCheck: true` hides type errors in third-party packages
- **CRITICAL:** Despite `strict: true`, the codebase is riddled with explicit `any` annotations that defeat the purpose (see Section 4)

### Client (`client/tsconfig.app.json`)
```json
{
  "compilerOptions": {
    "strict": true,                     // ✅
    "noUnusedLocals": true,             // ✅
    "noUnusedParameters": true,         // ✅
    "noFallthroughCasesInSwitch": true, // ✅
    "noUncheckedIndexedAccess": true,   // ✅ (stricter than server)
    "noImplicitReturns": true,          // ✅
    "forceConsistentCasingInFileNames": true // ✅
  }
}
```

**Findings:**
- ✅ Client is significantly stricter than server
- ✅ No `@ts-ignore` or `@ts-expect-error` directives in client source
- ✅ `noUncheckedIndexedAccess` forces null checks on array/object indexing

**Verdict:** Server tsconfig is permissive compared to client. The gap allows unsafe patterns to compile without errors.

---

## 2. Dual-DB Proxy Layer (`server/src/schema.ts:26-109`)

### Architecture
The `wrapPgDb()` function at `schema.ts:26` wraps a PostgreSQL Drizzle instance with a `Proxy` that intercepts all method calls and injects SQLite-compatible `.get()`, `.all()`, `.run()` methods via `addSqliteCompat()` at `schema.ts:49`.

### Type Safety Findings

| Issue | Severity | Location |
|-------|----------|----------|
| `wrapPgDb(pgDb: any): any` — entire Proxy layer is untyped | **CRITICAL** | `schema.ts:26` |
| `addSqliteCompat(obj: any): any` — compat wrapper is untyped | **CRITICAL** | `schema.ts:49` |
| Inner functions use `(this: any, ...args: any[])` | **HIGH** | `schema.ts:31`, `schema.ts:76` |
| `db` export has inferred type `any` due to `createDb()` returning `any` | **CRITICAL** | `schema.ts:111` |
| All `.get()`, `.all()`, `.run()` calls throughout codebase have implicit `any` return types | **CRITICAL** | ~70 call sites in `index.ts` |

**Analysis:**
- The `db` variable (`schema.ts:111`) is typed as `any` because `createDb()` returns either `wrapPgDb(pgDb)` (typed `any`) or `drizzleSqlite(client)` (typed `LibSQLDatabase`).
- This means every `db.select()...from(...)...get()` call returns `any`, which propagates `any` throughout all route handlers.
- The Proxy's `.get()` at `schema.ts:58` returns `Promise<T | undefined>` implicitly, but no type annotation captures this.
- The `.all()` at `schema.ts:63` returns `Promise<T[]>` but again lacks type annotation.
- The `.run()` at `schema.ts:69` returns `Promise<unknown>`.
- **No runtime type validation** of Proxy return values — if PG returns unexpected shape, it silently passes through.

**Risk to Accuracy Contract:**
Since `db` is `any`, **no compile-time verification exists** that query results match the Drizzle schema types. A column rename or schema migration that doesn't update all call sites will fail silently at runtime.

---

## 3. API Response Envelope Consistency

### Inconsistent Error Responses

| Pattern | Examples | Count |
|---------|----------|-------|
| `{ error: string }` | Most endpoints | ~40+ |
| `{ answer: string }` on error | `POST /api/chat` (`index.ts:908`, `index.ts:953`) | 2 |
| `{ success: boolean }` | PATCH endpoints | ~8 |
| `{ message: string }` | POST endpoints | ~5 |
| Direct array return | `GET /api/statements` (`index.ts:436`) | ~3 |
| `{ transactions: T[], total: number }` | `GET /api/transactions` (`index.ts:199`) | 1 |

**Issues:**
1. **No standard error envelope.** Some return `{ error: string }`, some return `{ error: string, validationErrors: string[] }` (`index.ts:809-812`), some return `{ answer: string }` even on error (`index.ts:908`).
2. **No standard success envelope.** `GET /api/statements` returns raw array (`index.ts:436`), `GET /api/transactions` returns `{ transactions, total }` (`index.ts:199`), `GET /api/accounts` returns raw array (`index.ts:1228`).
3. **HTTP status codes are inconsistent:** Some 500 errors return `{ error }`, some return `{ answer }` (chat endpoint).
4. **No shared error type** between server and client. Client-side `api.ts` doesn't parse or type-check error responses — just throws generic `Error`.

### Duplicate Route Registrations

| Route | First Registration | Second Registration |
|-------|-------------------|---------------------|
| `GET /api/settings` | `index.ts:439` | `index.ts:677` |
| `PATCH /api/settings` | `index.ts:461` | `index.ts:701` |

**Risk:** Hono registers both handlers. First match wins, so the handlers at lines 677/701 are **dead code** — they will never execute. The first pair (lines 439/461) lacks error handling compared to the second pair.

---

## 4. Implicit `any` and `as any` Audit

### `as any` Casts (Server — 30+ instances)

| File | Line | Pattern | Severity |
|------|------|---------|----------|
| `schema.ts` | 26 | `wrapPgDb(pgDb: any): any` | CRITICAL |
| `schema.ts` | 49 | `addSqliteCompat(obj: any): any` | CRITICAL |
| `schema.ts` | 31, 76 | `function (this: any, ...args: any[])` | HIGH |
| `index.ts` | 258 | `splits.map((split: any) =>` | HIGH |
| `index.ts` | 376 | `generateCSV = (data: any[])` | MEDIUM |
| `index.ts` | 417 | `c.body(buf as any)` | LOW |
| `index.ts` | 1225 | `userAccounts.filter((a: any) =>` | HIGH |
| `index.ts` | 1259 | `catch (err: any)` | MEDIUM |
| `index.ts` | 1474 | `const r = row as any` — transfer join result | HIGH |
| `index.ts` | 3279 | `(a as any).ownershipTag` | HIGH |
| `index.ts` | 3299 | `(srcAcct as any)?.ownershipTag` (x2) | HIGH |
| `index.ts` | 3401 | `conditions: any[]` | MEDIUM |
| `index.ts` | 3708 | `recurring: any[]` | MEDIUM |
| `index.ts` | 3878 | `result: any[]` | MEDIUM |
| `index.ts` | 3940 | `anomalies: any[]` | MEDIUM |
| `index.ts` | 4078 | `forecast: any[]` | MEDIUM |
| `services/ai.ts` | 69 | `} as any` — vision content | MEDIUM |
| `services/ai.ts` | 172 | `] as any` — message content array | MEDIUM |
| `services/ai.ts` | 278 | `context: any` — generateInsight param | HIGH |
| `services/agents.ts` | 17-19 | `transactions?: any[]`, `accounts?: any[]`, `statements?: any[]` | HIGH |
| `services/agents.ts` | 25, 28, 34 | `data?: any`, `code_result?: any`, `result?: any` | HIGH |
| `services/rag.ts` | 10 | `cogneeJsonRequest(...): Promise<any>` | MEDIUM |
| `services/rag.ts` | 47 | `cogneeAddData(...): Promise<any>` | MEDIUM |
| `services/rag.ts` | 87 | `(transactions as any[]).map(tx =>` | HIGH |
| `services/bas.ts` | 399 | `updateData: any` | MEDIUM |
| `services/vertex-ai.ts` | 459, 480, 502 | `data: any` (x3) | MEDIUM |
| `services/tax.ts` | 1008 | `as any` on insert | MEDIUM |
| `routes/pipeline.ts` | 52-53 | `as any` on transaction IDs | HIGH |
| `routes/pipeline.ts` | 106 | `(srcAcct as any)?.ownershipTag` (x2) | HIGH |
| `routes/pipeline.ts` | 322 | `)) as any` on query result | HIGH |
| `services/pipeline.ts` | 71 | `lastError: any` | LOW |
| `services/pipeline.ts` | 444 | `(tx: any, i: number)` | HIGH |
| `utils/logger.ts` | 2, 5, 8, 11 | `...args: any[]`, `error?: any, context?: any` | MEDIUM |
| `routes/agents.ts` | 86 | `quarterTxs.map((tx: any) =>` | HIGH |

### `@ts-ignore` / `@ts-expect-error` Usage

| File | Line | Comment |
|------|------|---------|
| `services/pipeline.test.ts` | 239 | `// @ts-ignore` |
| `services/pipeline.test.ts` | 266 | `// @ts-ignore` |
| `services/orchestrator/tracing.ts` | 162 | `// @ts-expect-error - langfuse is an optional dependency` |

**Total:** 3 suppressions (2 in tests, 1 for optional dep — acceptable)

---

## 5. Client-Server Type Contract Mismatches

### `Transaction` Type

| Field | Server Schema (`schema.ts`) | Client DTO (`api.ts`) | Match? |
|-------|---------------------------|----------------------|--------|
| `id` | `text` (string) | `string` | ✅ |
| `date` | `text` (string) | `string` | ✅ |
| `description` | `text` (string) | `string` | ✅ |
| `amount` | `integer` (number) | `number` | ✅ |
| `balance` | `integer` (nullable) | `number \| undefined` | ⚠️ Server is `null`, client is `undefined` |
| `category` | `text` (nullable) | `string \| undefined` | ⚠️ Same null/undefined mismatch |
| `gstApplicable` | `integer (boolean)` default false | `boolean` | ✅ (but server could be `null` initially) |
| `gstAmount` | `integer` default 0 | **MISSING from client** | ❌ |
| `gstCategory` | `text` (nullable) | **MISSING from client** | ❌ |
| `confidenceScore` | `real` default 1.0 | `number` (required) | ⚠️ Server nullable, client required |

### `Account` Type

| Field | Server Schema (`schema.ts`) | Client DTO (`api.ts`) | Match? |
|-------|---------------------------|----------------------|--------|
| `lastStatementDate` | `text` (nullable) | **MISSING** | ❌ |
| `ownershipTag` | `text` default 'business' | `'personal' \| 'business' \| undefined` | ⚠️ Server not typed as union |
| `currentBalance` | `integer` default 0 | `number \| null` | ⚠️ |

### Missing Client Types for GST Fields
- Client `Transaction` interface (`api.ts:20-39`) is missing `gstAmount` and `gstCategory` fields
- Client `basApi.categorizeGST` at `api.ts:896` sends `gstAmount` in the request body, but the Transaction type it operates on doesn't include this field
- Server Zod schema `transactionUpdateSchema` (`validation/index.ts:102-111`) includes `gstAmount` and `gstCategory` as valid update fields

### `BASCalculation` Type Divergence
- Client (`api.ts:680-713`) defines `BASCalculation` with fields like `g1_total_sales`, `g2_export_sales` etc. using snake_case
- Server `basCalculations` schema (`schema.ts:344-367`) uses camelCase fields like `labelG1`, `labelG2` etc.
- Server BAS service returns yet another format with `labels.G1`, `labels.G2` etc.
- **Three different representations** of the same BAS data with no shared type or mapping layer

### `Deduction` Type Divergence
- Client `Deduction` (`api.ts:725-735`) has `amountCents: number`
- Server `deductions` schema (`schema.ts:387-400`) has `amount: integer`
- Field name mismatch: client uses `amountCents`, server uses `amount`

### `CGTAsset` / `CGTEvent` Type Divergence
- Client `CGTAsset` (`api.ts:737-750`) has `acquisitionCostCents`, `incidentalCostsCents`, `improvementsCents`
- Server `cgtAssets` schema (`schema.ts:402-415`) has `acquisitionCost`, `acquisitionCostsIncidental`, `improvementsCost`
- **Every field name differs** between client and server

### `DepreciableAsset` Type Divergence
- Client (`api.ts:770-784`) has `purchaseCostCents`, `effectiveLifeYears`, `openingValueCents`, `currentValueCents`, `businessUsePercent`
- Server schema (`schema.ts:436-454`) has `purchaseCost`, `effectiveLife` (not `effectiveLifeYears`), `openingValue`, `currentValue`, `businessUsePercentage`

---

## 6. Zod Validation Schema Usage

### Critical Finding: Zod schemas are defined but NOT used

The file `server/src/validation/index.ts` defines 25+ comprehensive Zod schemas including:
- `loginSchema`, `registerSchema` — for auth
- `transactionUpdateSchema` — for PATCH /api/transactions/:id
- `transactionSplitSchema` — for POST /api/transactions/:id/split
- `createAccountSchema` — for POST /api/accounts
- `chatMessageSchema` — for POST /api/chat
- `agentRequestSchema` — for agent invocations
- `modelSettingsSchema` — for PATCH /api/settings
- And many more

**However, the validation module is NEVER imported anywhere:**

```bash
# Grep for imports of validation/index.ts
$ grep -r "from.*validation" server/src/
# Result: No matches found
```

**Every single route handler uses raw `c.req.json()` with no validation:**
- `index.ts` has 35 instances of `c.req.json()` — NONE validated with Zod
- `routes/agents.ts` — manual `if (!query)` checks instead of Zod
- `routes/pipeline.ts` — manual `if (!descriptions || !Array.isArray(...))` checks

**Impact:**
1. Malformed request bodies pass through silently
2. Type assertions are unchecked at runtime
3. The `ValidateBody<T>` helper function and `ValidationError` class are dead code
4. All exported Zod-inferred types (`LoginInput`, `TransactionUpdate`, etc.) are unused

---

## 7. Agent I/O Contract Audit

### `services/agents.ts` (Pydantic AI Python agents)

**Input Contract:**
```typescript
interface AgentContext {
    transactions?: any[];  // schema.ts:17 — completely untyped
    accounts?: any[];      // schema.ts:18
    statements?: any[];    // schema.ts:19
}
```

**Output Contract:**
```typescript
interface AgentResponse {
    success: boolean;
    message: string;
    data?: any;            // schema.ts:25 — opaque
    reasoning?: string;
    code_executed?: string;
    code_result?: any;     // schema.ts:28 — opaque
}
```

**Issues:**
- Agent inputs are `any[]` — no type narrowing to `Transaction[]` or `Account[]`
- Agent outputs contain `data?: any` — callers must blindly trust Python agent output
- The `runPython()` method at `agents.ts:48` returns `Promise<any>` — parsed from stdout JSON
- No runtime validation of Python agent output against `AgentResponse` interface
- Python agent could return completely different shapes and TypeScript would not catch it

### `routes/agents.ts` (Claude agent orchestrator routes)

**Input Issues:**
- `agents.ts:86`: Transactions are mapped with `(tx: any)` — loses all Drizzle typing
- `agents.ts:87`: `parseInt(tx.id, 10)` — IDs are UUIDs (strings), not integers. `parseInt` will return `NaN`
- `agents.ts:95`: `parseInt(accountId, 10)` — same UUID-to-int problem
- `agents.ts:128-129`: Account and statement IDs parsed as integers from UUID strings

**Output Issues:**
- `agents.ts:35`: `return c.json(result)` — `result` has inferred `any` type from orchestrator
- No response type annotation on any handler

### `services/ai.ts` (Legacy AI service)

**Input Issues:**
- `ai.ts:278`: `generateInsight(query: string, context: any, model?: string)` — `context` is untyped
- `ai.ts:37`: `parseWithVision` returns `Promise<any>`

**Output Issues:**
- All AI methods return `JSON.parse(raw)` results — no Zod or runtime validation
- If the AI model returns malformed JSON, `JSON.parse` throws, caught by catch blocks that return fallback objects
- Fallback objects are manually constructed and may not match the declared return type

---

## 8. Specific Money-Affecting Accuracy Risks

### Proxy Layer Return Type Erasure
- Every DB query goes through the Proxy layer, which erases Drizzle's inferred types to `any`
- Monetary calculations in route handlers (e.g., credit analytics at `index.ts:1658-1670`, BAS calculations) operate on `any`-typed values
- No compile-time guarantee that `amount`, `balance`, `creditLimit` etc. are `number` (not `null` or `string`)

### parseInt on UUID IDs
- `routes/agents.ts:87`: `parseInt(tx.id, 10) || 0` — UUIDs like `"a1b2c3d4-..."` → `NaN` → `0`
- `routes/agents.ts:95,128`: Same pattern for accountId, statementIds
- `index.ts:3264-3270`: `parseInt(t.id)`, `parseInt(t.accountId || '0')` — all UUID-to-int conversions
- **Impact:** Any agent receiving these integer IDs cannot match them back to actual DB records

### ownershipTag Access Pattern
- `index.ts:3279`: `(a as any).ownershipTag` — property exists on schema but `as any` is needed because DB query result is `any`
- `index.ts:3299`: `(srcAcct as any)?.ownershipTag === 'personal'` — same issue in transfer detection
- `routes/pipeline.ts:106`: Same pattern — could silently fail if `ownershipTag` is renamed

---

## 9. Summary of Findings

### Critical Issues (Blocking Type Safety)
| # | Issue | Impact |
|---|-------|--------|
| C1 | `db` export is typed `any` due to Proxy wrapper | All DB queries return `any`, defeating `strict: true` |
| C2 | Zod validation schemas defined but never imported/used | All API inputs are unvalidated at runtime |
| C3 | `parseInt()` on UUID string IDs in agent routes | Agent receives `0` or `NaN` instead of actual IDs |
| C4 | 30+ explicit `as any` / `: any` in route handlers | Type safety bypassed at call sites |
| C5 | Duplicate `GET/PATCH /api/settings` routes | Second pair is dead code |

### High Issues (Type Contract Violations)
| # | Issue | Impact |
|---|-------|--------|
| H1 | Client `Transaction` missing `gstAmount`, `gstCategory` | GST data cannot be displayed/edited in UI |
| H2 | BAS types use 3 different field naming conventions | No single source of truth for BAS data shape |
| H3 | Client `Deduction`, `CGTAsset`, `CGTEvent`, `DepreciableAsset` types diverge from server schema | Field name mismatches cause data loss in transit |
| H4 | Agent `AgentContext` uses `any[]` for all collections | No type narrowing; agents receive untyped data |
| H5 | No runtime validation of AI/agent JSON responses | Malformed AI output propagates silently |
| H6 | Server tsconfig missing `noUncheckedIndexedAccess`, `noImplicitReturns` | Allows unsafe patterns that client tsconfig catches |

### Medium Issues (Code Quality)
| # | Issue | Impact |
|---|-------|--------|
| M1 | Error response format inconsistent (`{ error }` vs `{ answer }`) | Client error handling is fragile |
| M2 | `services/rag.ts` returns `Promise<any>` throughout | Cognee responses untyped |
| M3 | `services/vertex-ai.ts` has 3 `data: any` parameters | Vertex AI responses untyped |
| M4 | Logger utility uses `...args: any[]` for all methods | Cannot type-check log arguments |

### Low Issues (Minor)
| # | Issue | Impact |
|---|-------|--------|
| L1 | `c.body(buf as any)` at `index.ts:417` | Hono types are overly strict for Buffer |
| L2 | 2 `@ts-ignore` in test files | Acceptable in test context |
| L3 | 1 `@ts-expect-error` for optional langfuse dep | Acceptable |

---

## 10. Recommendations

1. **Type the Proxy layer**: Create a typed `CompatibleDb` interface that extends Drizzle's PostgreSQL database type with `.get()`, `.all()`, `.run()` methods returning proper generic types.

2. **Wire up Zod validation**: Import validation schemas in `index.ts` and wrap `c.req.json()` calls with `validateBody(schema, body)`. The infrastructure already exists.

3. **Create shared types package**: Extract common DTOs into a `shared/types` directory imported by both client and server to prevent drift.

4. **Fix UUID-to-int conversions**: Remove all `parseInt()` calls on UUID fields in `routes/agents.ts` and `index.ts:3264-3284`. Pass string IDs to agents.

5. **Remove duplicate routes**: Delete the second `GET/PATCH /api/settings` handlers at `index.ts:677-723`.

6. **Align server tsconfig**: Add `noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters` to server tsconfig.

7. **Add Zod validation for AI responses**: Validate `JSON.parse()` output from AI services against Zod schemas before returning to callers.
