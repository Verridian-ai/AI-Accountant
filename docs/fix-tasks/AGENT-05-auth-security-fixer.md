# Agent-05: Auth & Security Fixer

**Your role**: Add missing auth middleware to 3 route files and fix JWT security issues.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every file change**: Run `cd server && npx tsc --noEmit` — must stay at 0 errors.

---

## FIX 1 (HIGH): Missing tenantAuthMiddleware on merchant-ops.ts

**File**: `server/src/routes/merchant-ops.ts`
**Lines**: ~1-30

**Problem**: This file creates a `new Hono()` sub-app but does NOT apply `tenantAuthMiddleware()`. Routes in this file include:
- POST `/pending-categorizations/:id/resolve`
- PATCH `/merchant-memory/:id`
- POST `/transfers`
- POST `/reconciliation-alerts/:id/resolve`

These write operations on transactions are accessible without authentication.

**Fix**: READ the file first. Find where the Hono app is created and add auth middleware immediately after. Pattern used in other protected route files:

```typescript
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const merchantOpsRoutes = new Hono();

// ADD THIS LINE:
merchantOpsRoutes.use('/*', tenantAuthMiddleware());

// ...rest of routes
```

Also check every route handler in this file for `c.get('jwtPayload')`. If the payload is accessed without null-checking, add a null guard:
```typescript
const payload = c.get('jwtPayload');
if (!payload) return c.json({ error: 'Unauthorized' }, 401);
const userId = payload.userId;
```

---

## FIX 2 (HIGH): Missing tenantAuthMiddleware on ap-extras.ts

**File**: `server/src/routes/ap-extras.ts`
**Lines**: ~1-20

**Problem**: This file has routes including:
- POST `/bills/:id/void`
- POST `/ap/aging`
- POST `/supplier-payments`

These are write operations with no auth check. The file uses `getUserId(c)` which may throw if JWT payload is not set.

**Fix**: Same pattern as above — READ the file, then add:
```typescript
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const apExtrasRoutes = new Hono();

// ADD THIS LINE:
apExtrasRoutes.use('/*', tenantAuthMiddleware());
```

---

## FIX 3 (MEDIUM): Missing tenantAuthMiddleware on stream-sessions.ts

**File**: `server/src/routes/stream-sessions.ts`
**Lines**: ~1-20

**Problem**: Streaming endpoints accessible without JWT:
- POST `/stream/agent/:agentType`
- GET `/stream/history`
- (and others)

**Fix**: READ the file. Add auth middleware. Note: this file may already use `sseStreamMiddleware()` — you need BOTH:
```typescript
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const streamSessionsRoutes = new Hono();

// ADD THIS LINE — before sseStreamMiddleware:
streamSessionsRoutes.use('/*', tenantAuthMiddleware());
```

---

## FIX 4 (MEDIUM): JWT_SECRET defaults to empty string

**File**: `server/src/services/auth-middleware.ts`
**Lines**: ~20

**Problem**: Empty string as JWT secret allows trivially forged tokens.

**Current code**:
```typescript
const JWT_SECRET = process.env.JWT_SECRET || '';
```

**Fix**: Fail loudly if JWT_SECRET is not set in production:
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production');
}
const jwtSecret = JWT_SECRET || 'dev-only-secret-change-in-prod';
```

Then use `jwtSecret` instead of `JWT_SECRET` throughout the file. This way development still works but production fails fast.

**Note**: Search for all uses of `JWT_SECRET` in this file and replace with `jwtSecret`.

---

## FIX 5 (LOW): Legacy JWT fallback grants owner role

**File**: `server/src/services/auth-middleware.ts`
**Lines**: ~168

**Problem**: The legacy JWT fallback code sets `role: 'owner'` which is maximum privilege.

**Current code**:
```typescript
c.set('role', 'owner');  // legacy tokens get max privileges
```

**Fix**: Change to a safer default role:
```typescript
c.set('role', 'viewer');  // legacy tokens get minimum privileges
```

Or better, remove the legacy JWT fallback entirely if it's no longer needed. READ the surrounding code to understand if removing it would break anything (e.g., if any existing users still use legacy tokens).

---

## HOW TO READ THE FILES

Before making any changes, READ each file fully:
- `server/src/routes/merchant-ops.ts` — understand all routes and current auth status
- `server/src/routes/ap-extras.ts` — same
- `server/src/routes/stream-sessions.ts` — same
- `server/src/services/auth-middleware.ts` — understand the full auth chain

The files may have been updated since the audit. Only add the middleware if it's actually missing.

---

## VERIFICATION

After all changes:
```bash
cd server && npx tsc --noEmit
```

Then test that auth is working (manually or via existing tests):
```bash
# Test that unauthenticated request is rejected:
curl -X POST http://localhost:3501/api/transfers -H "Content-Type: application/json" -d '{}'
# Should return 401, not 500 or 200
```

Commit:
```bash
git add server/src/routes/merchant-ops.ts
git add server/src/routes/ap-extras.ts
git add server/src/routes/stream-sessions.ts
git add server/src/services/auth-middleware.ts
git commit -m "fix(security): add tenantAuthMiddleware to unprotected routes, JWT_SECRET hardening"
```
