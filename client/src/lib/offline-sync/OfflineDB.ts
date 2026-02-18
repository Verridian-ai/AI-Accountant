import { DB_NAME, DB_VERSION, STORES } from './types.js';

export class OfflineDB {
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

  async getAllByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
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
