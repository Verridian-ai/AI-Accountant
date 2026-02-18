import { useState, useEffect } from 'react';
import type { OfflineStatus } from './types.js';
import { offlineSync } from './OfflineSyncManager.js';

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSyncAt: null,
    syncInProgress: false,
  });

  useEffect(() => {
    offlineSync.getStatus().then(setStatus);
    const unsubscribe = offlineSync.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  return status;
}
