import { useState, useEffect, useCallback } from 'react';
import { Bell, Save, Send } from 'lucide-react';
import { apApi } from '../../../api';

interface Prefs {
  transactionAlerts: boolean;
  basReminders: boolean;
  budgetAlerts: boolean;
  taxReminders: boolean;
  billReminders: boolean;
  syncNotifications: boolean;
  teamNotifications: boolean;
  systemNotifications: boolean;
  largeTransactionThresholdCents: number;
  budgetAlertThresholdPercent: number;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
}

const DEFAULT_PREFS: Prefs = {
  transactionAlerts: true,
  basReminders: true,
  budgetAlerts: true,
  taxReminders: true,
  billReminders: true,
  syncNotifications: false,
  teamNotifications: true,
  systemNotifications: true,
  largeTransactionThresholdCents: 100000,
  budgetAlertThresholdPercent: 80,
  pushEnabled: true,
  emailEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  timezone: 'Australia/Sydney',
};

const CATEGORIES: Array<{ key: keyof Prefs; label: string; desc: string }> = [
  { key: 'transactionAlerts', label: 'Transaction Alerts', desc: 'Large or unusual transactions' },
  { key: 'basReminders', label: 'BAS Reminders', desc: 'Approaching due dates' },
  { key: 'budgetAlerts', label: 'Budget Alerts', desc: 'Over-budget categories' },
  { key: 'taxReminders', label: 'Tax Reminders', desc: 'Deadlines and lodgement' },
  { key: 'billReminders', label: 'Bill Reminders', desc: 'Recurring bill due dates' },
  { key: 'syncNotifications', label: 'Sync Notifications', desc: 'Offline sync completed' },
  { key: 'teamNotifications', label: 'Team Notifications', desc: 'Member changes' },
  { key: 'systemNotifications', label: 'System Notifications', desc: 'Maintenance and updates' },
];

export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    apApi
      .fetchNotificationPreferences()
      .then((data) => {
        setPrefs({ ...DEFAULT_PREFS, ...(data as Partial<Prefs>) });
      })
      .catch(() => {});
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await apApi.updateNotificationPreferences(prefs as unknown as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  const sendTest = useCallback(async () => {
    setTesting(true);
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('GoldLedger Test', {
          body: 'Push notifications are working!',
          icon: '/icons/icon-192.png',
        });
      }
    } finally {
      setTimeout(() => setTesting(false), 1000);
    }
  }, []);

  const toggle = (key: keyof Prefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const thresholdDollars = prefs.largeTransactionThresholdCents / 100;

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-6 w-6 text-[#FFCC00]" />
        <h2 className="text-lg font-bold text-zinc-200">Notification Preferences</h2>
      </div>

      {/* Delivery methods */}
      <section className="neu-raised rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Delivery</h3>
        <div className="flex items-center justify-between min-h-[44px]">
          <div>
            <p className="text-sm text-zinc-200">Push Notifications</p>
            <p className="text-xs text-zinc-500">Browser push alerts</p>
          </div>
          <button
            type="button"
            onClick={() => toggle('pushEnabled')}
            className={`w-12 h-7 rounded-full transition-colors shrink-0 ${prefs.pushEnabled ? 'bg-[#FFCC00]' : 'bg-zinc-700'}`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform mx-1 ${prefs.pushEnabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between min-h-[44px]">
          <div>
            <p className="text-sm text-zinc-200">Email Notifications</p>
            <p className="text-xs text-zinc-500">Email alerts</p>
          </div>
          <button
            type="button"
            onClick={() => toggle('emailEnabled')}
            className={`w-12 h-7 rounded-full transition-colors shrink-0 ${prefs.emailEnabled ? 'bg-[#FFCC00]' : 'bg-zinc-700'}`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform mx-1 ${prefs.emailEnabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </section>

      {/* Categories */}
      <section className="neu-raised rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Categories</h3>
        {CATEGORIES.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-1.5 min-h-[44px]">
            <div>
              <p className="text-sm text-zinc-200">{label}</p>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(key)}
              className={`w-12 h-7 rounded-full transition-colors shrink-0 ${prefs[key] ? 'bg-[#FFCC00]' : 'bg-zinc-700'}`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform mx-1 ${prefs[key] ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        ))}
      </section>

      {/* Thresholds */}
      <section className="neu-raised rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Thresholds</h3>
        <div>
          <label className="text-sm text-zinc-200 block mb-2">
            Large transaction:{' '}
            <span className="text-[#FFCC00] font-bold">${thresholdDollars.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min={10000}
            max={1000000}
            step={5000}
            value={prefs.largeTransactionThresholdCents}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, largeTransactionThresholdCents: Number(e.target.value) }))
            }
            className="w-full accent-[#FFCC00] min-h-[44px]"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>$100</span>
            <span>$10,000</span>
          </div>
        </div>
        <div>
          <label className="text-sm text-zinc-200 block mb-2">
            Budget alert at:{' '}
            <span className="text-[#FFCC00] font-bold">{prefs.budgetAlertThresholdPercent}%</span>
          </label>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={prefs.budgetAlertThresholdPercent}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, budgetAlertThresholdPercent: Number(e.target.value) }))
            }
            className="w-full accent-[#FFCC00] min-h-[44px]"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </section>

      {/* Quiet hours */}
      <section className="neu-raised rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Quiet Hours</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Start</label>
            <input
              type="time"
              value={prefs.quietHoursStart ?? '22:00'}
              onChange={(e) => setPrefs((p) => ({ ...p, quietHoursStart: e.target.value }))}
              className="w-full neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent min-h-[44px]"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">End</label>
            <input
              type="time"
              value={prefs.quietHoursEnd ?? '07:00'}
              onChange={(e) => setPrefs((p) => ({ ...p, quietHoursEnd: e.target.value }))}
              className="w-full neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent min-h-[44px]"
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 neu-raised py-3 px-6 rounded-xl text-sm font-bold text-black bg-[#FFCC00] hover:bg-[#FFD633] disabled:opacity-50 btn-press min-h-[44px]"
        >
          <Save className="h-4 w-4" />
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Preferences'}
        </button>
        <button
          type="button"
          onClick={sendTest}
          disabled={testing}
          className="neu-raised py-3 px-6 rounded-xl text-sm font-medium text-zinc-300 hover:text-[#FFCC00] btn-press min-h-[44px]"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
