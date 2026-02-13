import { useState, useCallback } from 'react';
import { AlertTriangle, Check, ArrowRight } from 'lucide-react';
import { useOffline } from '../../../hooks/useOffline';
import type { Conflict, ConflictStrategy } from '../../../services/sync-types';

export function ConflictResolver() {
  const { conflicts, resolveConflict } = useOffline();
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const handleResolve = useCallback(
    async (conflict: Conflict, strategy: ConflictStrategy) => {
      setResolving(conflict.syncOperationId);
      try {
        await resolveConflict(conflict.syncOperationId, strategy);
        setResolved((prev) => new Set(prev).add(conflict.syncOperationId));
      } finally {
        setResolving(null);
      }
    },
    [resolveConflict],
  );

  const handleResolveAll = useCallback(
    async (strategy: ConflictStrategy) => {
      for (const conflict of activeConflicts) {
        await handleResolve(conflict, strategy);
      }
    },
    [conflicts], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const activeConflicts = conflicts.filter((c) => !resolved.has(c.syncOperationId));

  if (activeConflicts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="neu-raised rounded-2xl p-8 text-center">
          <Check className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-200">No Conflicts</h3>
          <p className="text-xs text-zinc-500 mt-1">All data is in sync</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold text-zinc-200">
            {activeConflicts.length} Conflict{activeConflicts.length !== 1 ? 's' : ''}
          </h2>
        </div>
        {activeConflicts.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResolveAll('client_wins')}
              className="text-[10px] font-bold text-[#FFCC00] hover:text-[#FFCC00]/80 uppercase tracking-wider"
            >
              Keep All Mine
            </button>
            <span className="text-zinc-700">|</span>
            <button
              onClick={() => handleResolveAll('server_wins')}
              className="text-[10px] font-bold text-zinc-500 hover:text-zinc-400 uppercase tracking-wider"
            >
              Use All Server
            </button>
          </div>
        )}
      </div>

      {activeConflicts.map((conflict) => (
        <div
          key={conflict.syncOperationId}
          className="neu-raised rounded-2xl border border-amber-500/20 overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                {conflict.resourceType}
              </span>
              {conflict.resourceId && (
                <span className="text-xs text-zinc-600 ml-2">#{conflict.resourceId}</span>
              )}
            </div>
            <span className="text-[10px] text-zinc-600">
              {conflict.clientTimestamp
                ? new Date(conflict.clientTimestamp).toLocaleString('en-AU')
                : ''}
            </span>
          </div>

          {/* Side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
            {/* Client version */}
            <div className="p-4 border-l-2 border-[#FFCC00]/40">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#FFCC00] mb-2">
                Your Change
              </div>
              <div className="space-y-1">
                {Object.entries(conflict.clientData).map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-2">
                    <span className="text-[10px] text-zinc-500 w-24 shrink-0 truncate">{key}</span>
                    <span className="text-xs text-zinc-300 truncate">{String(value ?? '—')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Server version */}
            <div className="p-4 border-l-2 border-blue-400/40">
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">
                Server Version
              </div>
              <div className="space-y-1">
                {Object.entries(conflict.serverData).map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-2">
                    <span className="text-[10px] text-zinc-500 w-24 shrink-0 truncate">{key}</span>
                    <span className="text-xs text-zinc-300 truncate">{String(value ?? '—')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-3 border-t border-zinc-800 flex items-center gap-3">
            <button
              onClick={() => handleResolve(conflict, 'client_wins')}
              disabled={resolving === conflict.syncOperationId}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-black bg-[#FFCC00] hover:bg-[#FFD633] disabled:opacity-50 btn-press flex items-center justify-center gap-1.5"
            >
              Keep Mine <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleResolve(conflict, 'server_wins')}
              disabled={resolving === conflict.syncOperationId}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-zinc-300 neu-raised hover:bg-zinc-800/50 disabled:opacity-50 btn-press"
            >
              Use Server
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
