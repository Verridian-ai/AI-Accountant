import type { Transaction, Account } from '../api';
import type { SyncOperation } from './sync-types';
import {
  cacheTransactions,
  getCachedTransactions,
  cacheAccounts,
  getCachedAccounts,
  addToSyncQueue,
  getQueueSize,
} from './offline-db';

let deviceId: string | null = null;

function getDeviceId(): string {
  if (deviceId) return deviceId;
  const stored = localStorage.getItem('goldledger-device-id');
  if (stored) {
    deviceId = stored;
    return stored;
  }
  const id = crypto.randomUUID();
  localStorage.setItem('goldledger-device-id', id);
  deviceId = id;
  return id;
}

/**
 * Wraps a fetch-based GET call: tries network first, caches result, falls back to IndexedDB.
 */
export function withOfflineGet<T>(
  networkFn: () => Promise<T>,
  cacheRead: () => Promise<T>,
  cacheWrite: (data: T) => Promise<void>,
): () => Promise<T> {
  return async () => {
    if (navigator.onLine) {
      try {
        const data = await networkFn();
        // Cache in background
        cacheWrite(data).catch((err) =>
          console.warn('[OfflineInterceptor] Cache write failed:', err),
        );
        return data;
      } catch (err) {
        console.warn('[OfflineInterceptor] Network failed, trying cache:', err);
        return cacheRead();
      }
    }
    return cacheRead();
  };
}

/**
 * Wraps a mutation call: if offline, queues to sync queue and returns optimistic response.
 */
export async function withOfflineMutation<T>(
  networkFn: () => Promise<T>,
  operation: SyncOperation['operation'],
  resourceType: SyncOperation['resourceType'],
  resourceId: string | undefined,
  payload: Record<string, unknown>,
  optimisticResponse: T,
): Promise<T> {
  if (navigator.onLine) {
    try {
      return await networkFn();
    } catch {
      // Network failed mid-request — queue it
    }
  }

  // Offline or network failed — queue the operation
  const syncOp: SyncOperation = {
    id: crypto.randomUUID(),
    deviceId: getDeviceId(),
    operation,
    resourceType,
    resourceId,
    payload,
    status: 'pending',
    clientVersion: Date.now(),
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  await addToSyncQueue(syncOp);
  console.log(`[OfflineInterceptor] Queued ${operation} ${resourceType} (queue size: ${await getQueueSize()})`);

  return optimisticResponse;
}

// ─── Pre-built interceptors for common API calls ────────────────────

/** Intercepted fetchTransactions: caches to IDB, reads from IDB when offline */
export function createTransactionInterceptor(
  originalFetch: (options?: { limit?: number; offset?: number; accountId?: string }) => Promise<{ transactions: Transaction[]; total: number }>,
) {
  return async (options?: { limit?: number; offset?: number; accountId?: string }): Promise<{ transactions: Transaction[]; total: number }> => {
    if (navigator.onLine) {
      try {
        const result = await originalFetch(options);
        // Cache the fetched transactions
        cacheTransactions(result.transactions).catch((err) =>
          console.warn('[OfflineInterceptor] Failed to cache transactions:', err),
        );
        return result;
      } catch (err) {
        console.warn('[OfflineInterceptor] fetchTransactions failed, trying cache:', err);
      }
    }

    // Offline or network failed
    const cached = await getCachedTransactions({
      accountId: options?.accountId,
      limit: options?.limit,
      offset: options?.offset,
    });
    return { transactions: cached, total: cached.length };
  };
}

/** Intercepted fetchAccounts: caches to IDB, reads from IDB when offline */
export function createAccountInterceptor(
  originalFetch: () => Promise<Account[]>,
) {
  return async (): Promise<Account[]> => {
    if (navigator.onLine) {
      try {
        const accounts = await originalFetch();
        cacheAccounts(accounts).catch((err) =>
          console.warn('[OfflineInterceptor] Failed to cache accounts:', err),
        );
        return accounts;
      } catch (err) {
        console.warn('[OfflineInterceptor] fetchAccounts failed, trying cache:', err);
      }
    }

    return getCachedAccounts();
  };
}

/** Intercepted updateTransaction: queues to sync queue when offline */
export function createUpdateTransactionInterceptor(
  originalUpdate: (id: string, updates: Partial<Transaction>) => Promise<void>,
) {
  return async (id: string, updates: Partial<Transaction>): Promise<void> => {
    return withOfflineMutation(
      () => originalUpdate(id, updates),
      'update',
      'transaction',
      id,
      updates as Record<string, unknown>,
      undefined,
    );
  };
}

/** Intercepted deleteTransaction: queues to sync queue when offline */
export function createDeleteTransactionInterceptor(
  originalDelete: (id: string) => Promise<void>,
) {
  return async (id: string): Promise<void> => {
    return withOfflineMutation(
      () => originalDelete(id),
      'delete',
      'transaction',
      id,
      {},
      undefined,
    );
  };
}
