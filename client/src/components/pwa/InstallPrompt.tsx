import { useState, useEffect, useCallback } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'goldledger-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  // Check if already installed as standalone
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  useEffect(() => {
    if (isStandalone) return;

    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setVisible(false);
    }

    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDeferredPrompt(null);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }, []);

  if (!visible || isStandalone) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="mx-auto max-w-3xl px-4 pt-2">
        <div className="flex items-center gap-3 rounded-xl bg-zinc-900/95 border border-zinc-700/50 px-4 py-3 shadow-lg backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cba-gold/10">
            <Download className="h-5 w-5 text-cba-gold" />
          </div>

          <p className="flex-1 text-sm font-medium text-primary">
            Install GoldLedger for faster access
          </p>

          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 rounded-lg bg-cba-gold px-4 py-2 text-sm font-bold text-zinc-900 transition-all hover:bg-[#FFD633] active:scale-95"
          >
            Install
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-zinc-800 hover:text-primary"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
