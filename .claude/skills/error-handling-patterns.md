# Error Handling Patterns

## Overview
TypeScript error handling patterns for GoldLedger's Hono backend and React 19 frontend. Covers typed error hierarchies, Hono error middleware, React Error Boundaries, async Result types, and the common pitfall of silent failures (swallowed errors in catch blocks).

## Key Patterns

### Pattern 1: Typed Error Hierarchy
Create specific error classes instead of throwing plain `Error` or `string`.

```typescript
// Base application error
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Specific error types
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400, { fields });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, cause?: Error) {
    super(`Database error during ${operation}`, 'DATABASE_ERROR', 500, {
      cause: cause?.message,
    });
  }
}
```

### Pattern 2: Hono Global Error Handler
Wire a single error handler in `server/src/index.ts` to catch all unhandled errors.

```typescript
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AppError } from './errors';

const app = new Hono();

// Global error handler — must be before routes
app.onError((err, c) => {
  // Known application errors
  if (err instanceof AppError) {
    return c.json(
      { error: err.message, code: err.code, details: err.details },
      err.statusCode as 400 | 401 | 403 | 404 | 500
    );
  }

  // Hono HTTP exceptions (e.g., from zValidator)
  if (err instanceof HTTPException) {
    return c.json(
      { error: err.message, code: 'HTTP_ERROR' },
      err.status
    );
  }

  // Unexpected errors — log full error, return generic message
  console.error('[UNHANDLED ERROR]', {
    path: c.req.path,
    method: c.req.method,
    error: err instanceof Error ? err.stack : String(err),
  });

  return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});
```

### Pattern 3: Result Type for Async Operations
Avoid try/catch scattered everywhere — use a Result type for expected failures.

```typescript
type Ok<T> = { ok: true; value: T };
type Err<E> = { ok: false; error: E };
type Result<T, E = AppError> = Ok<T> | Err<E>;

function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// Usage in service layer
async function findTransaction(id: string): Promise<Result<Transaction>> {
  try {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!tx) return err(new NotFoundError('Transaction', id));
    return ok(tx);
  } catch (e) {
    return err(new DatabaseError('findTransaction', e instanceof Error ? e : undefined));
  }
}

// Usage in route handler
app.get('/api/transactions/:id', async (c) => {
  const result = await findTransaction(c.req.param('id'));
  if (!result.ok) throw result.error; // Hono error handler picks this up
  return c.json(result.value);
});
```

### Pattern 4: React Error Boundaries
Wrap feature pages in Error Boundaries to prevent full-app crashes.

```typescript
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to monitoring service
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="neu-inset p-6 m-4 text-center">
          <p className="text-red-400 mb-4">Something went wrong</p>
          <button onClick={this.reset} className="neu-raised px-4 py-2 text-sm">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <FeatureErrorBoundary>
      <TransactionsDashboard />
    </FeatureErrorBoundary>
  );
}
```

### Pattern 5: Nullish Coalescing vs Logical OR — Critical Distinction
The GoldLedger audit found 12 bugs caused by `||` treating `0` and `false` as falsy. **Always use `??` for null/undefined checks.**

```typescript
// WRONG: || treats 0, false, "" as falsy — hides valid values
const gstAmount = transaction.gstAmount || 0;  // 0 gst becomes 0 ✓ but -1 also 0 ✗

// CORRECT: ?? only replaces null/undefined
const gstAmount = transaction.gstAmount ?? 0;  // Only replaces null/undefined

// WRONG: || for optional config
const pageSize = options.pageSize || 50;  // pageSize: 0 would use 50 — wrong!

// CORRECT:
const pageSize = options.pageSize ?? 50;

// Pattern for nested optional access
const amount = transaction?.account?.balance ?? 0;
const merchant = transaction?.merchant ?? 'Unknown Merchant';
```

### Pattern 6: Async Error Wrapping in Routes
Always wrap async Hono handlers — unhandled Promise rejections crash the server.

```typescript
// Helper to wrap async handlers
function asyncHandler<T>(
  handler: (c: Context) => Promise<T>
): (c: Context) => Promise<T> {
  return async (c) => {
    try {
      return await handler(c);
    } catch (err) {
      // Re-throw AppError as-is, wrap unknown errors
      if (err instanceof AppError) throw err;
      throw new AppError(
        'Unexpected error',
        'UNEXPECTED',
        500,
        { cause: err instanceof Error ? err.message : String(err) }
      );
    }
  };
}

// Usage
app.post('/api/transactions', asyncHandler(async (c) => {
  const body = await c.req.json() as unknown;
  // ... handler code
  return c.json({ success: true });
}));
```

### Pattern 7: Silent Failure Detection
Never swallow errors in catch blocks without logging or re-throwing.

```typescript
// WRONG: Silently ignores failures — data corruption risk
async function categorizeTransaction(id: string) {
  try {
    await aiCategorize(id);
  } catch {
    // Silent! User never knows categorization failed
  }
}

// CORRECT: Log + degrade gracefully
async function categorizeTransaction(id: string): Promise<string> {
  try {
    return await aiCategorize(id);
  } catch (err) {
    console.error('[categorizeTransaction] AI failed', { id, err });
    return 'Uncategorized'; // Explicit fallback
  }
}

// CORRECT: Propagate in critical paths
async function saveTransaction(tx: Transaction): Promise<void> {
  try {
    await db.insert(transactions).values(tx);
  } catch (err) {
    // MUST re-throw — data loss if we swallow this
    throw new DatabaseError('saveTransaction', err instanceof Error ? err : undefined);
  }
}
```

## Best Practices
- Use `??` instead of `||` for all null/undefined checks — never use `||` on numeric values
- Create typed error classes for all domain-specific errors
- Wire Hono `onError` handler at app root before any routes
- Wrap every feature page in React Error Boundary
- Never swallow errors in catch blocks — always log or re-throw
- Use Result types for expected failures (not found, invalid input)
- Log full stack traces server-side, return minimal info to client

## Common Pitfalls
- **`||` on numbers/booleans**: `amount || 0` breaks when `amount` is legitimately `0`
- **Empty catch blocks**: `catch {}` hides bugs — always at minimum `console.error`
- **Missing error boundary**: One component error crashes the entire React tree
- **Generic error messages**: `'Something failed'` makes debugging impossible
- **Throwing strings**: `throw 'error'` — always `throw new Error()` for stack traces
- **Async without try/catch**: Unhandled Promise rejections in Hono = server crash

## GoldLedger Application
- **Error classes**: Create in `server/src/errors/` — import across services
- **Hono error handler**: `server/src/index.ts` — single `app.onError()` at app root
- **React boundaries**: Wrap each `features/*/` page in `FeatureErrorBoundary`
- **`??` audit**: The audit found `||`→`??` bugs in `server/src/routes/bas.ts` — fixed
- **Chat error format**: `/api/chat` must return `{ answer: string }` not `{ error }` — client expects `answer` field
- **Cognee errors**: Wrap Cognee calls in try/catch — Cognee service may be unavailable

## References
- TypeScript error handling: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Hono error handling: https://hono.dev/docs/api/exception
- React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
