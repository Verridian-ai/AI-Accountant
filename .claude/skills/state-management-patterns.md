# State Management Patterns

## Overview
State management for GoldLedger's React 19 frontend using Zustand (UI/local state) and TanStack Query (server/async state). The core principle: server data lives in React Query, UI state lives in Zustand. Never cross-contaminate these layers.

## Key Patterns

### Pattern 1: Zustand Store Structure — Slice Pattern
GoldLedger uses Zustand slices for domain-specific UI state.

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Define slice interfaces separately for clarity
interface TransactionFiltersSlice {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    categoryId: string | null;
    minAmount: number | null;
    maxAmount: number | null;
    search: string;
  };
  setFilter: <K extends keyof TransactionFiltersSlice['filters']>(
    key: K,
    value: TransactionFiltersSlice['filters'][K]
  ) => void;
  resetFilters: () => void;
}

interface UISlice {
  activeTab: string;
  sidebarOpen: boolean;
  selectedTransactionId: string | null;
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
  selectTransaction: (id: string | null) => void;
}

type AppStore = TransactionFiltersSlice & UISlice;

const defaultFilters = {
  dateFrom: null,
  dateTo: null,
  categoryId: null,
  minAmount: null,
  maxAmount: null,
  search: '',
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        // Transaction filters slice
        filters: defaultFilters,
        setFilter: (key, value) =>
          set((state) => ({ filters: { ...state.filters, [key]: value } })),
        resetFilters: () => set({ filters: defaultFilters }),

        // UI slice
        activeTab: 'transactions',
        sidebarOpen: true,
        selectedTransactionId: null,
        setActiveTab: (tab) => set({ activeTab: tab }),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        selectTransaction: (id) => set({ selectedTransactionId: id }),
      }),
      {
        name: 'goldledger-ui',
        partialize: (state) => ({
          // Only persist filters and active tab — not ephemeral UI state
          filters: state.filters,
          activeTab: state.activeTab,
        }),
      }
    )
  )
);
```

### Pattern 2: TanStack Query — Server State
All API data goes through React Query. Never store API responses in Zustand.

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '../api';

// Query key factory — centralized for cache invalidation
export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
};

// Fetch transactions
function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(
        Object.entries(filters)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      );
      const res = await fetch(`${BASE_URL}/api/transactions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json() as Promise<{ transactions: Transaction[]; total: number }>;
    },
    staleTime: 30_000,
  });
}

// Optimistic update mutation
function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string }) => {
      const res = await fetch(`${BASE_URL}/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) throw new Error('Update failed');
      return res.json() as Promise<Transaction>;
    },
    onMutate: async ({ id, categoryId }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: transactionKeys.all });

      // Snapshot for rollback
      const previousData = queryClient.getQueryData(transactionKeys.all);

      // Optimistically update all transaction lists
      queryClient.setQueriesData(
        { queryKey: transactionKeys.lists() },
        (old: { transactions: Transaction[]; total: number } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            transactions: old.transactions.map((t) =>
              t.id === id ? { ...t, categoryId } : t
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Rollback on failure
      if (context?.previousData) {
        queryClient.setQueryData(transactionKeys.all, context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
```

### Pattern 3: SSE Context for Real-Time Updates
GoldLedger uses SSE for real-time balance updates. Pattern lives in `SSEContext.tsx`.

```typescript
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '../api';

interface SSEContextValue {
  connected: boolean;
}

const SSEContext = createContext<SSEContextValue>({ connected: false });

export function SSEProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const connectedRef = useRef(false);

  useEffect(() => {
    const source = new EventSource(`${BASE_URL}/api/events`);

    source.onopen = () => { connectedRef.current = true; };

    source.addEventListener('transaction_updated', () => {
      // Invalidate React Query cache on server push
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    });

    source.addEventListener('balance_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    });

    return () => {
      source.close();
      connectedRef.current = false;
    };
  }, [queryClient]);

  return (
    <SSEContext.Provider value={{ connected: connectedRef.current }}>
      {children}
    </SSEContext.Provider>
  );
}

export const useSSE = () => useContext(SSEContext);
```

### Pattern 4: Tenant State — Zustand with Persistence
Multi-tenant GoldLedger stores current tenant in Zustand with localStorage persistence.

```typescript
interface TenantStore {
  currentTenantId: string | null;
  currentRole: 'owner' | 'admin' | 'accountant' | 'bookkeeper' | 'viewer' | null;
  setTenant: (tenantId: string, role: TenantStore['currentRole']) => void;
  clearTenant: () => void;
}

export const useTenantStore = create<TenantStore>()(
  persist(
    (set) => ({
      currentTenantId: null,
      currentRole: null,
      setTenant: (tenantId, role) => set({ currentTenantId: tenantId, currentRole: role }),
      clearTenant: () => set({ currentTenantId: null, currentRole: null }),
    }),
    { name: 'goldledger-tenant' }
  )
);

// Hook that adds tenant header to all API calls
function useApiHeaders() {
  const tenantId = useTenantStore(state => state.currentTenantId);
  return tenantId ? { 'X-Tenant-Id': tenantId } : {};
}
```

### Pattern 5: Derived State with Selectors
Use Zustand selectors to avoid component re-renders on unrelated state changes.

```typescript
// BAD: Component re-renders whenever ANY store state changes
function TransactionCount() {
  const store = useAppStore(); // subscribes to everything
  return <span>{store.filters.search}</span>;
}

// GOOD: Component only re-renders when 'search' changes
function SearchFilter() {
  const search = useAppStore(state => state.filters.search);
  const setFilter = useAppStore(state => state.setFilter);

  return (
    <input
      value={search}
      onChange={(e) => setFilter('search', e.target.value)}
    />
  );
}
```

## Best Practices
- Server data (API responses) → React Query; UI state (modals, tabs, filters) → Zustand
- Use query key factories for consistent cache invalidation
- Persist only stable state (filters, active tab) — not ephemeral state (loading, hover)
- Always `cancelQueries` before optimistic updates to prevent race conditions
- Use Zustand selectors to prevent unnecessary re-renders
- Invalidate React Query on SSE events — never store SSE data in Zustand
- `X-Tenant-Id` header required on all GoldLedger API calls

## Common Pitfalls
- **API data in Zustand**: Doubles your data, causes sync bugs — use React Query for all server state
- **No query key factory**: Ad-hoc string keys make cache invalidation fragile
- **Missing optimistic rollback**: `onError` must restore previous data
- **Persisting ephemeral state**: Don't persist loading/error states to localStorage
- **Subscribing to entire store**: Always use selectors — `useStore(state => state.x)` not `useStore()`
- **Missing staleTime**: Default `staleTime: 0` causes refetch on every component mount

## GoldLedger Application
- **SSE context**: `client/src/contexts/SSEContext.tsx` — wraps app, invalidates React Query on push events
- **Tenant store**: `client/src/features/tenant/` — `X-Tenant-Id` header added to all fetch calls
- **Transaction filters**: Store in Zustand + sync to React Query keys for cache isolation per filter set
- **Active tab**: Zustand with `persist` — survives page refresh
- **API base**: `BASE_URL` from `client/src/api.ts` — always use this, never hardcode localhost

## References
- Zustand docs: https://zustand.docs.pmnd.rs/
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview
- Query key patterns: https://tkdodo.eu/blog/effective-react-query-keys
