# Database Patterns & Drizzle ORM

## Overview
Drizzle ORM is a lightweight, type-safe, headless ORM for TypeScript that supports PostgreSQL, MySQL, and SQLite. This skill covers schema design, type-safe queries, migrations, relationships, and performance patterns specific to GoldLedger's PostgreSQL + Neon setup.

## Key Patterns

### Pattern 1: Type-Safe Schema Definition
Drizzle schemas are defined in TypeScript, providing full type safety and IDE autocomplete. Schemas serve double duty: runtime query definitions and migration generation.

```typescript
// schema.ts
import { pgTable, serial, varchar, integer, timestamp, boolean, decimal, foreignKey } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Table definitions
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  accountName: varchar('account_name', { length: 256 }).notNull(),
  accountNumber: varchar('account_number', { length: 20 }).notNull(),
  balance: integer('balance').notNull(), // cents, not floats
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull(),
  amount: integer('amount').notNull(), // cents
  description: varchar('description', { length: 512 }),
  transactionDate: timestamp('transaction_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  accountIdFk: foreignKey({
    columns: [table.accountId],
    foreignColumns: [accounts.id],
  }).onDelete('cascade'),
}))

// Relational definitions
export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
}))
```

**Key decisions**:
- **Integer for money**: Store all currency as cents (integers), never floats
- **tenantId in schema**: Multi-tenant isolation enforced at data layer
- **Timestamps**: Track creation and modification times
- **Foreign keys with cascade**: Define referential integrity at schema level
- **Relations**: Enable type-safe relational queries

### Pattern 2: Initializing Drizzle with Connection Pooling
Drizzle wraps your database client and provides type-safe query builders.

```typescript
// db.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Connection pool for better performance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max connections in pool
  idleTimeoutMillis: 30000,
})

// Initialize Drizzle with schema
export const db = drizzle(pool, { schema })

// Usage in routes/services
export const getAccountsByTenant = async (tenantId: string) => {
  return db.query.accounts.findMany({
    where: eq(schema.accounts.tenantId, tenantId),
    with: { transactions: true },
  })
}
```

**Connection pool strategy**:
- Reuse connections across requests (don't create new pool per request)
- Set reasonable max connections (10-20 for serverless, 50+ for servers)
- Configure idle timeout to prevent stale connections

### Pattern 3: Type-Safe Relational Queries
Drizzle's relational API provides compile-time type safety for nested queries.

```typescript
import { db } from './db'
import { eq } from 'drizzle-orm'

// Query with relations
const user = await db.query.accounts.findFirst({
  where: eq(accounts.id, accountId),
  with: {
    transactions: {
      // Nested filtering
      where: gt(transactions.amount, 10000), // amounts > $100
      // Nested ordering
      orderBy: (t, { desc }) => [desc(t.transactionDate)],
      // Limit nested results
      limit: 50,
    },
  },
})

// Result is fully typed:
// {
//   id: number
//   accountName: string
//   transactions: Array<{
//     id: number
//     amount: number
//     description: string | null
//   }>
// }

// Aggregation example
const accountWithCounts = await db.query.accounts.findMany({
  columns: {
    id: true,
    accountName: true,
  },
  with: {
    transactions: {
      columns: {
        id: true,
      },
    },
  },
})

// Custom aggregation
const transactionStats = await db.query.transactions.findMany({
  columns: {
    accountId: true,
    amount: true,
  },
  where: and(
    eq(transactions.accountId, accountId),
    gte(transactions.transactionDate, startDate),
    lte(transactions.transactionDate, endDate),
  ),
})

// Calculate in application code
const totalAmount = transactionStats.reduce((sum, t) => sum + t.amount, 0)
```

### Pattern 4: SQL Migrations with Drizzle Kit
Drizzle Kit generates SQL migrations from TypeScript schemas, enabling version-controlled database changes.

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Migrations for production
  migrations: {
    table: '__drizzle_migrations__',
    schema: 'public',
  },
})

// In package.json scripts:
// "db:generate" -> drizzle-kit generate
// "db:migrate"  -> drizzle-kit migrate
// "db:push"     -> drizzle-kit push (for development)
```

**Workflow**:
1. Modify `schema.ts` locally
2. Run `npm run db:generate` to create migration file in `./drizzle/`
3. Review generated SQL
4. Run `npm run db:migrate` to apply to database
5. Commit both schema changes and migration files

### Pattern 5: Batch Operations and Performance
Drizzle supports batch inserts, updates for efficient bulk operations.

```typescript
// Batch insert
const newTransactions = [
  { accountId: 1, amount: 5000, description: 'Deposit' },
  { accountId: 1, amount: -2000, description: 'Withdrawal' },
  { accountId: 2, amount: 10000, description: 'Transfer' },
]

const inserted = await db
  .insert(transactions)
  .values(newTransactions)
  .returning()

// Batch update (if Drizzle supports it on your DB)
await db
  .update(accounts)
  .set({ updatedAt: new Date() })
  .where(inArray(accounts.id, [1, 2, 3]))

// Prepared statements for repeated queries
const getAccountById = db
  .select()
  .from(accounts)
  .where(eq(accounts.id, sql.placeholder('id')))
  .prepare()

const acct = await getAccountById.execute({ id: 5 })
```

## Best Practices

- **Always use transactions for multi-step operations**: Ensure atomicity
  ```typescript
  await db.transaction(async (tx) => {
    await tx.insert(transactions).values(...)
    await tx.update(accounts).set(...).where(...)
  })
  ```

- **Store money as integers (cents)**: Never use floats for financial data
  - PostgreSQL: `integer` or `numeric`
  - JavaScript: Always work in cents, divide by 100 for display

- **Index frequently filtered columns**:
  ```typescript
  export const accounts = pgTable('accounts', {
    // ...
  }, (table) => ({
    tenantIdIndex: index().on(table.tenantId),
    accountNumberIndex: index().on(table.accountNumber),
  }))
  ```

- **Use relations for type safety**: Avoid manual SQL joins; let Drizzle handle relationship typing

- **Prepare statements for hot queries**: Repeated queries benefit from prepared statements

- **Column selection optimization**: Only select columns you need
  ```typescript
  const minimal = await db.query.accounts.findMany({
    columns: {
      id: true,
      accountName: true,
      // Only these 2 columns fetched
    },
  })
  ```

- **Tenant isolation at query level**: Always include tenant filters
  ```typescript
  const accounts = await db.query.accounts.findMany({
    where: eq(accounts.tenantId, tenantId), // ALWAYS
  })
  ```

## Common Pitfalls

- **Forgetting tenant filters**: Data leaks between tenants; always filter by tenantId
- **Using floats for money**: Precision errors; use integers (cents) exclusively
- **N+1 query problems**: Use relational queries with `with` clauses, not separate loops
  ```typescript
  // BAD: N+1 queries
  const accounts = await db.select().from(accounts)
  for (const acct of accounts) {
    const txns = await db.select().from(transactions).where(eq(...))
  }

  // GOOD: Single query with relations
  const accounts = await db.query.accounts.findMany({
    with: { transactions: true }
  })
  ```

- **Not versioning migrations**: Always commit migration files; never manually edit them
- **Ignoring query performance**: Monitor slow queries; add indexes proactively
- **Over-fetching data**: Be selective with columns; don't `SELECT *`

## GoldLedger Application

GoldLedger uses Drizzle patterns extensively:

1. **128+ table schema** in `server/src/schema.ts` with full type safety
2. **Multi-tenant by design**: Every table has `tenantId` column; queries always filter by tenant
3. **Dual database setup** (Phase B):
   - Production Neon for real data (all tables)
   - AI-masked Neon branch for LLM context (deterministic masking via `pg_anonymizer`)
4. **Connection pooling**: Single `db` instance exported from `server/src/db/neon-connection.ts`
5. **Financial invariants**: All amounts stored in cents; balance updates via transactions
6. **Migrations tracked**: All schema changes in `drizzle/` directory committed to git

**Example from GoldLedger** (`server/src/schema.ts`):
```typescript
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  accountId: integer('account_id').notNull(),
  amount: integer('amount').notNull(), // cents
  gstAmount: integer('gst_amount'),
  category: varchar('category'),
  description: varchar('description'),
  transactionDate: timestamp('transaction_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index().on(table.tenantId),
  accountIdFk: foreignKey({
    columns: [table.accountId],
    foreignColumns: [accounts.id],
  }).onDelete('cascade'),
}))
```

## References

- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Drizzle Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle Relational Queries](https://orm.drizzle.team/docs/rqb)
- [Neon Serverless PostgreSQL](https://neon.tech)
- [PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)
