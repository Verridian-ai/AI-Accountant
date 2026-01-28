/**
 * Offline Sync System
 *
 * Manages offline data storage with IndexedDB, queues operations when offline,
 * and synchronizes with the server when back online.
 */

import { useState, useEffect } from 'react';
import { Transaction, Account, Statement } from '../api';

// ============================================================================
// TYPES
// ============================================================================

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'transaction' | 'account' | 'statement' | 'categorization';
  entityId: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export interface OfflineStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  syncInProgress: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DB_NAME = 'cba-parser-offline';
const DB_VERSION = 1;

const STORES = {
  transactions: 'transactions',
  accounts: 'accounts',
  pendingSync: 'pendingSync',
  metadata: 'metadata',
} as const;

// API base URL - should be configured via environment variable in production
const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:3501/api';

// ============================================================================
// INDEXED DB WRAPPER
// ============================================================================

class OfflineDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Transactions store
        if (!db.objectStoreNames.contains(STORES.transactions)) {
          const txStore = db.createObjectStore(STORES.transactions, { keyPath: 'id' });
          txStore.createIndex('date', 'date');
          txStore.createIndex('category', 'category');
          txStore.createIndex('accountId', 'accountId');
          txStore.createIndex('syncStatus', 'syncStatus');
        }

        // Accounts store
        if (!db.objectStoreNames.contains(STORES.accounts)) {
          const accountStore = db.createObjectStore(STORES.accounts, { keyPath: 'id' });
          accountStore.createIndex('accountType', 'accountType');
        }

        // Pending sync queue
        if (!db.objectStoreNames.contains(STORES.pendingSync)) {
          const syncStore = db.createObjectStore(STORES.pendingSync, {
            keyPath: 'id',
            autoIncrement: false,
          });
          syncStore.createIndex('timestamp', 'timestamp');
          syncStore.createIndex('entityType', 'entityType');
        }

        // Metadata store (for sync timestamps, etc.)
        if (!db.objectStoreNames.contains(STORES.metadata)) {
          db.createObjectStore(STORES.metadata, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Generic CRUD operations
  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(storeName).get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAll<T>(storeName: string, query?: IDBKeyRange): Promise<T[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(storeName).getAll(query);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(storeName, 'readwrite').put(value);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(storeName, 'readwrite').delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(storeName, 'readwrite').clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async count(storeName: string): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(storeName).count();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAllByIndex<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey
  ): Promise<T[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

// ============================================================================
// OFFLINE SYNC MANAGER
// ============================================================================

class OfflineSyncManager {
  private db = new OfflineDB();
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private listeners: Set<(status: OfflineStatus) => void> = new Set();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Initialize
    this.db.init().catch(console.error);
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.notifyListeners();
    this.sync(); // Attempt sync when coming online
  }

  private handleOffline(): void {
    this.isOnline = false;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.getStatus().then(status => {
      this.listeners.forEach(listener => listener(status));
    });
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: OfflineStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get current offline status
   */
  async getStatus(): Promise<OfflineStatus> {
    const pendingCount = await this.db.count(STORES.pendingSync);
    const metadata = await this.db.get<{ key: string; value: string }>(
      STORES.metadata,
      'lastSyncAt'
    );

    return {
      isOnline: this.isOnline,
      pendingCount,
      lastSyncAt: metadata?.value || null,
      syncInProgress: this.syncInProgress,
    };
  }

  // ========================================================================
  // TRANSACTION OPERATIONS
  // ========================================================================

  /**
   * Save transactions to offline storage
   */
  async saveTransactions(transactions: Transaction[]): Promise<void> {
    for (const tx of transactions) {
      await this.db.put(STORES.transactions, {
        ...tx,
        syncStatus: 'synced',
        lastModified: Date.now(),
      });
    }
  }

  /**
   * Get transactions from offline storage
   */
  async getTransactions(): Promise<Transaction[]> {
    return this.db.getAll<Transaction>(STORES.transactions);
  }

  /**
   * Get transactions by category
   */
  async getTransactionsByCategory(category: string): Promise<Transaction[]> {
    return this.db.getAllByIndex<Transaction>(
      STORES.transactions,
      'category',
      category
    );
  }

  /**
   * Update a transaction (with offline support)
   */
  async updateTransaction(
    id: string,
    updates: Partial<Transaction>
  ): Promise<void> {
    // Get existing transaction
    const existing = await this.db.get<Transaction>(STORES.transactions, id);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    // Update locally
    const updated = {
      ...existing,
      ...updates,
      syncStatus: this.isOnline ? 'synced' : 'pending',
      lastModified: Date.now(),
    };
    await this.db.put(STORES.transactions, updated);

    // Queue for sync if offline
    if (!this.isOnline) {
      await this.queueOperation({
        id: `${id}-${Date.now()}`,
        type: 'update',
        entityType: 'transaction',
        entityId: id,
        data: updates,
        timestamp: Date.now(),
        retryCount: 0,
      });
    }
  }

  // ========================================================================
  // ACCOUNT OPERATIONS
  // ========================================================================

  /**
   * Save accounts to offline storage
   */
  async saveAccounts(accounts: Account[]): Promise<void> {
    for (const account of accounts) {
      await this.db.put(STORES.accounts, {
        ...account,
        syncStatus: 'synced',
        lastModified: Date.now(),
      });
    }
  }

  /**
   * Get accounts from offline storage
   */
  async getAccounts(): Promise<Account[]> {
    return this.db.getAll<Account>(STORES.accounts);
  }

  // ========================================================================
  // SYNC QUEUE
  // ========================================================================

  /**
   * Queue an operation for sync
   */
  async queueOperation(operation: PendingOperation): Promise<void> {
    await this.db.put(STORES.pendingSync, operation);
    this.notifyListeners();

    // Register for background sync if available
    if ('serviceWorker' in navigator) {
      try {
        const swRegistration = await navigator.serviceWorker.ready;
        if ('sync' in swRegistration) {
          await (swRegistration as any).sync.register(`sync-${operation.entityType}s`);
        }
      } catch (error) {
        console.warn('Background sync registration failed:', error);
      }
    }
  }

  /**
   * Get pending operations
   */
  async getPendingOperations(): Promise<PendingOperation[]> {
    return this.db.getAll<PendingOperation>(STORES.pendingSync);
  }

  /**
   * Sync pending operations with server
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress || !this.isOnline) {
      return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress or offline'] };
    }

    this.syncInProgress = true;
    this.notifyListeners();

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      const pending = await this.getPendingOperations();

      for (const operation of pending) {
        try {
          await this.syncOperation(operation);
          await this.db.delete(STORES.pendingSync, operation.id);
          result.synced++;
        } catch (error) {
          result.failed++;
          result.errors.push(
            `Failed to sync ${operation.entityType} ${operation.entityId}: ${error}`
          );

          // Update retry count
          operation.retryCount++;
          operation.lastError = error instanceof Error ? error.message : String(error);

          if (operation.retryCount < 3) {
            await this.db.put(STORES.pendingSync, operation);
          } else {
            // Remove after max retries
            await this.db.delete(STORES.pendingSync, operation.id);
          }
        }
      }

      // Update last sync timestamp
      await this.db.put(STORES.metadata, {
        key: 'lastSyncAt',
        value: new Date().toISOString(),
      });

      result.success = result.failed === 0;

    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }

    return result;
  }

  /**
   * Sync a single operation
   */
  private async syncOperation(operation: PendingOperation): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const baseUrl = API_BASE_URL;

    switch (operation.entityType) {
      case 'transaction':
        if (operation.type === 'update') {
          const response = await fetch(
            `${baseUrl}/transactions/${operation.entityId}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify(operation.data),
            }
          );
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
        }
        break;

      case 'categorization':
        if (operation.type === 'update') {
          const response = await fetch(
            `${baseUrl}/pending-categorizations/${operation.entityId}/resolve`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify(operation.data),
            }
          );
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
        }
        break;

      default:
        console.warn(`Unknown entity type: ${operation.entityType}`);
    }
  }

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  /**
   * Clear all offline data
   */
  async clearAll(): Promise<void> {
    await this.db.clear(STORES.transactions);
    await this.db.clear(STORES.accounts);
    await this.db.clear(STORES.pendingSync);
    await this.db.clear(STORES.metadata);
    this.notifyListeners();
  }

  /**
   * Get storage usage estimate
   */
  async getStorageEstimate(): Promise<{ used: number; quota: number } | null> {
    if (!navigator.storage?.estimate) {
      return null;
    }
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const offlineSync = new OfflineSyncManager();

// ============================================================================
// REACT HOOK
// ============================================================================

// Note: useState and useEffect are imported at the top of the file via React

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSyncAt: null,
    syncInProgress: false,
  });

  useEffect(() => {
    // Get initial status
    offlineSync.getStatus().then(setStatus);

    // Subscribe to changes
    const unsubscribe = offlineSync.onStatusChange(setStatus);

    return unsubscribe;
  }, []);

  return status;
}

export default offlineSync;
