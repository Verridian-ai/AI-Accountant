# Agent 6: Offline Sync Builder

## Role
Build offline support using IndexedDB for local transaction caching, a sync queue for offline changes, and conflict resolution when reconnecting.

## Priority: WAVE 24 (After Agent 1)

## Wait Condition
Check for `.agent-done-W24-01` marker file before starting.

## Files to CREATE

### 1. `client/src/services/offline-db.ts`
**Purpose**: IndexedDB wrapper for local data storage using `idb` library

- [ ] Create `OfflineDB` class:

  **Database Setup**:
  - DB name: `goldledger-offline`
  - Version: 1
  - Object stores:
    - `transactions` -- cached transactions (key: id, indexes: date, category, accountId)
    - `accounts` -- cached accounts (key: id)
    - `syncQueue` -- pending offline changes (key: id, index: status, timestamp)
    - `metadata` -- last sync timestamps and version numbers (key: key)

  **Transaction Cache**:
  - `cacheTransactions(transactions: Transaction[]): Promise<void>` -- bulk write to IndexedDB
  - `getCachedTransactions(filters?): Promise<Transaction[]>` -- read from local cache with optional filters
  - `getCachedTransaction(id): Promise<Transaction | null>` -- single transaction lookup
  - `clearTransactionCache(): Promise<void>` -- wipe local cache
  - `getLastSyncTimestamp(): Promise<string | null>` -- when was data last synced from server

  **Account Cache**:
  - `cacheAccounts(accounts: Account[]): Promise<void>`
  - `getCachedAccounts(): Promise<Account[]>`

  **Sync Queue**:
  - `addToSyncQueue(operation: SyncOperation): Promise<string>` -- add offline change to queue, returns queue ID
  - `getSyncQueue(): Promise<SyncOperation[]>` -- all pending operations
  - `updateSyncStatus(id, status, error?): Promise<void>` -- mark as synced/failed/conflict
  - `removeSynced(): Promise<number>` -- clean up successfully synced operations
  - `getQueueSize(): Promise<number>` -- count of pending operations

### 2. `client/src/services/sync-manager.ts`
**Purpose**: Orchestrates syncing offline changes with the server

- [ ] Create `SyncManager` class:

  **Sync Lifecycle**:
  - `startSync(): Promise<SyncResult>` -- process all pending queue items in order
  - `syncOperation(op: SyncOperation): Promise<SyncOperationResult>` -- sync single operation to server
  - `detectConflicts(op: SyncOperation): Promise<Conflict | null>` -- compare client version vs server version
  - `resolveConflict(conflict: Conflict, strategy: 'client_wins' | 'server_wins' | 'manual'): Promise<void>`
  - `getConflicts(): Promise<Conflict[]>` -- unresolved conflicts

  **Auto-sync**:
  - `enableAutoSync(intervalMs?: number): void` -- sync every N ms when online (default 30s)
  - `disableAutoSync(): void`
  - `syncOnReconnect(): void` -- trigger sync when `navigator.onLine` becomes true

  **Conflict Resolution**:
  - For `client_wins`: POST client's version to server, overwriting server state
  - For `server_wins`: Discard client's change, update local cache with server state
  - For `manual`: Store conflict in `syncQueue` with status='conflict', let user decide via UI

### 3. `client/src/services/offline-interceptor.ts`
**Purpose**: Intercepts API calls to serve from cache when offline

- [ ] Wrap `fetch` or the API layer to:
  - If online: normal API call, cache response in IndexedDB
  - If offline + GET request: serve from IndexedDB cache
  - If offline + POST/PUT/DELETE: add to sync queue, return optimistic response
  - Track online/offline state via `navigator.onLine` + events

### 4. `client/src/services/sync-types.ts`
**Purpose**: TypeScript types for offline sync

```typescript
export interface SyncOperation {
  id: string;
  deviceId: string;
  operation: 'create' | 'update' | 'delete';
  resourceType: 'transaction' | 'account' | 'note';
  resourceId?: string;
  payload: Record<string, any>;
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
  clientVersion: number;
  createdAt: string;
  error?: string;
  retryCount: number;
}

export interface Conflict {
  syncOperationId: string;
  resourceType: string;
  resourceId: string;
  clientData: Record<string, any>;
  serverData: Record<string, any>;
  clientTimestamp: string;
  serverTimestamp: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
  duration: number;
}
```

### 5. `client/src/hooks/useOffline.ts`
**Purpose**: React hook for offline state and sync status

- [ ] `useOffline()` returns:
  - `isOnline: boolean` -- current connectivity state
  - `pendingChanges: number` -- count of unsynced operations
  - `conflicts: Conflict[]` -- unresolved conflicts
  - `syncStatus: 'idle' | 'syncing' | 'error'`
  - `lastSyncAt: string | null`
  - `triggerSync(): Promise<SyncResult>` -- manual sync trigger
  - `resolveConflict(id, strategy): Promise<void>`

## Files to MODIFY

### 6. `client/package.json`
- [ ] Add dependency: `idb@^8.0` (IndexedDB wrapper)

### 7. `client/src/api.ts`
- [ ] Wrap API calls with offline interceptor:
  - GET calls: try network, fall back to IndexedDB cache
  - Mutation calls: if offline, queue to sync manager, return optimistic response
  - Track cache freshness with metadata timestamps

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] IndexedDB stores created: transactions, accounts, syncQueue, metadata
- [ ] Transactions cached locally after fetch from server
- [ ] Offline: cached transactions displayed from IndexedDB
- [ ] Offline: new transaction added to sync queue (not lost)
- [ ] Online: sync queue processed in order, changes sent to server
- [ ] Conflict detection: client and server edits to same transaction flagged
- [ ] Conflict resolution: client_wins and server_wins work correctly
- [ ] Auto-sync triggers on reconnection
- [ ] `useOffline()` hook reports correct pending count and sync status
- [ ] Create marker file: `.agent-done-W24-06`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W24-01`) for `offline_sync_log` table
- **Reuses**: Existing api.ts patterns, transaction types
