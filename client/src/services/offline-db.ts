import { openDB, type IDBPDatabase } from 'idb';
import type { Transaction, Account } from '../api';
import type { SyncOperation } from './sync-types';

const DB_NAME = 'goldledger-offline';
const DB_VERSION = 1;

interface GoldLedgerDB {
  transactions: {
    key: string;
    value: Transaction;
    indexes: {
      date: string;
      category: string;
      accountId: string;
    };
  };
  accounts: {
    key: string;
    value: Account;
  };
  syncQueue: {
    key: string;
    value: SyncOperation;
    indexes: {
      status: string;
      timestamp: string;
    };
  };
  metadata: {
    key: string;
    value: { key: string; value: string };
  };
}

let dbInstance: IDBPDatabase<GoldLedgerDB> | null = null;

async function getDB(): Promise<IDBPDatabase<GoldLedgerDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<GoldLedgerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('date', 'date');
        txStore.createIndex('category', 'category');
        txStore.createIndex('accountId', 'accountId');
      }

      // Accounts store
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('status', 'status');
        syncStore.createIndex('timestamp', 'createdAt');
      }

      // Metadata store (key-value pairs)
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// ─── Transaction Cache ──────────────────────────────────────────────

export async function cacheTransactions(transactions: Transaction[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('transactions', 'readwrite');
  const store = tx.objectStore('transactions');

  for (const t of transactions) {
    await store.put(t);
  }
  await tx.done;

  // Update sync timestamp
  await setMetadata('lastTransactionSync', new Date().toISOString());
}

export async function getCachedTransactions(filters?: {
  accountId?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<Transaction[]> {
  const db = await getDB();

  if (filters?.accountId) {
    const results = await db.getAllFromIndex('transactions', 'accountId', filters.accountId);
    return applyPagination(results, filters?.limit, filters?.offset);
  }

  if (filters?.category) {
    const results = await db.getAllFromIndex('transactions', 'category', filters.category);
    return applyPagination(results, filters?.limit, filters?.offset);
  }

  const all = await db.getAll('transactions');
  return applyPagination(all, filters?.limit, filters?.offset);
}

export async function getCachedTransaction(id: string): Promise<Transaction | null> {
  const db = await getDB();
  const result = await db.get('transactions', id);
  return result ?? null;
}

export async function clearTransactionCache(): Promise<void> {
  const db = await getDB();
  await db.clear('transactions');
  await setMetadata('lastTransactionSync', '');
}

export async function getLastSyncTimestamp(): Promise<string | null> {
  return getMetadata('lastTransactionSync');
}

// ─── Account Cache ──────────────────────────────────────────────────

export async function cacheAccounts(accounts: Account[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('accounts', 'readwrite');
  const store = tx.objectStore('accounts');

  for (const a of accounts) {
    await store.put(a);
  }
  await tx.done;

  await setMetadata('lastAccountSync', new Date().toISOString());
}

export async function getCachedAccounts(): Promise<Account[]> {
  const db = await getDB();
  return db.getAll('accounts');
}

// ─── Sync Queue ─────────────────────────────────────────────────────

export async function addToSyncQueue(operation: SyncOperation): Promise<string> {
  const db = await getDB();
  await db.put('syncQueue', operation);
  return operation.id;
}

export async function getSyncQueue(): Promise<SyncOperation[]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

export async function getPendingSyncQueue(): Promise<SyncOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'status', 'pending');
}

export async function updateSyncStatus(
  id: string,
  status: SyncOperation['status'],
  error?: string,
): Promise<void> {
  const db = await getDB();
  const op = await db.get('syncQueue', id);
  if (op) {
    op.status = status;
    if (error) op.error = error;
    await db.put('syncQueue', op);
  }
}

export async function removeSynced(): Promise<number> {
  const db = await getDB();
  const synced = await db.getAllFromIndex('syncQueue', 'status', 'synced');
  const tx = db.transaction('syncQueue', 'readwrite');
  const store = tx.objectStore('syncQueue');

  for (const op of synced) {
    await store.delete(op.id);
  }
  await tx.done;

  return synced.length;
}

export async function getQueueSize(): Promise<number> {
  const db = await getDB();
  const pending = await db.getAllFromIndex('syncQueue', 'status', 'pending');
  return pending.length;
}

// ─── Metadata ───────────────────────────────────────────────────────

async function setMetadata(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.put('metadata', { key, value });
}

async function getMetadata(key: string): Promise<string | null> {
  const db = await getDB();
  const result = await db.get('metadata', key);
  return result?.value ?? null;
}

// ─── Helpers ────────────────────────────────────────────────────────

function applyPagination<T>(items: T[], limit?: number, offset?: number): T[] {
  const start = offset ?? 0;
  const end = limit ? start + limit : undefined;
  return items.slice(start, end);
}

/** Close the database connection (useful for testing/cleanup) */
export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
