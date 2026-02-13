import { useState, useEffect, useCallback, useRef } from 'react';
import type { SyncResult, Conflict, ConflictStrategy } from '../services/sync-types';
import { getQueueSize } from '../services/offline-db';
import {
  startSync,
  getConflicts,
  resolveConflict as resolveConflictImpl,
  enableAutoSync,
  disableAutoSync,
} from '../services/sync-manager';

export interface OfflineState {
  isOnline: boolean;
  pendingChanges: number;
  conflicts: Conflict[];
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncAt: string | null;
  triggerSync: () => Promise<SyncResult>;
  resolveConflict: (id: string, strategy: ConflictStrategy) => Promise<void>;
}

export function useOffline(): OfflineState {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [pendingChanges, setPendingChanges] = useState(0);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Poll queue size and conflicts periodically
  const refreshCounts = useCallback(async () => {
    try {
      const [size, allConflicts] = await Promise.all([getQueueSize(), getConflicts()]);
      setPendingChanges(size);
      setConflicts(allConflicts);
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  useEffect(() => {
    refreshCounts();
    refreshTimer.current = setInterval(refreshCounts, 5000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [refreshCounts]);

  // Enable auto-sync when online
  useEffect(() => {
    if (isOnline) {
      enableAutoSync(30000);
    } else {
      disableAutoSync();
    }
    return () => disableAutoSync();
  }, [isOnline]);

  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    setSyncStatus('syncing');
    try {
      const result = await startSync();
      setLastSyncAt(new Date().toISOString());
      setSyncStatus('idle');
      await refreshCounts();
      return result;
    } catch (err) {
      setSyncStatus('error');
      throw err;
    }
  }, [refreshCounts]);

  const handleResolveConflict = useCallback(
    async (syncOperationId: string, strategy: ConflictStrategy) => {
      const conflict = conflicts.find((c) => c.syncOperationId === syncOperationId);
      if (conflict) {
        await resolveConflictImpl(conflict, strategy);
        await refreshCounts();
      }
    },
    [conflicts, refreshCounts],
  );

  return {
    isOnline,
    pendingChanges,
    conflicts,
    syncStatus,
    lastSyncAt,
    triggerSync,
    resolveConflict: handleResolveConflict,
  };
}
