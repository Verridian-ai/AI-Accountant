import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Trash2, X } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  category: string;
  url?: string;
  read: boolean;
  timestamp: string;
}

const STORAGE_KEY = 'goldledger_notifications';

function loadNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function groupByDate(items: Notification[]): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {};
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  for (const item of items) {
    const dateStr = new Date(item.timestamp).toDateString();
    const label =
      dateStr === todayStr ? 'Today' : dateStr === yesterdayStr ? 'Yesterday' : 'Earlier';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

const categoryIcons: Record<string, string> = {
  transaction_alerts: '💰',
  bas_reminders: '📋',
  budget_alerts: '📊',
  tax_reminders: '🧾',
  bill_reminders: '📄',
  sync_notifications: '🔄',
  team_notifications: '👥',
  system_notifications: '⚙️',
};

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Listen for push events via service worker messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NOTIFICATION') {
        const { title, body, data } = event.data.payload;
        const newNotif: Notification = {
          id: crypto.randomUUID(),
          title,
          body,
          category: data?.type ?? 'system_notifications',
          url: data?.url,
          read: false,
          timestamp: new Date().toISOString(),
        };
        setNotifications((prev) => {
          const updated = [newNotif, ...prev].slice(0, 100);
          saveNotifications(updated);
          return updated;
        });
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  const handleClick = useCallback((notif: Notification) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n));
      saveNotifications(updated);
      return updated;
    });
    if (notif.url) {
      window.location.hash = notif.url;
    }
    setIsOpen(false);
  }, []);

  const grouped = groupByDate(notifications);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        title="Notifications"
        aria-label="View notifications"
        onClick={() => setIsOpen(!isOpen)}
        className="neu-raised-sm p-2 text-secondary hover:text-cba-gold hover:cba-gold-glow rounded-xl btn-press relative"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-cba-gold text-black px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[70vh] overflow-y-auto neu-raised rounded-2xl border border-cba-gold/10 bg-[#0d0d14]/98 backdrop-blur-xl z-50 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-cba-gold/10">
            <h3 className="text-sm font-bold text-primary">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-bold text-cba-gold hover:text-cba-gold/80 uppercase tracking-wider"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-muted hover:text-red-400 p-1"
                  title="Clear all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted hover:text-primary p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#FFCC00]/5">
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label}>
                  <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    {label}
                  </div>
                  {items.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleClick(notif)}
                      className={`w-full text-left px-4 py-3 hover:bg-cba-gold/5 transition-colors flex items-start gap-3 ${!notif.read ? 'bg-cba-gold/[0.02]' : ''}`}
                    >
                      <span className="text-lg shrink-0 mt-0.5">
                        {categoryIcons[notif.category] ?? '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold truncate ${!notif.read ? 'text-primary' : 'text-secondary'}`}
                          >
                            {notif.title}
                          </span>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-cba-gold shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted truncate mt-0.5">{notif.body}</p>
                        <span className="text-[10px] text-zinc-600 mt-1 block">
                          {formatTimestamp(notif.timestamp)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
