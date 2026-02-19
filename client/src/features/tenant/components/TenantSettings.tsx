import { useState, useEffect } from 'react';
import { Save, AlertTriangle, Building2 } from 'lucide-react';
import { tenantApi } from '@/api';

interface TenantData {
  id: string;
  name: string;
  slug: string;
  abn?: string;
  entityType?: string;
  industry?: string;
  financialYearEnd?: string;
  timezone?: string;
}

const ENTITY_TYPES = ['sole_trader', 'company', 'trust', 'partnership', 'smsf'];
const TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Hobart',
];
const FY_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function TenantSettings() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [form, setForm] = useState({
    name: '',
    abn: '',
    entityType: 'sole_trader',
    industry: '',
    financialYearEnd: 'June',
    timezone: 'Australia/Sydney',
  });
  const [saveState, setSaveState] = useState<{ saving: boolean; saved: boolean; error: string | null }>({ saving: false, saved: false, error: null });
  const { saving, saved, error } = saveState;
  const [deactivateState, setDeactivateState] = useState({ show: false, confirm: '' });
  const { show: showDeactivate, confirm: deactivateConfirm } = deactivateState;
  const [hasPermission, setHasPermission] = useState(true);

  const tenantId = localStorage.getItem('tenantId');

  useEffect(() => {
    if (!tenantId) return;
    tenantApi
      .getTenant(tenantId)
      .then((data: TenantData) => {
        setTenant(data);
        setForm({
          name: data.name ?? '',
          abn: data.abn ?? '',
          entityType: data.entityType ?? 'sole_trader',
          industry: data.industry ?? '',
          financialYearEnd: data.financialYearEnd ?? 'June',
          timezone: data.timezone ?? 'Australia/Sydney',
        });
      })
      .catch((err: Error) => {
        if (err.message.includes('403') || err.message.includes('permission')) {
          setHasPermission(false);
        }
        setSaveState((s) => ({ ...s, error: err.message }));
      });
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaveState({ saving: true, saved: false, error: null });
    try {
      await tenantApi.updateTenant(tenantId, form);
      setSaveState({ saving: false, saved: true, error: null });
      setTimeout(() => setSaveState((s) => ({ ...s, saved: false })), 3000);
    } catch (err: unknown) {
      setSaveState({ saving: false, saved: false, error: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDeactivate = async () => {
    if (!tenantId || deactivateConfirm !== tenant?.name) return;
    try {
      await tenantApi.deactivateTenant(tenantId);
      localStorage.removeItem('tenantId');
      window.location.reload();
    } catch (err: unknown) {
      setSaveState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Failed to deactivate' }));
    }
  };

  if (!hasPermission) {
    return (
      <div className="neu-raised rounded-2xl p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-cba-gold mx-auto mb-4" />
        <h3 className="text-lg font-bold text-primary">No Permission</h3>
        <p className="text-sm text-muted mt-2">
          You don't have permission to edit settings. Contact your workspace owner.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Workspace Settings</h2>
        <p className="text-sm text-muted">Configure your workspace details and preferences</p>
      </div>

      <div className="neu-raised rounded-2xl border border-border/50 p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <div className="neu-inset p-2 rounded-xl">
            <Building2 className="w-5 h-5 text-cba-gold" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100">Business Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="ts-name" className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">
              Name
            </label>
            <input
              id="ts-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-primary bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label htmlFor="ts-slug" className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">
              Slug
            </label>
            <input
              id="ts-slug"
              type="text"
              value={tenant?.slug ?? ''}
              readOnly
              className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-muted bg-transparent outline-none cursor-not-allowed"
            />
          </div>
          <div>
            <label htmlFor="ts-abn" className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">
              ABN
            </label>
            <input
              id="ts-abn"
              type="text"
              value={form.abn}
              onChange={(e) => setForm({ ...form, abn: e.target.value })}
              placeholder="XX XXX XXX XXX"
              className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-primary bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30 placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label htmlFor="ts-entity-type" className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">
              Entity Type
            </label>
            <select
              id="ts-entity-type"
              value={form.entityType}
              onChange={(e) => setForm({ ...form, entityType: e.target.value })}
              className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-primary bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#16213e]">
                  {t.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ts-industry" className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">
              Industry
            </label>
            <input
              id="ts-industry"
              type="text"
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="e.g. Retail, Construction"
              className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-primary bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30 placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label htmlFor="ts-fy-end" className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">
              Financial Year End
            </label>
            <select
              id="ts-fy-end"
              value={form.financialYearEnd}
              onChange={(e) => setForm({ ...form, financialYearEnd: e.target.value })}
              className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-primary bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            >
              {FY_MONTHS.map((m) => (
                <option key={m} value={m} className="bg-[#16213e]">
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="ts-timezone" className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">
              Timezone
            </label>
            <select
              id="ts-timezone"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-primary bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-[#16213e]">
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 font-medium">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-cba-gold text-base hover:bg-[#FFD633] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="neu-raised rounded-2xl border border-red-500/20 p-6 space-y-4">
        <h3 className="text-lg font-bold text-red-400">Danger Zone</h3>
        <p className="text-sm text-secondary">
          Deactivating your workspace will remove access for all members. This action can be
          reversed by contacting support.
        </p>

        {!showDeactivate ? (
          <button
            type="button"
            onClick={() => setDeactivateState((d) => ({ ...d, show: true }))}
            className="px-4 py-2 rounded-xl text-sm font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Deactivate Workspace
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-secondary">
              Type <span className="font-bold text-red-400">{tenant?.name}</span> to confirm:
            </p>
            <input
              type="text"
              value={deactivateConfirm}
              onChange={(e) => setDeactivateState((d) => ({ ...d, confirm: e.target.value }))}
              className="w-full max-w-sm neu-inset px-3 py-2.5 rounded-xl text-sm text-primary bg-transparent outline-none focus:ring-1 focus:ring-red-500/30"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivateConfirm !== tenant?.name}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500 text-primary hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                Confirm Deactivate
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeactivateState((d) => ({ ...d, show: false }));
                  setDeactivateState((d) => ({ ...d, confirm: '' }));
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
