# Security & Authentication Patterns

## Overview
Secure authentication and authorization are critical for financial applications. This skill covers JWT-based authentication, role-based access control (RBAC), secure password handling, token management, and integration patterns specific to GoldLedger's multi-tenant architecture.

## Key Patterns

### Pattern 1: JWT Token Generation and Validation
JWT (JSON Web Tokens) provide stateless authentication suitable for distributed systems and serverless environments.

```typescript
// services/auth.ts
import { sign, verify } from 'hono/jwt'

interface TokenPayload {
  userId: string
  tenantId: string
  role: 'admin' | 'accountant' | 'user'
  email: string
  iat: number
  exp: number
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key'
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours in ms

export const generateToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>) => {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + TOKEN_EXPIRY / 1000

  return sign(
    {
      ...payload,
      iat: now,
      exp,
    },
    JWT_SECRET
  )
}

export const verifyToken = async (token: string): Promise<TokenPayload | null> => {
  try {
    const payload = await verify(token, JWT_SECRET)
    return payload as TokenPayload
  } catch (error) {
    // Token invalid, expired, or tampered
    return null
  }
}
```

**Key security principles**:
- **HTTPS only**: Always transmit tokens over TLS/HTTPS; never HTTP
- **Short expiry**: 15-60 minutes for access tokens; use refresh tokens for longer sessions
- **Sign with strong secret**: Use cryptographically secure secrets (minimum 32 bytes)
- **Validate signature**: Always verify token signature server-side
- **Check expiry**: Always check `exp` claim to prevent replay

### Pattern 2: Secure Middleware for Tenant Isolation
Global middleware validates tokens and enforces tenant boundaries.

```typescript
// middleware/auth.ts
import { Context } from 'hono'
import { verifyToken } from '../services/auth'

export interface AuthContext {
  Variables: {
    userId: string
    tenantId: string
    userRole: 'admin' | 'accountant' | 'user'
    email: string
  }
}

export const tenantAuthMiddleware = async (c: Context, next: () => Promise<void>) => {
  // Extract Authorization header
  const auth = c.req.header('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization' }, 401)
  }

  const token = auth.slice(7) // Remove 'Bearer '
  const payload = await verifyToken(token)

  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  // Validate tenant ID from header matches token
  const headerTenantId = c.req.header('x-tenant-id')
  if (!headerTenantId || headerTenantId !== payload.tenantId) {
    return c.json({ error: 'Tenant mismatch' }, 403)
  }

  // Attach to context for downstream middleware/handlers
  c.set('userId', payload.userId)
  c.set('tenantId', payload.tenantId)
  c.set('userRole', payload.role)
  c.set('email', payload.email)

  await next()
}

export const requireRole = (...roles: string[]) => {
  return async (c: Context, next: () => Promise<void>) => {
    const userRole = c.get('userRole')

    if (!roles.includes(userRole)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    await next()
  }
}
```

### Pattern 3: Password Security with Bcrypt
Passwords must be hashed using strong algorithms; never store plaintext.

```typescript
// services/password.ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12 // Higher = slower but more secure

export const hashPassword = async (password: string): Promise<string> => {
  // Validate password strength before hashing
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters')
  }

  return bcrypt.hash(password, SALT_ROUNDS)
}

export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash)
  } catch (error) {
    // bcrypt.compare timing-safe, won't leak via timing attacks
    return false
  }
}

// Usage in authentication
app.post('/auth/login',
  zValidator('json', z.object({
    email: z.string().email(),
    password: z.string().min(8),
  })),
  async (c) => {
    const { email, password } = c.req.valid('json')

    // Fetch user by email
    const user = await findUserByEmail(email)
    if (!user) {
      // IMPORTANT: Don't reveal if email exists (prevent enumeration)
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash)
    if (!passwordValid) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    })

    return c.json({ token }, 200)
  }
)
```

### Pattern 4: CORS and Security Headers
Prevent cross-site attacks with proper header configuration.

```typescript
// middleware/security.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

const app = new Hono()

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
  exposeHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 600,
}))

// Security headers (OWASP recommendations)
app.use(secureHeaders())

// Additional security headers
app.use(async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  await next()
})
```

### Pattern 5: Rate Limiting to Prevent Abuse
Protect against brute force and DoS attacks.

```typescript
// middleware/rate-limit.ts
import { Hono } from 'hono'

const loginAttempts = new Map<string, { count: number; resetTime: number }>()

export const rateLimitLogin = async (c: Hono.Context, next: () => Promise<void>) => {
  const email = (await c.req.json()).email
  const now = Date.now()

  const attempt = loginAttempts.get(email) || { count: 0, resetTime: now + 15 * 60 * 1000 }

  if (now > attempt.resetTime) {
    // Reset after 15 minutes
    attempt.count = 0
    attempt.resetTime = now + 15 * 60 * 1000
  }

  if (attempt.count >= 5) {
    return c.json(
      { error: 'Too many login attempts. Try again in 15 minutes.' },
      429
    )
  }

  attempt.count++
  loginAttempts.set(email, attempt)

  await next()
}

// For production, use Redis-backed rate limiter
import { createClient } from 'redis'

const redis = createClient()

export const rateLimitRedis = async (c: Hono.Context, next: () => Promise<void>) => {
  const key = `rate-limit:${c.req.header('X-Forwarded-For') || 'unknown'}`
  const limit = 100
  const window = 60 // seconds

  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, window)
  }

  if (current > limit) {
    c.header('Retry-After', String(window))
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }

  await next()
}
```

## Best Practices

- **Never log secrets**: Exclude tokens, passwords, keys from logs
- **Use HTTPS everywhere**: Transport security is non-negotiable
- **Implement RBAC at query level**: Enforce tenant isolation in database queries
- **Rotate keys periodically**: Change JWT secrets every 6-12 months
- **Implement MFA for admins**: Require second factor for sensitive roles
- **Audit sensitive actions**: Log who accessed what and when
- **Use secure defaults**: Deny by default; grant permissions explicitly
- **Validate on server**: Never trust client-side validation alone
- **Sanitize error messages**: Don't leak user existence, password requirements
- **Implement account lockout**: Prevent brute force after N failed attempts

## Common Pitfalls

- **Storing tokens in localStorage**: Vulnerable to XSS; use `httpOnly` cookies
- **Embedding secrets in code**: Use environment variables exclusively
- **Weak password requirements**: Enforce minimum 12 characters, complexity
- **Expired token handling**: Client must request new token; don't retry with expired token
- **Cross-tenant data leaks**: Always filter queries by tenantId
- **Timing attacks**: Use constant-time comparison for passwords/tokens
- **Not validating token signature**: Accepting any JWT breaks security
- **CORS wildcard origin**: `*` exposes endpoints to any origin
- **Missing rate limiting**: Opens doors to brute force and DoS

## GoldLedger Application

GoldLedger's security patterns:

1. **JWT authentication** with 24-hour expiry (short-lived access tokens)
2. **Tenant isolation** enforced at middleware layer via X-Tenant-Id header
3. **RBAC** with 5 roles: owner > admin > accountant > bookkeeper > viewer
4. **Password hashing** with bcrypt (12 rounds)
5. **Rate limiting** on login endpoint (5 attempts per 15 minutes)
6. **CORS** restricted to configured origins
7. **Security headers** via Hono secureHeaders middleware
8. **Audit logging** for sensitive operations (user creation, role changes, deletions)

**Example from GoldLedger** (`server/src/middleware/auth.ts`):
```typescript
export const tenantAuthMiddleware = async (c: Context, next) => {
  const auth = c.req.header('authorization')
  const tenantId = c.req.header('x-tenant-id')

  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = auth.slice(7)
  const payload = await verifyToken(token)

  if (!payload || payload.tenantId !== tenantId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  c.set('userId', payload.userId)
  c.set('tenantId', payload.tenantId)
  c.set('userRole', payload.role)

  await next()
}
```

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [bcryptjs Security](https://www.npmjs.com/package/bcryptjs)
- [Hono JWT Integration](https://hono.dev/docs/guides/jwt)
