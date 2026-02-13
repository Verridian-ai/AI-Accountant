import { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { useOffline } from '../../../hooks/useOffline';

export function OfflineIndicator() {
  const { isOnline, pendingChanges, syncStatus } = useOffline();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
      setVisible(true);
    } else if (syncStatus === 'syncing') {
      setVisible(true);
    } else {
      // Fade out after going online
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, syncStatus]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div
      className={`w-full z-30 transition-all duration-300 ease-in-out ${
        visible ? 'max-h-14 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      {!isOnline && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#FFCC00]/10 border-b border-[#FFCC00]/20">
          <div className="flex items-center gap-2.5 text-[#FFCC00]">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">
              You're offline. Changes will sync when connected.
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[#FFCC00]/60 hover:text-[#FFCC00] p-1 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isOnline && syncStatus === 'syncing' && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#FFCC00]/10 border-b border-[#FFCC00]/20">
          <RefreshCw className="h-4 w-4 text-[#FFCC00] animate-spin shrink-0" />
          <span className="text-xs font-medium text-[#FFCC00]">
            Syncing {pendingChanges} change{pendingChanges !== 1 ? 's' : ''}...
          </span>
          {/* Progress bar */}
          <div className="flex-1 h-1 rounded-full bg-[#FFCC00]/20 overflow-hidden">
            <div className="h-full bg-[#FFCC00] rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {isOnline && syncStatus !== 'syncing' && pendingChanges === 0 && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Back online</span>
        </div>
      )}
    </div>
  );
}
