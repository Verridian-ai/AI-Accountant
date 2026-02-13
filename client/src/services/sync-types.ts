export interface SyncOperation {
  id: string;
  deviceId: string;
  operation: 'create' | 'update' | 'delete';
  resourceType: 'transaction' | 'account' | 'note';
  resourceId?: string;
  payload: Record<string, unknown>;
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
  clientData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  clientTimestamp: string;
  serverTimestamp: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
  duration: number;
}

export type SyncOperationResult =
  | { status: 'synced' }
  | { status: 'conflict'; conflict: Conflict }
  | { status: 'failed'; error: string };

export type ConflictStrategy = 'client_wins' | 'server_wins' | 'manual';
