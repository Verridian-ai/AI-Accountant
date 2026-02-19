# API Design & Hono Framework Patterns

## Overview
Hono is a small, ultrafast web framework built on Web Standards that works on any JavaScript runtime (Node.js, Cloudflare Workers, Deno, Bun). This skill covers core API routing patterns, validation strategies, middleware composition, and RESTful best practices specific to Hono.

## Key Patterns

### Pattern 1: Sub-App Routing Architecture
Hono supports modular route organization using sub-apps, which is how GoldLedger structures its 51+ route files.

```typescript
// services/auth.ts - Sub-app for authentication routes
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import * as z from 'zod'

const authRoutes = new Hono()

authRoutes.post(
  '/login',
  zValidator('json', z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })),
  async (c) => {
    const { email, password } = c.req.valid('json')
    // authentication logic
    return c.json({ token: '...' }, 200)
  }
)

export default authRoutes

// index.ts - Main app wiring
const app = new Hono()
app.route('/api/auth', authRoutes)
```

**Why this pattern**:
- Allows splitting routes into separate files/domains without losing type safety
- Each sub-app is a standalone Hono instance that can have its own middleware
- Main `index.ts` acts as a router hub, wiring sub-apps via `.route()`

### Pattern 2: Multi-Level Validation with zValidator
Hono's `zValidator` middleware from `@hono/zod-validator` validates different parts of requests (body, query, params, headers, cookies) with type inference.

```typescript
app.post(
  '/posts/:id',
  // Validate URL path parameters
  zValidator('param', z.object({
    id: z.string().uuid()
  })),
  // Validate query parameters
  zValidator('query', z.object({
    includeComments: z.coerce.boolean().optional()
  })),
  // Validate JSON request body
  zValidator('json', z.object({
    title: z.string().min(3),
    content: z.string().min(10),
    tags: z.array(z.string()).optional()
  })),
  // Handler receives typed context
  async (c) => {
    const { id } = c.req.valid('param')
    const { includeComments } = c.req.valid('query')
    const { title, content, tags } = c.req.valid('json')

    // All variables are fully typed from Zod schemas
    return c.json({ id, title, content, tags }, 201)
  }
)
```

**Key considerations**:
- Validators are applied in order; if one fails, subsequent handlers don't execute
- Each `zValidator` call adds a middleware layer
- Validated data accessed via `c.req.valid('target')`
- Zod `z.coerce` converts types (e.g., query strings to numbers)

### Pattern 3: Middleware Composition for Cross-Cutting Concerns
Hono allows global middleware and per-route middleware for auth, logging, error handling.

```typescript
import { Hono } from 'hono'
import { logger } from 'hono/logger'

const app = new Hono()

// Global middleware (applies to all routes)
app.use(logger())
app.use(corsMiddleware())
app.use(tenantAuthMiddleware)

// Sub-app with its own middleware
const adminRoutes = new Hono()
adminRoutes.use(requireAdminRole)

adminRoutes.delete(
  '/users/:userId',
  async (c) => {
    // Only reachable if requireAdminRole passes
    return c.json({ deleted: true })
  }
)

app.route('/api/admin', adminRoutes)
```

**Middleware execution order**:
1. Global app middleware runs first
2. Sub-app middleware runs second
3. Route-specific middleware (validators, guards) runs third
4. Handler executes last

### Pattern 4: Error Handling with Typed Responses
Hono provides type-safe response building with context methods.

```typescript
app.post('/users',
  zValidator('json', userSchema),
  async (c) => {
    try {
      const data = c.req.valid('json')
      const user = await createUser(data)
      return c.json({ user }, 201)
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json({ error: error.message }, 400)
      }
      if (error instanceof DuplicateEmailError) {
        return c.json({ error: 'Email already exists' }, 409)
      }
      // Default error response
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

// Error handler middleware
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Server error' }, 500)
})
```

### Pattern 5: Request Context Typing
Hono allows custom context types for tenant isolation, user data, and business logic.

```typescript
import { Hono, HonoRequest, Context } from 'hono'

// Extend Hono context
interface AppContext {
  Bindings: {
    DATABASE_URL: string
  }
  Variables: {
    tenantId: string
    userId: string
    userRole: 'admin' | 'user'
  }
}

const app = new Hono<AppContext>()

// Middleware sets variables
app.use('*', async (c, next) => {
  const tenantId = c.req.header('X-Tenant-Id')
  const user = parseJWT(c.req.header('Authorization'))

  c.set('tenantId', tenantId)
  c.set('userId', user.id)
  c.set('userRole', user.role)

  await next()
})

// Handler accesses typed variables
app.get('/me', (c) => {
  const tenantId = c.get('tenantId')  // Fully typed
  const userId = c.get('userId')

  return c.json({ userId, tenantId })
})
```

## Best Practices

- **One sub-app per domain**: Organize routes by business domain (auth.ts, transactions.ts, reports.ts, etc.)
- **Validate at boundaries**: Use zValidator on all public endpoints; never trust client input
- **Use Content-Type correctly**: JSON validation requires `Content-Type: application/json` header; form data requires `application/x-www-form-urlencoded` or `multipart/form-data`
- **Header names are lowercase**: When validating headers, use lowercase keys: `value['x-tenant-id']` not `value['X-Tenant-Id']`
- **Error first in zValidator**: Return error responses from validator callbacks to fail fast
- **Type your context**: Use `Hono<AppContext>` to get full type safety for middleware variables
- **Compose middleware defensively**: Later middleware may depend on earlier middleware running; order matters
- **Keep handlers lean**: Move business logic to services; handlers should orchestrate and respond

## Common Pitfalls

- **Missing Content-Type headers**: Form/JSON validation silently receives empty objects if Content-Type is wrong
- **Applying validators out of order**: Validators should follow logical dependency (params → query → body)
- **Forgetting to await middleware `next()`**: Breaks the middleware chain
- **Shadowing context variables**: Use unique variable names in `c.set()` to avoid overwriting critical data
- **Not handling validation errors**: zValidator catches errors; handlers must still implement try-catch for business logic
- **Mixing validator libraries**: Stick to either pure Hono validator or zValidator; don't mix approaches in same route

## GoldLedger Application

GoldLedger's backend follows Hono patterns:

1. **51+ sub-apps** in `server/src/routes/`: Each domain (auth, transactions, reports, admin, etc.) is a separate file exporting a Hono sub-app
2. **Central wiring** in `server/src/index.ts`: Main app wires all sub-apps via `app.route('/api/{domain}', domainRoutes)`
3. **Tenant isolation**: Global middleware injects `tenantId` from headers; routes access via `c.get('tenantId')`
4. **Validation pattern**: All POST/PATCH/PUT routes use `zValidator` from `@hono/zod-validator`
5. **Middleware stack**:
   - Logger (global)
   - CORS (global)
   - tenantAuthMiddleware (global, validates X-Tenant-Id + JWT)
   - Route-specific zValidators

**Example from GoldLedger** (`server/src/routes/transactions.ts`):
```typescript
const transactionsRoutes = new Hono()

transactionsRoutes.post(
  '/',
  zValidator('json', createTransactionSchema),
  async (c) => {
    const tenantId = c.get('tenantId')
    const data = c.req.valid('json')
    return c.json(await createTransaction(tenantId, data), 201)
  }
)

export default transactionsRoutes
```

## References

- [Hono Official Docs](https://hono.dev)
- [Hono Routing Guide](https://hono.dev/docs/guides/routing)
- [Hono Validation Guide](https://hono.dev/docs/guides/validation)
- [@hono/zod-validator](https://github.com/honojs/middleware/tree/main/packages/zod-validator)
- [RESTful API Best Practices](https://restfulapi.net)
