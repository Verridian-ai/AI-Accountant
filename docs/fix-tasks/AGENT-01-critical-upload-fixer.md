# Agent-01: Critical Upload Pipeline Fixer

**Your role**: Fix all critical bugs in the file upload pipeline.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every file change**: Run `cd server && npx tsc --noEmit` — must stay at 0 errors.

---

## FIX 1 (CRITICAL): Statement ID mismatch breaks ALL uploads

**File**: `server/src/services/statements/statement-service.ts`
**Lines**: ~31 and ~40

**Problem**: `upload()` generates `id = crypto.randomUUID()` locally, but does NOT pass it to `statementRepository.create()`. The repository generates its own UUID. Then `pipeline.processStatement(id, ...)` uses the LOCAL id — but the DB record has a DIFFERENT id. The pipeline query finds nothing.

**Current broken code** (around line 24-40):
```typescript
const id = crypto.randomUUID();
// ...
await statementRepository.create({
  filename: file.name,
  hash,
  uploadDate: new Date().toISOString(),
  parsingStatus: 'PENDING',
  userId,
  // ← `id` is NOT passed here — repository makes its own UUID!
});
pipeline.processStatement(id, filePath);  // ← uses WRONG id
```

**Fix**: Pass `id` to `statementRepository.create()`:
```typescript
await statementRepository.create({
  id,           // ← ADD THIS LINE
  filename: file.name,
  hash,
  uploadDate: new Date().toISOString(),
  parsingStatus: 'PENDING',
  userId,
});
```

**Then check**: `server/src/services/statements/statement-repository.ts` — find the `create()` method. If it looks like:
```typescript
async create(data: { filename: string; hash: string; ... }) {
  const id = randomUUID();  // ← generates its own id
```
Change the signature to accept optional `id`:
```typescript
async create(data: { id?: string; filename: string; hash: string; ... }) {
  const id = data.id ?? randomUUID();
```

---

## FIX 2 (HIGH): pipeline.processStatement called without .catch()

**File**: `server/src/services/statements/statement-service.ts`
**Line**: ~40

**Problem**: Fire-and-forget with no error handler — unhandled rejections are silently swallowed.

**Current code**:
```typescript
pipeline.processStatement(id, filePath);  // no await, no .catch()
```

**Fix**: Add `.catch()`:
```typescript
pipeline.processStatement(id, filePath).catch((err: unknown) => {
  console.error('[StatementService] pipeline error for statement', id, err);
});
```

---

## FIX 3 (CRITICAL): No file type validation on upload endpoint

**File**: `server/src/routes/statements.ts`
**Lines**: ~30-45 — right after extracting `file` from body

**Problem**: ANY file type is accepted (exe, zip, 10GB files). No MIME type or size check.

**Current code**:
```typescript
const file = body['file'];
if (!file || !(file instanceof File))
  return c.json({ error: 'No file provided' }, 400);
// Immediately proceeds to upload — no validation!
const result = await statementService.upload(getUserId(c), file);
```

**Fix**: Add MIME type and size validation after the File check:
```typescript
const file = body['file'];
if (!file || !(file instanceof File))
  return c.json({ error: 'No file provided' }, 400);

// Validate file type
const ALLOWED_TYPES = [
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/x-ofx',
  'application/x-qif',
];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|csv|xls|xlsx|ofx|qif)$/i)) {
  return c.json({ error: 'Invalid file type. Allowed: PDF, CSV, XLS, XLSX, OFX, QIF' }, 400);
}
if (file.size > MAX_SIZE_BYTES) {
  return c.json({ error: 'File too large. Maximum size is 50MB' }, 400);
}

const result = await statementService.upload(getUserId(c), file);
```

---

## FIX 4 (CRITICAL): parseInt(UUID) in transfer detection — all IDs become 0

**File**: `server/src/services/pipeline/transfer-detection.ts`
**Lines**: ~69-71

**Problem**: Transaction and account IDs are UUIDs (e.g., `"a1b2c3d4-..."`). `parseInt()` on a UUID returns `NaN`, which falls back to `0`. Every transaction gets `id: 0`, making transfer detection useless.

**Current broken code**:
```typescript
const candidates: TransferCandidate[] = allUserTxs.map((t) => ({
  id: parseInt(t.id as string, 10) || 0,          // ← UUIDs → NaN → 0
  accountId: parseInt((t.accountId as string) || '0', 10) || 0,  // ← same problem
```

**Fix**: Change `TransferCandidate` type to use `string` IDs, then update the mapping:

First, find the `TransferCandidate` interface (likely in the same file or a types file) and change:
```typescript
interface TransferCandidate {
  id: number;       // ← CHANGE to string
  accountId: number; // ← CHANGE to string
  // ...other fields...
}
```
To:
```typescript
interface TransferCandidate {
  id: string;
  accountId: string;
  // ...other fields...
}
```

Then fix the mapping:
```typescript
const candidates: TransferCandidate[] = allUserTxs.map((t) => ({
  id: t.id as string,              // ← use string directly
  accountId: (t.accountId as string) ?? '',  // ← use string directly
```

Then check the rest of the file for any comparisons like `candidate.id === other.id` — these should still work correctly with strings.

---

## VERIFICATION

After all fixes:
```bash
cd server && npx tsc --noEmit
```

Must show 0 errors (or same count as before if pre-existing errors exist — do NOT increase the error count).

Then commit:
```bash
git add server/src/services/statements/statement-service.ts
git add server/src/services/statements/statement-repository.ts
git add server/src/routes/statements.ts
git add server/src/services/pipeline/transfer-detection.ts
git commit -m "fix(upload): statement ID mismatch, file validation, transfer UUID parsing"
```
