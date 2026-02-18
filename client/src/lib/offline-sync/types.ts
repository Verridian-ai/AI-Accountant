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

export const DB_NAME = 'cba-parser-offline';
export const DB_VERSION = 1;

export const STORES = {
  transactions: 'transactions',
  accounts: 'accounts',
  pendingSync: 'pendingSync',
  metadata: 'metadata',
} as const;

// API base URL - configured via environment variable in production
export const API_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:3501/api';
