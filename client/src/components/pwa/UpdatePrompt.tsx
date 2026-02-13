import { RefreshCw } from 'lucide-react';
import { useServiceWorker } from '../../hooks/useServiceWorker';

export function UpdatePrompt() {
  const { updateAvailable, skipWaiting } = useServiceWorker();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 md:bottom-6 animate-in slide-in-from-bottom-2 duration-300">
      <div className="mx-auto max-w-md px-4">
        <div className="flex items-center gap-3 rounded-xl neu-raised border border-[#FFCC00]/20 px-4 py-3 shadow-lg">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFCC00]/10">
            <RefreshCw className="h-5 w-5 text-[#FFCC00]" />
          </div>

          <p className="flex-1 text-sm font-medium text-zinc-200">A new version is available</p>

          <button
            type="button"
            onClick={skipWaiting}
            className="shrink-0 rounded-lg bg-[#FFCC00] px-4 py-2 text-sm font-bold text-zinc-900 transition-all hover:bg-[#FFD633] active:scale-95"
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}
