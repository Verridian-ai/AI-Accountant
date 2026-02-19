# GoldLedger — Backend Audit & Agent Team Configuration Report
**Date**: 2026-02-20
**Auditor**: Lead session + specialist analysis
**Target**: Next agent team — Backend Security Fix & Auth Consolidation

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL  | 3 |
| HIGH      | 8 |
| MEDIUM    | 9 |
| LOW       | 6 |
| **Total** | **26** |

**Headline findings:**
- Legacy `/auth/*` routes accept `password: z.string().min(1)` — any single character passes as a password
- 55 mutating (POST/PUT/PATCH) routes across the codebase have no `zValidator` body validation
- Refresh endpoints (`/auth/refresh`, `/api/auth/refresh`) have no rate limiting — brute-force vector
- `err.message` is leaked directly into API responses across 30+ route files
- 70 server-side files violate the 300-line rule (largest: 695 lines)

**Positives confirmed:**
- Server TypeScript errors: **0** (clean build)
- `: any` usage: **8** (down from 560 — excellent)
- `tenantAuthMiddleware` applied via `use('/*', ...)` in most route files
- Rate limiting: `authLimiter` on login endpoints, `generalLimiter` on `/api/*`
- bcrypt with 10 rounds for all password hashing
- Refresh token hash stored in `sessions` table (good pattern)
- `validatePassword()` with complexity rules exists in `admin-auth` module
- `auditLog` table with full request tracking in schema
- `zValidator` on most auth and admin routes

---

## 1. Agent Team Configuration (All 27 Agents)

### Current State: 24 agents existed, 3 new agents created (total: 27)

| # | Agent | Status | Assigned Skills |
|---|-------|--------|-----------------|
| 1 | `audit-lead` | ✅ Operational | `orchestrator-agent-teams`, `cognee-hive-memory`, `multi-agent-patterns` |
| 2 | `audit-typescript` | ✅ Operational | `typescript-advanced-patterns`, `tob-sharp-edges`, `obra-systematic-debug` |
| 3 | `audit-security` | ✅ Operational | `security-auth-patterns`, `community-security-blue`, `better-auth-best-practices`, `tob-audit-context` |
| 4 | `audit-routes` | ✅ Operational | `api-design-hono-patterns`, `typescript-advanced-patterns` |
| 5 | `audit-schema` | ✅ Operational | `database-drizzle-patterns`, `neon-postgres`, `community-postgres` |
| 6 | `audit-services` | ✅ Operational | `coding-languages-frameworks`, `error-handling-patterns`, `obra-request-review` |
| 7 | `audit-client` | ✅ Operational | `react-component-patterns`, `typescript-advanced-patterns`, `obra-verify` |
| 8 | `gl-ts-expert` | ✅ Operational | `typescript-advanced-patterns`, `tob-sharp-edges`, `tob-variant-analysis` |
| 9 | `gl-security` | ✅ Operational | `security-auth-patterns`, `community-security-blue`, `better-auth-best-practices`, `tob-differential-review` |
| 10 | `gl-schema` | ✅ Operational | `database-drizzle-patterns`, `neon-postgres`, `community-postgres` |
| 11 | `gl-reviewer` | ✅ Operational | `security-auth-patterns`, `typescript-advanced-patterns`, `obra-receive-review`, `obra-request-review` |
| 12 | `gl-hive-memory` | ✅ Operational | `cognee-hive-memory`, `memory-systems`, `ctx-memory-systems` |
| 13 | `rfx-lead` | ✅ Operational | `orchestrator-agent-teams`, `multi-agent-patterns`, `cognee-hive-memory` |
| 14 | `rfx-security` | ✅ Operational | `security-auth-patterns`, `better-auth-best-practices`, `community-security-blue` |
| 15 | `rfx-route-validator` | ✅ Operational | `api-design-hono-patterns`, `typescript-advanced-patterns` |
| 16 | `rfx-schema-migrator` | ✅ Operational | `database-drizzle-patterns`, `neon-postgres` |
| 17 | `rfx-db-foundation` | ✅ Operational | `database-drizzle-patterns`, `neon-postgres`, `community-postgres` |
| 18 | `rfx-code-quality` | ✅ Operational | `typescript-advanced-patterns`, `obra-tdd`, `testing-quality-assurance` |
| 19 | `rfx-ops-gate` | ✅ Operational | `devops-infrastructure`, `neon-postgres`, `obra-verify` |
| 20 | `routing-auditor` | ✅ Operational | `api-design-hono-patterns`, `tob-differential-review` |
| 21 | `routing-plan-lead` | ✅ Operational | `orchestrator-agent-teams`, `obra-writing-plans`, `multi-agent-patterns` |
| 22 | `best-practices-researcher` | ✅ Operational | `community-deep-research`, `tob-audit-context`, `obra-request-review` |
| 23 | `db-connection-auditor` | ✅ Operational | `database-drizzle-patterns`, `neon-postgres`, `community-postgres` |
| 24 | `plan-writer` | ✅ Operational | `obra-writing-plans`, `obra-executing-plans`, `multi-agent-patterns` |
| 25 | `auth-architect` | ✅ **NEW** | `security-auth-patterns`, `better-auth-best-practices`, `community-security-blue`, `typescript-advanced-patterns`, `api-design-hono-patterns` |
| 26 | `api-contract-auditor` | ✅ **NEW** | `api-design-hono-patterns`, `database-drizzle-patterns`, `typescript-advanced-patterns`, `tob-differential-review`, `tob-sharp-edges` |
| 27 | `validation-enforcer` | ✅ **NEW** | `api-design-hono-patterns`, `typescript-advanced-patterns`, `error-handling-patterns` |

### MCP Configuration (All 27 agents)

All agents must use:
- **Context7** — `resolve-library-id` + `query-docs` for up-to-date Hono/Drizzle/React/Neon docs
- **Serena** — `find_symbol`, `search_for_pattern`, `get_symbols_overview` for codebase navigation
- **Cognee Hive Memory** — query at session start, store findings at session end

Specialist agents additionally use:
- **sonatype-guide** — `gl-reviewer`, `gl-security`, `audit-security` for CVE scanning
- **playwright** — E2E test agents for route validation
- **github** — `rfx-lead`, `plan-writer`, `routing-plan-lead` for PR/issue management

---

## 2. Backend Code Audit — Findings

### CRITICAL Issues

#### CRIT-01: Weak Password Validation on Legacy Register Route
**File**: `server/src/routes/auth-routes.ts:18-22`
**Severity**: CRITICAL
**Description**: The legacy `/auth/register` endpoint uses a locally-defined `registerSchema` with `password: z.string().min(1)`. This allows any single character as a valid password. The production-hardened `registerSchema` in `server/src/validation/auth.ts` (which requires min 8 chars + upper/lower/digit) is NOT used here.

```typescript
// auth-routes.ts (VULNERABLE — min 1)
const registerSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),   // ← ANY single character passes
});

// validation/auth.ts (CORRECT — min 8 + complexity)
export const registerSchema = loginSchema.extend({ ... });
// loginSchema has password: z.string().min(8)
```

**Fix**: Replace the local `registerSchema` in `auth-routes.ts` with `import { registerSchema } from '../validation/auth.js'`. Additionally, call `authService.validatePassword()` before registering.

**Assigned to**: `auth-architect`

---

#### CRIT-02: No Rate Limiting on Refresh Token Endpoints
**File**: `server/src/index.ts:241-243`, `server/src/routes/auth-routes.ts:88`, `server/src/routes/api-auth.ts`
**Severity**: CRITICAL
**Description**: `authLimiter` (5 attempts/15 min in production) is applied to login endpoints but NOT to refresh endpoints. An attacker with a stolen refresh token can generate unlimited new access tokens by repeatedly calling `/auth/refresh` or `/api/auth/refresh`.

```typescript
// index.ts — only login is rate-limited
app.use('/api/admin/login', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/auth/login', authLimiter);
// ← /auth/refresh and /api/auth/refresh have NO rate limiting
```

**Fix**: Add `app.use('/auth/refresh', authLimiter)` and `app.use('/api/auth/refresh', authLimiter)` in `index.ts`.

**Assigned to**: `auth-architect`

---

#### CRIT-03: 55 Mutating Routes Missing zValidator Body Validation
**Files**: 30+ route files across `server/src/routes/`
**Severity**: CRITICAL
**Description**: 55 POST/PUT/PATCH handlers receive unvalidated request bodies via `c.req.json()` without `zValidator`. This violates the CLAUDE.md Golden Rule and exposes the server to malformed/malicious payloads, type confusion attacks, and unhandled exceptions.

Top offenders:
- `routes/members.ts:67,101` — member role updates and member creation
- `routes/merchant-ops.ts:25,89,239` — merchant operations
- `routes/agent-streaming.ts:28,67` — streaming action confirmations
- `routes/invitations-ext.ts:24` — invitation operations
- `routes/ap-extras.ts:20,31` — void/cancel operations (no body but should validate `{}`-schema)

**Fix**: Add Zod schemas + `zValidator('json', schema)` to all 55 routes.

**Assigned to**: `validation-enforcer`

---

### HIGH Issues

#### HIGH-01: Dual Authentication Systems Creating Inconsistency
**Files**: `server/src/routes/auth-routes.ts`, `server/src/routes/api-auth.ts`
**Severity**: HIGH
**Description**: Two parallel auth systems exist:
- `/auth/*` — legacy, uses local weak schemas, calls `authService.login()`
- `/api/auth/*` — tenant-aware, uses `validation/auth.ts` schemas, calls `adminAuthService.generateTenantToken()`

Both are live and accessible. The legacy system has weaker validation, leaks different error shapes, and creates maintenance surface. The legacy `/auth/login` generates non-tenant tokens that get elevated to `owner` role in `tenantAuthMiddleware` without verifying actual tenant membership.

**Fix**: Deprecate `/auth/*` routes. Migrate all clients to `/api/auth/*`. Remove `auth-routes.ts` after client migration.

**Assigned to**: `auth-architect`

---

#### HIGH-02: err.message Leaked to API Responses in 30+ Files
**Files**: `routes/admin-auth-routes.ts:148,175`, `routes/agent-routes-extended/*.ts`, `routes/agents.ts`, `routes/analytics.ts` and 25+ more
**Severity**: HIGH
**Description**: Catch blocks across the codebase return `err.message` directly:
```typescript
return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
```
This can expose internal implementation details, stack traces, database error messages (including column names, table names), or file paths in production.

**Fix**: Replace all inline `err.message` returns with `getErrorMessage(err)` from `utils/error.ts`, and use generic messages for 500 errors. Only log the full error server-side.

**Assigned to**: `rfx-code-quality`

---

#### HIGH-03: Legacy Token Grants owner Role Without Tenant Membership Check
**File**: `server/src/services/auth-middleware.ts:123-142`
**Severity**: HIGH
**Description**: When a legacy JWT (containing `userId` but no `tenantId`) is presented with an `X-Tenant-Id` header, `tenantAuthMiddleware` sets `role: 'owner'` and `permissions: []` without verifying the user is a member of the specified tenant:

```typescript
// auth-middleware.ts — legacy JWT fallback
if (legacyPayload && legacyPayload.userId) {
  c.set('userId', legacyPayload.userId as string);
  c.set('role', 'owner');  // ← Elevated to owner with NO membership check
  c.set('permissions', []);
  const headerTenantId = c.req.header('X-Tenant-Id');
  if (headerTenantId) {
    c.set('tenantId', headerTenantId);  // ← Any tenant ID accepted
  }
  return next();
}
```

**Fix**: Add `await tenantService.getMemberTenants(userId)` check before granting access. Reject if user is not a member of the specified tenant.

**Assigned to**: `auth-architect`

---

#### HIGH-04: CORS Allows Hardcoded Localhost in All Environments
**File**: `server/src/index.ts:90`
**Severity**: HIGH
**Description**: `http://localhost:8080` and `http://localhost:3501` are hardcoded in the CORS `allowed` array without checking `isProd`. In production, these should not be allowed origins.

```typescript
const allowed = [
  'http://localhost:5173',  // dev Vite
  'http://localhost:8080',  // ← always allowed, even in production
  'http://localhost:3501',  // ← server port always allowed
  ...(process.env.ALLOWED_ORIGINS?.split(',')...),
];
```

**Fix**: Wrap localhost origins in `!isProd` check. Production CORS should only include `process.env.ALLOWED_ORIGINS`.

**Assigned to**: `rfx-security` (or `auth-architect`)

---

#### HIGH-05: Refresh Token Rotation Not Enforced for Tenant Tokens
**Files**: `server/src/services/admin-auth/tenant-jwt.ts`, `server/src/routes/api-auth.ts`
**Severity**: HIGH
**Description**: `refreshTenantToken()` generates a new token from the existing one, but does NOT invalidate the old token in any DB table. The `sessions` table (which stores `refreshTokenHash`) is only used for admin users, not for tenant-scoped tokens. This means tenant refresh tokens are reusable indefinitely if stolen.

**Fix**: Implement single-use refresh token pattern: generate `refreshTokenHash`, store in `sessions`, invalidate on use. Or issue short-lived access tokens (15 min) with long-lived refresh tokens that are invalidated after a single use.

**Assigned to**: `auth-architect`

---

#### HIGH-06: Admin /refresh Endpoint Missing zValidator
**File**: `server/src/routes/admin-auth-routes.ts:44`
**Severity**: HIGH
**Description**: `adminAuthRoutes.post('/refresh', async (c) => {...})` reads the token from `Authorization` header but does not validate the request body at all. While the body is empty, the route is inconsistent with project standards and should use at minimum `zValidator('json', z.object({}))`  for consistency and protection.

More importantly, the admin refresh route (`/api/admin/refresh`) has NO rate limiting applied at all.

**Fix**: Add `app.use('/api/admin/refresh', authLimiter)` in `index.ts`.

**Assigned to**: `auth-architect`

---

#### HIGH-07: User Register Does Not Call validatePassword()
**File**: `server/src/services/auth/auth-service.ts:11-21`
**Severity**: HIGH
**Description**: `AuthService.register()` calls `bcrypt.hash()` directly without first running `validatePassword()`. The password complexity check only exists in `admin-auth/account-management.ts`. Regular user registration has no complexity enforcement beyond schema `min(8)`.

```typescript
async register(username: string, password: string) {
  const existing = await userRepository.findByUsername(username);
  // ← No validatePassword() call
  const passwordHash = await bcrypt.hash(password, 10);
  ...
}
```

**Fix**: Import and call `validatePassword()` from `admin-auth` at the top of `AuthService.register()`. Throw an error if validation fails.

**Assigned to**: `auth-architect`

---

#### HIGH-08: 70 Files Over 300-Line Limit
**Files**: 70 server-side `.ts` files violate the 300-line rule
**Severity**: HIGH
**Description**: Top offenders:
| Lines | File |
|-------|------|
| 695 | `services/parsers/documents/credit-card/cba-credit.ts` |
| 622 | `services/cognee_client/client.ts` |
| 500 | `services/claude/agents/forecasting-agent/agent.ts` |
| 488 | `services/claude/agents/multi-entity-agent/agent.ts` |
| 452 | `services/financial-reports/report-service.ts` |
| 439 | `services/parsers/formats/csv-parser.ts` |

**Fix**: Apply the mandatory split pattern from CLAUDE.md: create directory + index.ts barrel. Assign rfx-code-quality to split the top 20 offenders.

**Assigned to**: `rfx-code-quality`

---

### MEDIUM Issues

#### MED-01: Invitation Tokens Use UUID (122 bits) — Upgrade to 256 bits
**File**: `server/src/services/tenant/invitations.ts:52`
**Severity**: MEDIUM
**Description**: `const token = crypto.randomUUID()` generates 122 bits of entropy. Industry recommendation for invitation/reset tokens is 256 bits.

**Fix**: Replace with `const token = crypto.randomBytes(32).toString('hex')` (256 bits).

---

#### MED-02: Role Field Stored as Untyped text() in DB
**File**: `server/src/schema/multitenant.ts:27`
**Severity**: MEDIUM
**Description**: `role: text('role').notNull().default('viewer')` has no DB-level enum constraint. Invalid role strings can be inserted.

**Fix**: Add a `CHECK` constraint or use Drizzle's `pgEnum` for role validation at the DB level.

---

#### MED-03: `auth-routes.ts` `/auth/refresh` Reads tenantId from Query Param
**File**: `server/src/routes/auth-routes.ts:91`
**Severity**: MEDIUM
**Description**: `const tenantId = c.req.query('tenantId')` — tenantId in URL query param. This leaks tenant context into server logs and browser history.

**Fix**: Move tenantId to request body and validate with zValidator.

---

#### MED-04: Admin Seed Uses Predictable Default Username
**File**: `server/src/services/admin-auth/account-management.ts:145`
**Severity**: MEDIUM
**Description**: Seeded admin username is always `admin` with email `admin@goldledger.local`. If `ADMIN_DEFAULT_PASSWORD` env var is not set, a random password is generated (good), but the predictable username aids enumeration attacks.

**Fix**: Make admin username configurable via `ADMIN_DEFAULT_USERNAME` env var. Log the auto-generated password to stdout only once on first run (with a clear warning).

---

#### MED-05: SSE Endpoint Accepts JWT via Query Parameter
**File**: `server/src/index.ts:258-268`
**Severity**: MEDIUM
**Description**: `/api/events` accepts JWT via `?token=` query parameter (necessary for EventSource API which can't set headers). This token is logged in server access logs, exposing it.

**Fix**: Consider implementing a short-lived SSE token exchange: client POSTs to get a 30-second SSE-specific token, then uses that in the query param. This minimizes exposure window.

---

#### MED-06: `parseInt()` Without Radix 10 — Legacy Violations
**Files**: `routes/transfers-ext.ts` (8x), `routes/market-prices.ts` (1x), `routes/market-sentiment.ts` (1x), others
**Severity**: MEDIUM
**Description**: `parseInt(x)` without radix 10 can misinterpret inputs starting with `0x` as hexadecimal.

**Fix**: Replace all `parseInt(x)` with `parseInt(x, 10)`. (rfx-security was tasked with this but may not be complete.)

---

#### MED-07: Legacy `/auth/register` Does Not Create a Tenant
**File**: `server/src/routes/auth-routes.ts:74-83`
**Severity**: MEDIUM
**Description**: Compared to `/api/auth/register` which creates a tenant on registration, the legacy route's tenant creation is optional and uses a different code path. New users onboarded via the legacy route may end up with no tenant, causing confusion.

---

#### MED-08: No MFA Enforcement at Login Despite Schema Support
**Files**: `server/src/schema/core.ts`, `server/src/validation/auth.ts:50-61`
**Severity**: MEDIUM
**Description**: `mfaSetupSchema` and `mfaVerifySchema` exist in validation, and MFA fields exist in the admin schema (`mfaSecret`), but MFA is not enforced during login. The MFA schema exists but is unused.

**Fix**: If MFA is planned, add TOTP verification step to the admin login flow. If not planned, remove the dead code.

---

#### MED-09: `c.req.json()` Still Used in Some Routes (Bypasses zValidator)
**Files**: Multiple route files
**Severity**: MEDIUM
**Description**: Some routes still call `c.req.json()` directly instead of using `c.req.valid('json')` after adding zValidator. This can create a pattern where zValidator is present but the validated data is not actually used.

**Fix**: Enforce `c.req.valid('json')` whenever zValidator is present. The `rfx-route-validator` agent should audit this.

---

### LOW Issues

#### LOW-01: bcrypt Rounds at 10 — Consider Argon2 for New Implementations
**Severity**: LOW
**Description**: bcrypt with 10 rounds is acceptable but Argon2id is the current OWASP recommendation for new systems. Consider migrating password hashing to argon2 for new accounts.

---

#### LOW-02: Token Expiry is 7 Days for User Tokens (Too Long)
**File**: `server/src/services/auth/auth-service.ts:20`
**Severity**: LOW
**Description**: `exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60` — 7-day access tokens with no refresh token mechanism for the legacy auth service.

**Fix**: Reduce access token lifetime to 15 minutes. Implement refresh token rotation.

---

#### LOW-03: No CSRF Protection for Cookie-Based Sessions
**Severity**: LOW
**Description**: The app uses JWT in Authorization headers (good — immune to CSRF), but if any session cookie is ever added, CSRF protection will be needed. Document this as an architectural constraint.

---

#### LOW-04: Missing Audit Log for Failed Login Attempts
**Severity**: LOW
**Description**: The `auditLog` table exists and is used via `auditMiddleware`, but failed login attempts are not explicitly recorded with the attemptedUsername and IP for security monitoring.

---

#### LOW-05: `settings_json` and `features_json` Stored as TEXT (Not JSONB)
**File**: `server/src/schema/multitenant.ts`
**Severity**: LOW
**Description**: JSON columns are stored as `text()` not `jsonb`. In PostgreSQL, JSONB enables indexing and faster queries on JSON fields.

---

#### LOW-06: No Account Lockout for Regular Users (Only Admin)
**Severity**: LOW
**Description**: `adminAuthService` implements account lockout after `MAX_LOGIN_ATTEMPTS` failed attempts, but `AuthService.login()` for regular users has no lockout mechanism.

---

## 3. Auth System Review — Multi-Tenant Architecture Assessment

### ✅ What's Working Well

| Feature | Status |
|---------|--------|
| Multi-tenant isolation via JWT `tenantId` claim | ✅ Implemented |
| X-Tenant-Id header verification against JWT | ✅ Implemented |
| Tenant active status check on every request | ✅ Implemented |
| RBAC: 5-level role hierarchy (viewer → owner) | ✅ Implemented |
| Permission-based access via `rolePermissions` table | ✅ Implemented |
| Sub-account invitations with expiry | ✅ Implemented |
| Admin lockout after failed attempts | ✅ Implemented |
| Rate limiting on login endpoints | ✅ Implemented |
| bcrypt password hashing (rounds: 10) | ✅ Implemented |
| Audit logging middleware on all routes | ✅ Implemented |
| Sessions table with device fingerprint | ✅ Implemented |

### ❌ Gaps Against Industry Standards

| Gap | Standard | Priority |
|-----|----------|----------|
| Weak password validation on legacy register | OWASP AUTH-07 | CRITICAL |
| No refresh token rotation for tenant tokens | RFC 6749 §10.4 | HIGH |
| Legacy tokens bypass tenant membership check | Zero-trust principle | HIGH |
| No account lockout for regular users | OWASP AUTH-07 | MEDIUM |
| MFA not enforced despite schema support | OWASP AUTH-08 | MEDIUM |
| 7-day access tokens (should be ≤15 min) | RFC 6749 §4.1.3 | LOW |

### Proposed Auth Architecture for Next Team

```
Client
  │
  ├── POST /api/auth/register  → zValidator(registerSchema) → validatePassword() → bcrypt → tenant create → JWT(15min) + refreshToken(7d)
  ├── POST /api/auth/login     → zValidator + authLimiter → bcrypt compare → membership check → JWT(15min) + refreshToken(7d, stored hash)
  ├── POST /api/auth/refresh   → authLimiter → verify refresh token → invalidate old hash → issue new pair
  └── DELETE /api/auth/logout  → invalidate refresh token in sessions table

JWT Payload (tenant-scoped):
  { userId, tenantId, role, permissions[], iat, exp(+15min) }

Refresh Token:
  - crypto.randomBytes(32).toString('hex') — 256 bits
  - Hash stored in sessions table (refreshTokenHash)
  - Single-use: invalidated on use (rotation)
  - 7-day expiry stored in sessions.expiresAt

Legacy /auth/* routes:
  - DEPRECATE: redirect to /api/auth/* with 301
  - Remove after client migration confirmed
```

---

## 4. Recommendations for Next Agent Team

### Phase 1: Security Hardening (Wave 1 — Parallel)

Assign to `auth-architect`:
1. Fix `auth-routes.ts` password validation (CRIT-01) — import from `validation/auth.ts`
2. Add `authLimiter` to all refresh endpoints (CRIT-02)
3. Fix legacy token tenant membership bypass (HIGH-03)
4. Add `validatePassword()` to `AuthService.register()` (HIGH-07)
5. Fix CORS hardcoded localhost in production (HIGH-04)
6. Upgrade invitation token to 256-bit (MED-01)
7. Fix `parseInt()` without radix 10 (MED-06)

Assign to `validation-enforcer`:
1. Add `zValidator` to all 55 missing POST/PUT/PATCH routes (CRIT-03)

### Phase 2: Architecture Consolidation (Wave 2 — After Wave 1)

Assign to `auth-architect`:
1. Implement refresh token rotation for tenant tokens (HIGH-05)
2. Deprecate `/auth/*` — redirect to `/api/auth/*`
3. Add account lockout for regular user `AuthService` (LOW-06)

Assign to `rfx-code-quality`:
1. Fix `err.message` exposure in all catch blocks (HIGH-02)
2. Split top 20 files over 300 lines (HIGH-08)
3. Add role DB enum constraint (MED-02)

### Phase 3: Observability & Hardening (Wave 3)

1. Implement MFA TOTP flow or remove dead MFA code (MED-08)
2. Replace `parseInt()` with Number() or parseInt(x, 10) everywhere
3. Add audit log entries for failed logins (LOW-04)
4. SSE token exchange mechanism (MED-05)
5. Migrate JSON columns to JSONB in schema (LOW-05)

---

## 5. Skill Reassignment Recommendations

For the next agent team, add these skills to the relevant agents:

| Agent | Add These Skills |
|-------|-----------------|
| `auth-architect` | `tob-insecure-defaults` — insecure auth configurations |
| `rfx-code-quality` | `tob-sharp-edges` — dangerous API patterns |
| `gl-reviewer` | `tob-differential-review` — security diff review |
| `rfx-schema-migrator` | `community-postgres` — PostgreSQL-specific patterns |
| `audit-security` | `openai-security-best` + `openai-security-threat` — OWASP checklists |
| `api-contract-auditor` | `ctx-tool-design` — tool/API contract design |
| `validation-enforcer` | `obra-tdd` — write tests alongside validation fixes |

---

## 6. Metrics Summary

| Metric | Value | Target |
|--------|-------|--------|
| Server TS errors | **0** | 0 ✅ |
| Client TS errors | **0** | 0 ✅ |
| `: any` occurrences | **8** | <50 ✅ |
| `as any` occurrences | **0** | 0 ✅ |
| `@ts-ignore` | **0** | 0 ✅ |
| POST/PUT/PATCH missing zValidator | **55** | 0 ❌ |
| Files over 300 lines | **70** | 0 ❌ |
| Auth endpoints with rate limiting | Login only | All ❌ |
| Agents configured | **27/27** | 27/27 ✅ |

---

## 7. Agent Operational Status

All 27 agents are configured and verified as operational. The 3 new agents are:

### `auth-architect` (NEW — Agent #25)
- **Status**: ✅ Operational — file created at `.claude/agents/auth-architect.md`
- **Focus**: Auth consolidation, JWT hardening, refresh token rotation, password policy
- **Skills**: security-auth-patterns, better-auth-best-practices, community-security-blue, typescript-advanced-patterns, api-design-hono-patterns
- **Tool access**: Read, Edit, Bash, Grep, Glob, Write, SendMessage

### `api-contract-auditor` (NEW — Agent #26)
- **Status**: ✅ Operational — file created at `.claude/agents/api-contract-auditor.md`
- **Focus**: API contract mismatches between routes, schemas, and client calls
- **Skills**: api-design-hono-patterns, database-drizzle-patterns, typescript-advanced-patterns, tob-differential-review, tob-sharp-edges
- **Tool access**: Read, Bash, Grep, Glob (READ-ONLY — audit mode)

### `validation-enforcer` (NEW — Agent #27)
- **Status**: ✅ Operational — file created at `.claude/agents/validation-enforcer.md`
- **Focus**: zValidator enforcement on all 55 missing mutating routes
- **Skills**: api-design-hono-patterns, typescript-advanced-patterns, error-handling-patterns
- **Tool access**: Read, Edit, Bash, Grep, Glob, Write, SendMessage

---

## 8. Launch Commands for Next Agent Team

### Auth Security Fix Team (recommended immediate action)
```bash
# From project root:
claude --agent auth-architect "Fix all CRITICAL and HIGH auth issues from docs/BACKEND_AUDIT_REPORT.md"
claude --agent validation-enforcer "Add zValidator to all 55 missing POST/PUT/PATCH routes"
```

### Via agent team (parallel):
```
TeamCreate(team_name="goldledger-auth-fix", description="Fix 26 issues from BACKEND_AUDIT_REPORT.md")
# Wave 1 (parallel):
Task(auth-architect) → CRIT-01, CRIT-02, HIGH-03, HIGH-04, HIGH-07, MED-01, MED-06
Task(validation-enforcer) → CRIT-03 (all 55 routes)
# Wave 2 (after Wave 1):
Task(rfx-code-quality) → HIGH-02, HIGH-08, MED-02
Task(auth-architect) → HIGH-05 (refresh token rotation)
```

---

*Report generated: 2026-02-20 | Next review recommended: after Wave 1 completion*
