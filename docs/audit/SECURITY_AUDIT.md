# Security & Abuse-Resistance Audit

**Auditor:** Security & Abuse-Resistance Auditor (Teammate 2)
**Date:** 2026-02-11
**Scope:** Upload hardening, rate limiting, CORS, authorization, secret handling, dependency vulnerabilities, sandbox escape risks, audit logging coverage

---

## Executive Summary

The application has **well-designed security infrastructure** (Zod validation schemas, audit middleware, security headers, code interpreter sandbox) that is largely **not wired into the running application**. The security configs, validation schemas, and audit middleware exist as dead code. Meanwhile, the live endpoints have critical vulnerabilities including **path traversal in file uploads**, **wildcard CORS**, **rate limiter bypass via IP spoofing**, **hardcoded JWT fallback secret**, and **no file type validation on uploads**.

**P0 Critical Issues: 5** | **P1 High Issues: 7** | **P2 Medium Issues: 8** | **P3 Low Issues: 4**

---

## P0 - CRITICAL (Immediate Fix Required)

### P0-1: Path Traversal in File Upload

**File:** `server/src/index.ts:486-505`

```typescript
const filename = file.name;                          // Line 486 - UNSANITIZED
const uploadDir = path.resolve(process.cwd(), '../statements');
const filePath = path.join(uploadDir, filename);      // Line 504
await writeFile(filePath, Buffer.from(fileBuffer));    // Line 505
```

The filename from the uploaded file is used directly in `path.join()` without any sanitization. An attacker can craft a filename like `../../etc/cron.d/malicious` or `../server/src/index.ts` to write arbitrary files anywhere on the filesystem.

**Impact:** Remote Code Execution (RCE) via file overwrite. An attacker could overwrite server source files, configuration, or system files.

**Also affects reprocessing at line 986:**
```typescript
const filePath = path.resolve(process.cwd(), '../statements', stmt.filename);
```
If a malicious filename was stored in the DB during upload, reprocessing inherits the traversal.

---

### P0-2: No File Type Validation on Upload

**File:** `server/src/index.ts:475-521`

The upload endpoint accepts **any file type**. There is:
- No MIME type check
- No file extension validation
- No magic bytes verification
- No file size limit on individual uploads (only chat has a `bodyLimit`)

An attacker can upload executable files, shell scripts, HTML files (leading to stored XSS if served), or extremely large files to exhaust disk space.

The `magika` package (file type detection) is in `package.json:29` but is **never imported or used** in the upload handler.

---

### P0-3: Wildcard CORS Allows Any Origin

**File:** `server/src/index.ts:63`

```typescript
app.use('/*', cors())
```

This applies CORS with **no origin restriction** — equivalent to `Access-Control-Allow-Origin: *`. Any website can make authenticated API requests to this server if the user's browser has a valid JWT.

Combined with the JWT being stored client-side (likely localStorage), any malicious page can:
1. Read the JWT from localStorage (if same origin) or
2. Make cross-origin requests that the browser will send with credentials

**Note:** The Cognee service also has `CORS_ALLOWED_ORIGINS=*` in `docker-compose.yml:60`.

---

### P0-4: Rate Limiter IP Spoofing via X-Forwarded-For

**File:** `server/src/index.ts:50,59`

```typescript
keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
```

Both rate limiters use `x-forwarded-for` as the client key. This header is **trivially spoofable** by any client — an attacker can send a different `X-Forwarded-For` value with every request to completely bypass rate limiting.

Additionally, if no header is present, all unauthenticated clients share the key `'unknown'`, meaning a single client can exhaust the rate limit for ALL clients who don't set the header.

---

### P0-5: Hardcoded JWT Secret Fallback in Production

**File:** `docker-compose.yml:122`

```yaml
- JWT_SECRET=${JWT_SECRET:-cba-statement-parser-jwt-secret-key-2025}
```

If the `JWT_SECRET` environment variable is not set, Docker Compose falls back to a **publicly visible hardcoded secret**. This secret is committed to source control and allows anyone to forge valid JWT tokens.

**File:** `.env.example:89`
```
JWT_SECRET=dev_secret_key_123
```

The example file also contains a weak secret. While the server's `auth.ts:7-8` correctly throws if `JWT_SECRET` is unset, the Docker Compose fallback circumvents this safety check.

---

## P1 - HIGH

### P1-1: Security Headers Middleware Never Applied

**File:** `server/src/middleware/security.ts` (entire file)
**File:** `server/src/index.ts` (no import)

The `securityHeaders()` middleware function is fully implemented (345 lines of OWASP headers, CSP, HSTS, etc.) but is **never imported or applied** in `index.ts`. The grep for `securityHeaders` and `auditMiddleware` in index.ts returned **zero matches**.

**Impact:** No security headers are set on any response. No CSP, no X-Frame-Options, no HSTS, no X-Content-Type-Options.

---

### P1-2: Audit Middleware Never Applied

**File:** `server/src/middleware/audit.ts` (entire file, 504 lines)
**File:** `server/src/index.ts` (no import)

The audit logging middleware (`auditMiddleware()`) is fully implemented with comprehensive features (redaction, entity extraction, IP logging) but is **never registered** as middleware. No mutation endpoints are being audited.

The explicit audit functions (`logLoginAttempt`, `logPasswordChange`, `logDataExport`) are also never called from the auth or export routes.

---

### P1-3: Validation Schemas Exist But Are Never Used

**File:** `server/src/validation/index.ts` (424 lines)
**File:** `server/src/index.ts` (no import of validation)

Comprehensive Zod schemas exist for all inputs (`loginSchema`, `registerSchema`, `transactionUpdateSchema`, `chatMessageSchema`, etc.) but `validateBody` is **never called** in any route handler. All routes parse JSON directly with `c.req.json()` and use the raw, unvalidated data.

Examples of unvalidated inputs:
- `server/src/index.ts:78-79`: Login accepts any `username`/`password` — no length or format validation
- `server/src/index.ts:207`: Transaction update accepts arbitrary body fields
- `server/src/index.ts:250`: Split accepts unsanitized `splits` array

---

### P1-4: Upload Rate Limiting Explicitly Bypassed

**File:** `server/src/index.ts:66-73`

```typescript
app.use('/api/*', async (c, next) => {
    const path = c.req.path;
    if (path.includes('/statements/upload') || path.includes('/statements/retry')) {
        return next();  // SKIP rate limiting entirely
    }
    return generalLimiter(c, next);
})
```

The upload and retry endpoints are **explicitly excluded** from rate limiting. Combined with no file size limit, this allows unlimited file uploads at unlimited speed — a trivial denial-of-service vector.

The `RATE_LIMIT_CONFIGS` in `security.ts:310-314` defines a config for `/api/statements/upload` (10 req/min) but this config is **never consumed** by any middleware.

---

### P1-5: No Password Policy Enforcement at Registration

**File:** `server/src/index.ts:77-91`

```typescript
app.post('/auth/register', async (c) => {
    const { username, password } = await c.req.json();
    if (!username || !password) return c.json({ error: 'Missing username or password' }, 400);
    // No length, complexity, or format checks
```

Registration accepts any non-empty password. The `loginSchema` in `validation/index.ts:67` requires 8+ characters, and `passwordChangeSchema` requires uppercase + lowercase + digit, but **neither schema is applied** to the registration route.

---

### P1-6: JWT Has No Refresh Flow — 24-Hour Window

**File:** `server/src/auth.ts:19-21`

```typescript
export const generateToken = async (userId: string) => {
    return await sign({ userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }, JWT_SECRET);
};
```

Tokens expire after 24 hours with no refresh mechanism. The schema defines a `refresh_token_hash` column (`schema.ts:506`) but no refresh endpoint exists. This means:
- Users must re-authenticate every 24 hours
- If a token is stolen, it's valid for 24 hours with no revocation mechanism
- No algorithm is specified — `hono/jwt` defaults to HS256 which is acceptable but should be explicit

---

### P1-7: Docker Container Runs as Root

**File:** `server/Dockerfile` (docker-compose's server Dockerfile)

```dockerfile
FROM node:20-slim
WORKDIR /app
# ... no USER directive
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
```

The server container in docker-compose runs as **root** (no `USER` directive). The standalone Cloud Run `Dockerfile` at the project root correctly uses a non-root user (`nodejs:1001`), but the docker-compose server Dockerfile does not.

**Impact:** If the application is compromised (e.g., via path traversal + RCE), the attacker has root access within the container.

---

## P2 - MEDIUM

### P2-1: SSE Token in Query String

**File:** `server/src/index.ts:132-141`

```typescript
const token = c.req.query('token');
if (token && c.req.path === '/api/events') {
    const payload = await verify(token, JWT_SECRET);
```

JWT tokens are accepted as query parameters for the SSE endpoint. Query parameters are:
- Logged in server access logs
- Cached in browser history
- Visible in referrer headers
- Stored in proxy logs

This is a known anti-pattern that can lead to token leakage.

---

### P2-2: Code Interpreter Sandbox Escape Risks

**File:** `server/src/services/agents/code_interpreter.py:94-129`

The sandbox has several bypass vectors:

1. **`__subclasses__` access not blocked** (line 120-121): Only attributes starting with `_` are blocked, but `type.__subclasses__()` can be accessed via `type(42).__class__.__subclasses__()` — the check blocks `__subclasses__` but not chained calls that don't start with `_`.

2. **`getattr`/`setattr` not in blocked builtins** (line 18-48): While `exec`/`eval`/`open`/`compile`/`__import__` are blocked at the AST level, `getattr` is not in `SAFE_BUILTINS` and thus unavailable. However, the sandbox injects `SAFE_MODULES` directly as globals (line 148-149), so `datetime` module is available and `datetime.__class__.__subclasses__()` could potentially access other classes.

3. **No timeout enforcement** (line 91-92): `CODE_INTERPRETER_TIMEOUT = 30` is defined but **never enforced** — there's no `signal.alarm`, threading timeout, or process-level timeout. Infinite loops will hang the process.

4. **No memory limit enforcement** (line 92): `CODE_INTERPRETER_MAX_MEMORY = 256MB` is defined but never enforced. A malicious script could allocate unlimited memory.

5. **`compile` is used internally** (line 165): While `compile` is blocked as a builtin, the sandbox itself uses `exec(compile(...))` — this is not a vulnerability per se, but the `exec` call itself is the risk vector.

---

### P2-3: API Keys Using VITE_ Prefix on Server

**File:** `server/src/services/ai.ts:19-20`

```typescript
const openrouterKey = process.env.VITE_OPENROUTER_API_KEY;
const openaiKey = process.env.VITE_OPENAI_API_KEY;
```

API keys are stored with the `VITE_` prefix. The `VITE_` prefix is Vite's convention for **exposing env vars to the client bundle**. While the server reads these from `process.env` (safe), the naming creates confusion and risk:

- The `.env.example` lists `VITE_OPENROUTER_API_KEY` and `VITE_OPENAI_API_KEY`
- If these are in a `.env` file that Vite reads during client build, **the API keys will be embedded in the client JavaScript bundle**
- The client's `Dockerfile:10-11` only passes `VITE_API_URL`, so Docker builds are safe
- **But local development with a shared `.env` WILL leak keys to the client**

**Current client exposure check:** `client/src/api.ts:1` only uses `VITE_API_URL`. No client code references `VITE_OPENROUTER_API_KEY` or `VITE_OPENAI_API_KEY`. However, Vite bundles ALL `VITE_*` vars into `import.meta.env` regardless of whether code references them — they'd appear in the compiled JS bundle.

---

### P2-4: SQL Injection via LIKE Pattern

**File:** `server/src/index.ts:353`

```typescript
filters.push(like(transactions.description, `%${search}%`));
```

The `search` query parameter is interpolated directly into a LIKE pattern. While Drizzle ORM parameterizes the value (preventing traditional SQL injection), LIKE special characters (`%`, `_`) in user input can cause:
- Denial of service via expensive wildcard patterns
- Unintended result expansion

The `search` value should have `%` and `_` escaped.

---

### P2-5: No File Size Limit on PDF Uploads

**File:** `server/src/index.ts:475-521`

There is no `bodyLimit` middleware applied to the upload endpoint. The only `bodyLimit` is on `/api/chat` (100KB). An attacker could upload multi-gigabyte files to exhaust disk space and memory.

The batch endpoint (`/api/statements/batch`) limits to 50 files per batch (`line 545-547`) but has no per-file or total size limit.

---

### P2-6: Cognee Service Has Dangerous Settings

**File:** `docker-compose.yml:87-91`

```yaml
- REQUIRE_AUTHENTICATION=false
- ENABLE_BACKEND_ACCESS_CONTROL=false
- ACCEPT_LOCAL_FILE_PATH=true     # Can read any file on the Cognee container
- ALLOW_HTTP_REQUESTS=true         # Can make outbound HTTP requests
```

Combined with `CORS_ALLOWED_ORIGINS=*` (line 60), the Cognee service:
- Has no authentication
- Accepts local file paths (potential container filesystem read)
- Allows outbound HTTP (SSRF vector)
- Is accessible from any origin

While Cognee is only exposed internally on the Docker network, its port 8000 is also published (`ports: "8000:8000"`), making it accessible from the host.

---

### P2-7: PostgreSQL Port Exposed to Host

**File:** `docker-compose.yml:25`

```yaml
ports:
  - "5432:5432"
```

The PostgreSQL port is published to the host. If the host has a public IP or is on a shared network, the database is directly accessible. The password defaults to an env var with no minimum strength requirement.

---

### P2-8: Knowledge Ingestion Reads from Fixed Directory Without Auth Check

**File:** `server/src/index.ts:3582-3591`

```typescript
const files = fs.readdirSync(knowledgeDir);
for (const file of files) {
    if (file.endsWith('.md')) {
        const filePath = path.join(knowledgeDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
```

While behind JWT auth, the `knowledgeDir` is fixed to `process.cwd() + '/knowledge'`. The directory contents are read without user-scoping — any authenticated user can trigger ingestion of shared server-side files.

---

## P3 - LOW

### P3-1: .env Files Exist on Disk (Not Committed)

**Files found:** `.env`, `server/.env`, `client/.env`, `cognee-repo/.env`

These files exist locally but are not tracked by git (`.gitignore` includes `.env`, `.env.local`, `env.local`). This is correct behavior. However:
- The `.gitignore` does not include patterns like `.env.production`, `.env.staging`, or `.env.*.local`
- If someone creates `.env.production`, it would be committed

---

### P3-2: Batch Upload Job Not User-Scoped on Status Check

**File:** `server/src/index.ts:583-589`

```typescript
app.get('/api/statements/batch/:jobId', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const jobId = c.req.param('jobId');
    const job = bulkUploadQueue.getJobStatus(jobId);
```

While `userId` is extracted, it's unclear whether `getJobStatus` validates that the requesting user owns the job. If not, any authenticated user could query another user's batch job status (information disclosure).

---

### P3-3: bcryptjs Cost Factor

**File:** `server/src/auth.ts:12`

```typescript
return await bcrypt.hash(password, 10);
```

Cost factor 10 is acceptable but on the low end for 2026. OWASP recommends 12+ for new applications. This is minor given the other issues.

---

### P3-4: No CSRF Protection

The application uses JWT Bearer tokens (not cookies), which provides natural CSRF protection for API calls. However, the SSE endpoint accepts tokens via query parameters (P2-1), and if the application ever migrates to cookie-based auth, CSRF would become a problem. No CSRF middleware is configured.

---

## Summary Matrix

| ID | Severity | Category | Description | File:Line |
|----|----------|----------|-------------|-----------|
| P0-1 | CRITICAL | Upload | Path traversal via unsanitized filename | `index.ts:486-505` |
| P0-2 | CRITICAL | Upload | No file type/size validation | `index.ts:475-521` |
| P0-3 | CRITICAL | CORS | Wildcard CORS allows any origin | `index.ts:63` |
| P0-4 | CRITICAL | Rate Limit | IP spoofing bypasses all rate limits | `index.ts:50,59` |
| P0-5 | CRITICAL | Secrets | Hardcoded JWT secret fallback in docker-compose | `docker-compose.yml:122` |
| P1-1 | HIGH | Headers | Security headers middleware never applied | `security.ts` (dead code) |
| P1-2 | HIGH | Audit | Audit middleware never applied | `audit.ts` (dead code) |
| P1-3 | HIGH | Validation | Zod schemas exist but never used | `validation/index.ts` (dead code) |
| P1-4 | HIGH | Rate Limit | Upload endpoints explicitly bypass rate limiting | `index.ts:66-73` |
| P1-5 | HIGH | Auth | No password policy enforcement at registration | `index.ts:77-91` |
| P1-6 | HIGH | Auth | No token refresh/revocation mechanism | `auth.ts:19-21` |
| P1-7 | HIGH | Docker | Server container runs as root | `server/Dockerfile` |
| P2-1 | MEDIUM | Auth | JWT in query string for SSE | `index.ts:132-141` |
| P2-2 | MEDIUM | Sandbox | Code interpreter has escape vectors | `code_interpreter.py:94-165` |
| P2-3 | MEDIUM | Secrets | API keys use VITE_ prefix, risk of client exposure | `ai.ts:19-20` |
| P2-4 | MEDIUM | Injection | LIKE pattern injection in search | `index.ts:353` |
| P2-5 | MEDIUM | DoS | No file size limit on uploads | `index.ts:475-521` |
| P2-6 | MEDIUM | Config | Cognee has dangerous settings + exposed port | `docker-compose.yml:87-91` |
| P2-7 | MEDIUM | Config | PostgreSQL port exposed to host | `docker-compose.yml:25` |
| P2-8 | MEDIUM | Access | Knowledge ingestion not user-scoped | `index.ts:3582-3591` |
| P3-1 | LOW | Secrets | .env gitignore incomplete for variants | `.gitignore` |
| P3-2 | LOW | Access | Batch job status may lack user ownership check | `index.ts:583-589` |
| P3-3 | LOW | Auth | bcrypt cost factor could be higher | `auth.ts:12` |
| P3-4 | LOW | Auth | No CSRF middleware (mitigated by Bearer tokens) | N/A |

---

## Key Architectural Observation

The codebase has a pattern of **well-engineered but unconnected security infrastructure**:

1. `middleware/security.ts` — 345 lines of OWASP headers — **never imported**
2. `middleware/audit.ts` — 504 lines of audit logging — **never imported**
3. `validation/index.ts` — 424 lines of Zod schemas — **never imported in routes**
4. `RATE_LIMIT_CONFIGS` in security.ts — per-endpoint rate configs — **never consumed**
5. `magika` package for file type detection — **never used in upload handler**

Wiring these existing modules into `index.ts` would resolve P1-1, P1-2, P1-3, and partially P1-4 immediately.

---

## Recommended Fix Priority

1. **Immediately**: Sanitize upload filenames (P0-1), add file type + size validation (P0-2), restrict CORS origins (P0-3)
2. **Same day**: Remove JWT fallback (P0-5), fix rate limiter key generator (P0-4)
3. **This week**: Wire security headers middleware (P1-1), audit middleware (P1-2), validation schemas (P1-3), re-enable upload rate limiting (P1-4)
4. **This sprint**: Add non-root user to server Dockerfile (P1-7), implement token refresh (P1-6), enforce password policy (P1-5)
5. **Backlog**: Harden code interpreter sandbox (P2-2), rename VITE_ env vars on server (P2-3), restrict Cognee/Postgres ports (P2-6, P2-7)
