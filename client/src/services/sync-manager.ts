import { BASE_URL, getAuthHeaders } from '../api';
import type { SyncOperation, SyncResult, SyncOperationResult, Conflict, ConflictStrategy } from './sync-types';
import {
  getPendingSyncQueue,
  updateSyncStatus,
  removeSynced,
  getSyncQueue,
  addToSyncQueue,
  cacheTransactions,
  cacheAccounts,
} from './offline-db';

const API_URL = `${BASE_URL}/api`;

let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

// ─── Sync Lifecycle ─────────────────────────────────────────────────

export async function startSync(): Promise<SyncResult> {
  const start = Date.now();
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  const pending = await getPendingSyncQueue();

  for (const op of pending) {
    await updateSyncStatus(op.id, 'syncing');
    const result = await syncOperation(op);

    switch (result.status) {
      case 'synced':
        await updateSyncStatus(op.id, 'synced');
        synced++;
        break;
      case 'conflict':
        await updateSyncStatus(op.id, 'conflict');
        conflicts++;
        break;
      case 'failed':
        await updateSyncStatus(op.id, 'failed', result.error);
        if (op.retryCount < 3) {
          // Re-queue for retry
          await updateSyncStatus(op.id, 'pending');
          const queue = await getSyncQueue();
          const item = queue.find((q) => q.id === op.id);
          if (item) {
            item.retryCount++;
            await addToSyncQueue(item);
          }
        }
        failed++;
        break;
    }
  }

  // Clean up synced operations
  await removeSynced();

  return { synced, failed, conflicts, duration: Date.now() - start };
}

export async function syncOperation(op: SyncOperation): Promise<SyncOperationResult> {
  try {
    // Check for conflicts first (for updates)
    if (op.operation === 'update' && op.resourceId) {
      const conflict = await detectConflict(op);
      if (conflict) {
        return { status: 'conflict', conflict };
      }
    }

    const url = buildUrl(op);
    const method = operationToMethod(op.operation);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(getAuthHeaders() as Record<string, string>),
    };

    const res = await fetch(url, {
      method,
      headers,
      body: method !== 'DELETE' ? JSON.stringify(op.payload) : undefined,
    });

    if (res.ok) {
      return { status: 'synced' };
    }

    if (res.status === 409) {
      // Server reports conflict
      const serverData = await res.json().catch(() => ({}));
      return {
        status: 'conflict',
        conflict: {
          syncOperationId: op.id,
          resourceType: op.resourceType,
          resourceId: op.resourceId ?? '',
          clientData: op.payload,
          serverData,
          clientTimestamp: op.createdAt,
          serverTimestamp: new Date().toISOString(),
        },
      };
    }

    return { status: 'failed', error: `HTTP ${res.status}: ${res.statusText}` };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── Conflict Detection ─────────────────────────────────────────────

async function detectConflict(op: SyncOperation): Promise<Conflict | null> {
  if (!op.resourceId) return null;

  try {
    const url = `${API_URL}/${op.resourceType}s/${op.resourceId}`;
    const res = await fetch(url, { headers: getAuthHeaders() });

    if (!res.ok) return null;

    const serverData = await res.json();
    const serverUpdatedAt = serverData.updatedAt ?? serverData.updated_at;

    // If server version is newer than our last known version, it's a conflict
    if (serverUpdatedAt && new Date(serverUpdatedAt) > new Date(op.createdAt)) {
      return {
        syncOperationId: op.id,
        resourceType: op.resourceType,
        resourceId: op.resourceId,
        clientData: op.payload,
        serverData,
        clientTimestamp: op.createdAt,
        serverTimestamp: serverUpdatedAt,
      };
    }
  } catch {
    // Network error — not a conflict, just can't check
  }

  return null;
}

// ─── Conflict Resolution ────────────────────────────────────────────

export async function resolveConflict(
  conflict: Conflict,
  strategy: ConflictStrategy,
): Promise<void> {
  const op = (await getSyncQueue()).find((q) => q.id === conflict.syncOperationId);
  if (!op) return;

  switch (strategy) {
    case 'client_wins': {
      // Overwrite server with client data
      const url = `${API_URL}/${conflict.resourceType}s/${conflict.resourceId}`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders() as Record<string, string>),
        },
        body: JSON.stringify(conflict.clientData),
      });
      await updateSyncStatus(op.id, 'synced');
      break;
    }
    case 'server_wins': {
      // Discard client changes, update local cache with server state
      if (conflict.resourceType === 'transaction') {
        await cacheTransactions([conflict.serverData as never]);
      } else if (conflict.resourceType === 'account') {
        await cacheAccounts([conflict.serverData as never]);
      }
      await updateSyncStatus(op.id, 'synced');
      break;
    }
    case 'manual':
      // Leave as conflict for the UI to handle
      break;
  }
}

export async function getConflicts(): Promise<Conflict[]> {
  const queue = await getSyncQueue();
  const conflicted = queue.filter((op) => op.status === 'conflict');

  return conflicted.map((op) => ({
    syncOperationId: op.id,
    resourceType: op.resourceType,
    resourceId: op.resourceId ?? '',
    clientData: op.payload,
    serverData: {},
    clientTimestamp: op.createdAt,
    serverTimestamp: new Date().toISOString(),
  }));
}

// ─── Auto-sync ──────────────────────────────────────────────────────

export function enableAutoSync(intervalMs = 30000): void {
  disableAutoSync();
  autoSyncInterval = setInterval(() => {
    if (navigator.onLine) {
      startSync().catch((err) => console.warn('[SyncManager] Auto-sync failed:', err));
    }
  }, intervalMs);

  // Also sync on reconnect
  window.addEventListener('online', syncOnReconnect);
}

export function disableAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
  window.removeEventListener('online', syncOnReconnect);
}

function syncOnReconnect(): void {
  console.log('[SyncManager] Online — triggering sync');
  startSync().catch((err) => console.warn('[SyncManager] Reconnect sync failed:', err));
}

// ─── Helpers ────────────────────────────────────────────────────────

function buildUrl(op: SyncOperation): string {
  const base = `${API_URL}/${op.resourceType}s`;
  if (op.operation === 'create') return base;
  return `${base}/${op.resourceId}`;
}

function operationToMethod(operation: SyncOperation['operation']): string {
  switch (operation) {
    case 'create':
      return 'POST';
    case 'update':
      return 'PATCH';
    case 'delete':
      return 'DELETE';
  }
}
