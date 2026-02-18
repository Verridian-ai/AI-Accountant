import type { Transaction, Account } from '../../api/index.js';
import type { PendingOperation, SyncResult, OfflineStatus } from './types.js';
import { STORES, API_BASE_URL } from './types.js';
import { OfflineDB } from './OfflineDB.js';

export class OfflineSyncManager {
  private db = new OfflineDB();
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private listeners: Set<(status: OfflineStatus) => void> = new Set();

  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    this.db.init().catch(console.error);
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.notifyListeners();
    this.sync();
  }

  private handleOffline(): void {
    this.isOnline = false;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.getStatus().then((status) => {
      this.listeners.forEach((listener) => listener(status));
    });
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  onStatusChange(callback: (status: OfflineStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async getStatus(): Promise<OfflineStatus> {
    const pendingCount = await this.db.count(STORES.pendingSync);
    const metadata = await this.db.get<{ key: string; value: string }>(
      STORES.metadata,
      'lastSyncAt',
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

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    for (const tx of transactions) {
      await this.db.put(STORES.transactions, {
        ...tx,
        syncStatus: 'synced',
        lastModified: Date.now(),
      });
    }
  }

  async getTransactions(): Promise<Transaction[]> {
    return this.db.getAll<Transaction>(STORES.transactions);
  }

  async getTransactionsByCategory(category: string): Promise<Transaction[]> {
    return this.db.getAllByIndex<Transaction>(STORES.transactions, 'category', category);
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    const existing = await this.db.get<Transaction>(STORES.transactions, id);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    const updated = {
      ...existing,
      ...updates,
      syncStatus: this.isOnline ? 'synced' : 'pending',
      lastModified: Date.now(),
    };
    await this.db.put(STORES.transactions, updated);

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

  async saveAccounts(accounts: Account[]): Promise<void> {
    for (const account of accounts) {
      await this.db.put(STORES.accounts, {
        ...account,
        syncStatus: 'synced',
        lastModified: Date.now(),
      });
    }
  }

  async getAccounts(): Promise<Account[]> {
    return this.db.getAll<Account>(STORES.accounts);
  }

  // ========================================================================
  // SYNC QUEUE
  // ========================================================================

  async queueOperation(operation: PendingOperation): Promise<void> {
    await this.db.put(STORES.pendingSync, operation);
    this.notifyListeners();

    if ('serviceWorker' in navigator) {
      try {
        const swRegistration = await navigator.serviceWorker.ready;
        if ('sync' in swRegistration) {
          await (
            swRegistration as unknown as {
              sync: { register: (tag: string) => Promise<void> };
            }
          ).sync.register(`sync-${operation.entityType}s`);
        }
      } catch (error) {
        console.warn('Background sync registration failed:', error);
      }
    }
  }

  async getPendingOperations(): Promise<PendingOperation[]> {
    return this.db.getAll<PendingOperation>(STORES.pendingSync);
  }

  async sync(): Promise<SyncResult> {
    if (this.syncInProgress || !this.isOnline) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: ['Sync already in progress or offline'],
      };
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
            `Failed to sync ${operation.entityType} ${operation.entityId}: ${error}`,
          );

          operation.retryCount++;
          operation.lastError = error instanceof Error ? error.message : String(error);

          if (operation.retryCount < 3) {
            await this.db.put(STORES.pendingSync, operation);
          } else {
            await this.db.delete(STORES.pendingSync, operation.id);
          }
        }
      }

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

  private async syncOperation(operation: PendingOperation): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const baseUrl = API_BASE_URL;

    switch (operation.entityType) {
      case 'transaction':
        if (operation.type === 'update') {
          const response = await fetch(`${baseUrl}/transactions/${operation.entityId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(operation.data),
          });
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
            },
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

  async clearAll(): Promise<void> {
    await this.db.clear(STORES.transactions);
    await this.db.clear(STORES.accounts);
    await this.db.clear(STORES.pendingSync);
    await this.db.clear(STORES.metadata);
    this.notifyListeners();
  }

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

export const offlineSync = new OfflineSyncManager();
