# Performance Optimization Patterns

## Overview
Performance optimization strategies for GoldLedger's React 19 frontend and Hono/Drizzle backend. Covers React rendering optimization, TanStack Virtual for large lists, Drizzle query optimization, Neon serverless connection management, bundle size, caching, and lazy loading.

## Key Patterns

### Pattern 1: TanStack Virtual for Large Transaction Lists
GoldLedger renders 50,000+ transactions. Use `@tanstack/react-virtual` to only render visible rows.

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // row height in px
    overscan: 10,           // render 10 extra rows above/below viewport
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <TransactionRow transaction={transactions[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Pattern 2: React.memo + useCallback for Expensive Components
Prevent unnecessary re-renders in TanStack Table cells.

```typescript
import { memo, useCallback } from 'react';

// Memoize cell renderers — they re-render on every table scroll otherwise
const AmountCell = memo(({ amount, currency }: { amount: number; currency: string }) => {
  const formatted = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(amount / 100); // cents → dollars

  return <span className="tabular-nums">{formatted}</span>;
});
AmountCell.displayName = 'AmountCell';

// Memoize callbacks passed to child components
function TransactionTable({ onSelect }: { onSelect: (id: string) => void }) {
  const handleSelect = useCallback((id: string) => {
    onSelect(id);
  }, [onSelect]); // Only re-create when onSelect changes

  return <Table onRowClick={handleSelect} />;
}
```

### Pattern 3: React Query Cache Optimization
Configure stale times to reduce unnecessary API calls.

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Transactions change often — short stale time
function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 30_000,        // 30s — fresh for 30s
    gcTime: 5 * 60_000,       // 5 min — keep in cache for 5 min
    placeholderData: (prev) => prev, // Show old data while fetching
  });
}

// Categories rarely change — long stale time
function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: Infinity,      // Never refetch automatically
    gcTime: Infinity,
  });
}

// Prefetch next page before user scrolls
function usePrefetchNextPage(currentPage: number) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['transactions', { page: currentPage + 1 }],
      queryFn: () => fetchTransactions({ page: currentPage + 1 }),
    });
  }, [currentPage, queryClient]);
}
```

### Pattern 4: Drizzle Query Optimization for Neon
Neon is serverless PostgreSQL — minimize round-trips and use indexes correctly.

```typescript
import { db } from '../db';
import { transactions, accounts } from '../schema';
import { eq, and, between, desc, sql } from 'drizzle-orm';

// BAD: N+1 query — fetches account per transaction
async function getTransactionsBad(accountId: string) {
  const txns = await db.select().from(transactions).where(eq(transactions.accountId, accountId));
  return Promise.all(txns.map(async (t) => {
    const account = await db.select().from(accounts).where(eq(accounts.id, t.accountId));
    return { ...t, account: account[0] };
  }));
}

// GOOD: Single JOIN query
async function getTransactionsGood(accountId: string, limit = 50, offset = 0) {
  return db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      merchant: transactions.merchant,
      date: transactions.date,
      accountName: accounts.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(eq(transactions.accountId, accountId))
    .orderBy(desc(transactions.date))
    .limit(limit)
    .offset(offset);
}

// Pagination with count in single query
async function getPaginatedTransactions(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(transactions).limit(pageSize).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(transactions),
  ]);
  return { transactions: rows, total };
}
```

### Pattern 5: Neon Connection Pool Configuration
Serverless Neon has cold-start overhead — configure pools correctly.

```typescript
import { Pool } from '@neondatabase/serverless';

// Single pool instance — never create per-request
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  max: 10,            // Max 10 connections
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Correct: reuse pool across requests
export async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release(); // Always release back to pool
  }
}
```

### Pattern 6: Code Splitting with React.lazy
GoldLedger has 15+ route pages — lazy load to reduce initial bundle.

```typescript
import { lazy, Suspense } from 'react';

// Lazy load heavy pages — three.js 3D graph is 800KB
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard'));
const KnowledgeGraph = lazy(() => import('./features/knowledge/GraphExplorer'));
const BankingProducts = lazy(() => import('./features/banking-products/BankingProductsDashboard'));

function App() {
  return (
    <Suspense fallback={<div className="neu-raised p-8 animate-pulse">Loading...</div>}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/knowledge" element={<KnowledgeGraph />} />
        <Route path="/banking" element={<BankingProducts />} />
      </Routes>
    </Suspense>
  );
}
```

### Pattern 7: useMemo for Expensive Computations
Cache derived data — especially financial aggregations over large arrays.

```typescript
import { useMemo } from 'react';

function FinancialSummary({ transactions }: { transactions: Transaction[] }) {
  // Recalculates only when transactions array changes
  const summary = useMemo(() => {
    return transactions.reduce(
      (acc, t) => ({
        total: acc.total + t.amount,
        income: t.amount > 0 ? acc.income + t.amount : acc.income,
        expenses: t.amount < 0 ? acc.expenses + Math.abs(t.amount) : acc.expenses,
        gstTotal: acc.gstTotal + (t.gstAmount ?? 0),
      }),
      { total: 0, income: 0, expenses: 0, gstTotal: 0 }
    );
  }, [transactions]);

  return <SummaryCards data={summary} />;
}
```

## Best Practices
- Use `@tanstack/react-virtual` for any list >100 items
- Set `staleTime` on ALL React Query hooks — never leave at 0 for financial data
- Always `limit` Drizzle queries — never `SELECT *` without pagination
- Keep Neon pool as a module-level singleton
- Lazy-load pages >50KB (three.js, recharts, heavy feature pages)
- Use `memo` on all TanStack Table cell components
- Batch multiple small DB queries with `Promise.all()` — not sequential awaits
- Index `(accountId, date)` and `(tenantId, date)` columns for common query patterns

## Common Pitfalls
- **N+1 queries**: Use JOINs or batch with `inArray()` instead of looping DB calls
- **No virtualizer**: Rendering 10,000+ DOM nodes crashes mobile browsers
- **staleTime: 0**: Causes a refetch on every focus — hammers Neon serverless endpoints
- **Creating pools per request**: Exhausts Neon connection limits within seconds
- **Missing React.memo**: Table cells re-render on every keystroke if not memoized
- **Importing entire recharts**: Use named imports — `import { BarChart } from 'recharts'`

## GoldLedger Application
- **Transaction list**: `client/src/features/transactions/` — already uses TanStack Virtual
- **React Query config**: `client/src/main.tsx` — configure global `QueryClient` defaults here
- **Drizzle queries**: `server/src/services/` — all should use `.limit()` + `.offset()` for pagination
- **Neon pool**: `server/src/db/neon-connection.ts` — dual pool (production + AI masked branch)
- **Code splitting**: `client/src/routes.tsx` — 15+ pages with React.lazy
- **Heavy pages**: Admin dashboard (three.js), Knowledge Graph (Canvas 2D), Banking Products

## References
- TanStack Virtual: https://tanstack.com/virtual/latest
- React Query optimization: https://tkdodo.eu/blog/practical-react-query
- Neon connection pooling: https://neon.tech/docs/connect/connection-pooling
- Drizzle query building: https://orm.drizzle.team/docs/select
