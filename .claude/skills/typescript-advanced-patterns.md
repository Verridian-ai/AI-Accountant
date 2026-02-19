# TypeScript Advanced Patterns

## Overview
Advanced TypeScript patterns used across GoldLedger's strict-mode codebase. Covers discriminated unions for type-safe agent results, template literal types for route safety, conditional types, Zod integration at API boundaries, utility types, and safe casting strategies. All code must have zero `: any` and zero `as any`.

## Key Patterns

### Pattern 1: Discriminated Unions for Agent Results
Agent operations can succeed, fail, or fall back. Model this explicitly instead of using `any`.

```typescript
// Discriminated union — TypeScript narrows type by 'type' field
type AgentResult<T> =
  | { type: 'success'; data: T; model: string; tokensUsed: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'fallback'; data: T; reason: string };

// Usage — TypeScript guarantees exhaustive handling
function handleCategorization(result: AgentResult<string>): string {
  switch (result.type) {
    case 'success':
      return result.data;               // TypeScript knows: data exists, model exists
    case 'fallback':
      console.warn('Using fallback:', result.reason);
      return result.data;
    case 'error':
      throw new Error(`[${result.code}] ${result.message}`);
    // TypeScript error if a case is missing — exhaustive checking
  }
}

// Discriminated unions for DB row types
type TransactionRow =
  | { kind: 'debit'; amount: number; merchant: string }
  | { kind: 'credit'; amount: number; source: string }
  | { kind: 'transfer'; amount: number; fromAccount: string; toAccount: string };

function formatTransaction(tx: TransactionRow): string {
  if (tx.kind === 'transfer') {
    return `Transfer: ${tx.fromAccount} → ${tx.toAccount}`;  // fromAccount/toAccount guaranteed
  }
  return `${tx.kind}: ${tx.merchant ?? tx.source}`; // Never: property doesn't exist error
}
```

### Pattern 2: Template Literal Types for Route Safety
Type-safe API route construction — prevents typos in route strings.

```typescript
// Define valid route segments as string literals
type ApiVersion = 'v1' | 'v2';
type Resource = 'transactions' | 'accounts' | 'statements' | 'reports';
type Action = 'list' | 'detail' | 'create' | 'update' | 'delete';

// Compose routes at the type level
type ApiRoute = `/api/${Resource}` | `/api/${Resource}/${string}`;
type AdminRoute = `/api/admin/${string}`;

// Typed fetch wrapper — compiler catches invalid routes
async function apiGet<T>(route: ApiRoute): Promise<T> {
  const res = await fetch(`http://localhost:3501${route}`);
  if (!res.ok) throw new Error(`GET ${route} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// Hono route type inference
import { Hono } from 'hono';
const app = new Hono();

// TypeScript infers the param types from the route string
app.get('/api/transactions/:id', (c) => {
  const id: string = c.req.param('id'); // Correctly typed
  return c.json({ id });
});
```

### Pattern 3: Conditional Types for Generic Utilities
Build flexible utilities that adapt their return type based on input.

```typescript
// Conditional type — T extends null ? default : T
type NonNullable<T> = T extends null | undefined ? never : T;

// Paginated response unwrapping
type Unpacked<T> = T extends Array<infer U> ? U : T;

// Make all properties optional deeply
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// Make specific properties required
type RequireFields<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Usage: Transaction insert requires amount and date but makes others optional
type TransactionInsert = RequireFields<
  Partial<Transaction>,
  'amount' | 'date' | 'accountId'
>;

// Extract return type from async function
type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> =
  T extends (...args: unknown[]) => Promise<infer R> ? R : never;

// Usage
const fetchTransaction = async (id: string) => ({ id, amount: 100 });
type FetchedTransaction = AsyncReturnType<typeof fetchTransaction>;
// FetchedTransaction = { id: string; amount: number }
```

### Pattern 4: Zod Integration at API Boundaries
Use Zod for runtime validation + TypeScript type inference at API entry points.

```typescript
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

// Schema drives BOTH validation AND TypeScript types
const CreateTransactionSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().int().describe('Amount in cents — always integer'),
  merchant: z.string().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  gstAmount: z.number().int().optional(),
  categoryId: z.string().uuid().optional(),
});

// Infer TypeScript type from schema
type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

// Wire Zod validation into Hono — automatic 400 on invalid body
app.post(
  '/api/transactions',
  zValidator('json', CreateTransactionSchema),
  async (c) => {
    const body = c.req.valid('json'); // Fully typed: CreateTransactionInput
    // body.amount is number, body.accountId is string, etc.
    return c.json({ id: 'new-id', ...body }, 201);
  }
);

// Nested schemas with transforms
const TransactionFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  dateFrom: z.string().optional().transform(s => s ?? null),
  search: z.string().trim().optional(),
});

type TransactionFilters = z.infer<typeof TransactionFilterSchema>;
```

### Pattern 5: Safe Casting — `as unknown as T`
When you MUST cast (e.g., around `wrapPgDb()` proxy), use `as unknown as T` not `as any`.

```typescript
// The ONLY acceptable casting pattern — never `as any`
function unwrapDbResult<T>(result: unknown): T {
  return result as unknown as T;
}

// When working with the wrapPgDb() proxy (schema.ts)
// The proxy returns `any` at runtime but we can type it at call sites
import type { Transaction } from '../schema';

async function getTransaction(id: string): Promise<Transaction | undefined> {
  const db = getDb();
  const rows = await db.select().from('transactions').where({ id });
  // Safe cast — we know the shape from the schema definition
  return (rows[0] as unknown as Transaction) ?? undefined;
}

// Type guard pattern — safer than casting
function isTransaction(row: unknown): row is Transaction {
  return (
    typeof row === 'object' &&
    row !== null &&
    'id' in row &&
    'amount' in row &&
    typeof (row as Record<string, unknown>).amount === 'number'
  );
}
```

### Pattern 6: Mapped Types for Schema Variants
Generate read/write/update variants from a single base type.

```typescript
// Base DB row type from Drizzle inference
type TransactionBase = {
  id: string;
  amount: number;
  merchant: string;
  date: string;
  createdAt: Date;
  updatedAt: Date;
};

// Insert: omit auto-generated fields
type TransactionInsert = Omit<TransactionBase, 'id' | 'createdAt' | 'updatedAt'>;

// Update: all fields optional except id
type TransactionUpdate = Partial<Omit<TransactionBase, 'id' | 'createdAt' | 'updatedAt'>>;

// API response: format dates as strings
type TransactionResponse = Omit<TransactionBase, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

// Serialize for API response
function toTransactionResponse(tx: TransactionBase): TransactionResponse {
  return {
    ...tx,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}
```

### Pattern 7: Const Assertions and Enums
Use `as const` for immutable configuration objects — better than TypeScript enums.

```typescript
// Prefer const objects over TypeScript enums (enums generate runtime JS)
const TRANSACTION_CATEGORIES = {
  FOOD: 'food_dining',
  TRANSPORT: 'transport',
  UTILITIES: 'utilities',
  INCOME: 'income',
  GST_FREE: 'gst_free',
} as const;

type TransactionCategory = typeof TRANSACTION_CATEGORIES[keyof typeof TRANSACTION_CATEGORIES];
// TransactionCategory = 'food_dining' | 'transport' | 'utilities' | 'income' | 'gst_free'

// Agent names as const array
const AGENT_NAMES = [
  'statement_parser',
  'transaction_categorizer',
  'gst_calculator',
  'tax_strategy',
] as const;

type AgentName = typeof AGENT_NAMES[number];
// AgentName = 'statement_parser' | 'transaction_categorizer' | ...
```

## Best Practices
- Never use `: any` — use `unknown` then narrow with type guards or Zod parse
- Never use `as any` — use `as unknown as T` when casting is unavoidable
- Use discriminated unions for all multi-state results (success/error/fallback)
- Zod schemas at EVERY API boundary — infer TypeScript types from Zod, never duplicate
- Prefer `const` objects with `as const` over TypeScript enums
- `z.coerce.number()` for query params (they arrive as strings)
- Use `Omit<T, 'id'>` patterns to derive Insert/Update types from base types

## Common Pitfalls
- **`@ts-ignore`**: Forbidden in GoldLedger — always fix the underlying type issue
- **`as any`**: Blocked by pre-commit hook — use `as unknown as T` or type guards
- **Enum at runtime**: TypeScript enums generate JS objects — prefer `as const` objects
- **Missing `z.coerce`**: Query params are always strings — `z.number()` won't parse `'50'`
- **Duplicating types**: Define once with Zod `z.infer<>`, import everywhere
- **Unsafe `JSON.parse`**: Always type as `unknown`, then Zod parse or type guard

## GoldLedger Application
- **Type rules**: Enforced by pre-commit hook that blocks `@ts-ignore` and `as any`
- **Schema types**: `server/src/schema.ts` — Drizzle infers types; use `InferSelectModel<typeof table>`
- **Agent results**: Use discriminated unions in `server/src/services/agents/`
- **API validation**: Every POST/PATCH/PUT uses `zValidator` — see `server/src/routes/`
- **wrapPgDb()**: Returns `any` by design (proxy) — cast at call sites with `as unknown as T`
- **CLAUDE.md rule**: `as any` count was 299 → 0 after Phase A refactoring

## References
- TypeScript handbook: https://www.typescriptlang.org/docs/handbook/
- Zod docs: https://zod.dev/
- Discriminated unions: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
- Template literal types: https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
