/**
 * Sync Service — Type definitions.
 */

export interface SyncOperation {
  deviceId: string;
  operation: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  clientVersion?: number;
}

export interface ApplyResult {
  success: boolean;
  resourceId?: string;
  error?: string;
  conflict?: boolean;
  serverVersion?: number;
}

export interface SyncResult {
  processed: number;
  applied: number;
  conflicts: number;
  errors: number;
  results: Array<{
    operation: string;
    resourceType: string;
    resourceId?: string;
    status: 'applied' | 'conflict' | 'error';
    error?: string;
    serverVersion?: number;
  }>;
}

export interface ServerConflict {
  id: string;
  deviceId: string;
  operation: string;
  resourceType: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  conflictDetails?: string;
  serverVersion?: number;
  clientVersion?: number;
  createdAt?: string;
}

export interface SyncLogEntry {
  id: string;
  deviceId: string;
  operation: string;
  resourceType: string;
  resourceId?: string;
  syncStatus: string;
  conflictResolution?: string;
  errorMessage?: string;
  createdAt?: string;
  syncedAt?: string;
}
