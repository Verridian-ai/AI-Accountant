import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useOffline } from '../../../hooks/useOffline';
import { apApi } from '../../../api';

interface SyncLogEntry {
  id: string;
  operation: string;
  resourceType: string;
  syncStatus: string;
  createdAt?: string;
}

export function SyncStatus() {
  const { isOnline, pendingChanges, conflicts, syncStatus, lastSyncAt, triggerSync } = useOffline();
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Refresh sync log
  const refreshLog = useCallback(async () => {
    try {
      const result = await apApi.getSyncLog(20, 0);
      setSyncLog(result.log as SyncLogEntry[]);
    } catch {
      // Offline — skip
    }
  }, []);

  useEffect(() => {
    refreshLog();
    const timer = setInterval(refreshLog, 5000);
    return () => clearInterval(timer);
  }, [refreshLog]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await refreshLog();
    } finally {
      setSyncing(false);
    }
  }, [triggerSync, refreshLog]);

  const statusDot = isOnline ? 'bg-emerald-400' : 'bg-red-400';
  const statusLabel = isOnline ? 'Online' : 'Offline';

  return (
    <div className="space-y-5 max-w-2xl mx-auto p-4">
      <h2 className="text-lg font-bold text-zinc-200">Sync Status</h2>

      {/* Connectivity */}
      <div className="neu-raised rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${statusDot} ${isOnline ? 'animate-pulse' : ''}`} />
            <div>
              <p className="text-sm font-bold text-zinc-200">{statusLabel}</p>
              {lastSyncAt && (
                <p className="text-xs text-zinc-500">
                  Last sync: {new Date(lastSyncAt).toLocaleString('en-AU')}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || syncStatus === 'syncing' || !isOnline}
            className="neu-raised-sm py-2 px-4 rounded-xl text-xs font-bold text-[#FFCC00] hover:bg-[#FFCC00]/10 disabled:opacity-30 btn-press flex items-center gap-2 min-h-[44px]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing || syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>
      </div>

      {/* Pending changes */}
      <div className="neu-raised rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-zinc-300">Pending Changes</h3>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            pendingChanges > 0 ? 'bg-[#FFCC00]/20 text-[#FFCC00]' : 'bg-zinc-800 text-zinc-500'
          }`}>
            {pendingChanges}
          </span>
        </div>
        {pendingChanges === 0 ? (
          <p className="text-xs text-zinc-500">All changes synced</p>
        ) : (
          <p className="text-xs text-zinc-400">
            {pendingChanges} change{pendingChanges !== 1 ? 's' : ''} waiting to sync
          </p>
        )}
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="neu-raised rounded-2xl p-5 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-300">
              {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Some changes conflict with server data. Open the Conflict Resolver to review.
          </p>
        </div>
      )}

      {/* Sync log */}
      <div className="neu-raised rounded-2xl p-5">
        <h3 className="text-sm font-bold text-zinc-300 mb-3">Recent Sync History</h3>
        {syncLog.length === 0 ? (
          <p className="text-xs text-zinc-500">No sync history yet</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {syncLog.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-zinc-800/50 last:border-0">
                {entry.syncStatus === 'synced' && <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                {entry.syncStatus === 'conflict' && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                {entry.syncStatus === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                {!['synced', 'conflict', 'error'].includes(entry.syncStatus) && <Clock className="h-3.5 w-3.5 text-zinc-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-zinc-300">
                    {entry.operation} {entry.resourceType}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0">
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString('en-AU') : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
