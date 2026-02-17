import { useState, useEffect, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import { apApi } from '../../../api';

const DISMISS_KEY = 'goldledger_push_dismissed_until';

export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'prompt' | 'subscribing' | 'granted' | 'denied'>('prompt');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const permission = Notification.permission;
    if (permission === 'granted' || permission === 'denied') {
      setStatus(permission === 'granted' ? 'granted' : 'denied');
      return;
    }

    // Check if dismissed recently
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    setVisible(true);
  }, []);

  const handleEnable = useCallback(async () => {
    setStatus('subscribing');
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setStatus('granted');

        // Subscribe to push
        const reg = await navigator.serviceWorker.ready;
        const { publicKey } = await apApi.getVapidKey();

        if (publicKey) {
          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });

          const subJson = subscription.toJSON();
          await apApi.subscribePush(
            {
              endpoint: subJson.endpoint!,
              keys: {
                p256dh: subJson.keys!.p256dh!,
                auth: subJson.keys!.auth!,
              },
            },
            navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
          );
        }

        setTimeout(() => setVisible(false), 2000);
      } else {
        setStatus('denied');
      }
    } catch {
      setStatus('denied');
    }
  }, []);

  const handleDismiss = useCallback(() => {
    // Dismiss for 30 days
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 z-50 animate-slide-up">
      <div className="neu-raised rounded-2xl border border-[#FFCC00]/20 p-5 bg-[#0d0d14]/98 backdrop-blur-xl shadow-2xl">
        {status === 'prompt' && (
          <>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFCC00]/10 flex items-center justify-center shrink-0">
                <Bell className="h-6 w-6 text-[#FFCC00]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-zinc-200">Enable Push Notifications</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Get alerts for large transactions, BAS deadlines, and budget warnings
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-zinc-600 hover:text-zinc-400 p-1 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleEnable}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-black bg-[#FFCC00] hover:bg-[#FFD633] btn-press min-h-[44px]"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-zinc-500 hover:text-zinc-400 min-h-[44px] px-2"
              >
                Not now
              </button>
            </div>
          </>
        )}
        {status === 'subscribing' && (
          <div className="flex items-center gap-3 text-zinc-400 text-sm py-2">
            <div className="w-5 h-5 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin" />
            Setting up notifications...
          </div>
        )}
        {status === 'granted' && (
          <div className="flex items-center gap-3 text-emerald-400 text-sm font-medium py-2">
            <Bell className="h-5 w-5" />
            Notifications enabled!
          </div>
        )}
        {status === 'denied' && (
          <div className="text-center py-2">
            <p className="text-sm text-zinc-400">Notifications blocked</p>
            <p className="text-xs text-zinc-600 mt-1">
              Enable in your browser settings to receive alerts
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-zinc-500 mt-3 hover:text-zinc-400 min-h-[44px] px-2"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Convert a base64 VAPID key to Uint8Array for pushManager.subscribe() */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
