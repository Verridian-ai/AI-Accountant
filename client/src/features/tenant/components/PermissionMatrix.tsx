import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw, Lock, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantApi } from '@/api';

const ROLES = ['owner', 'admin', 'accountant', 'bookkeeper', 'viewer'] as const;

const PERMISSIONS = [
  { key: 'transactions.read', label: 'View Transactions', system: true },
  { key: 'transactions.write', label: 'Edit Transactions', system: false },
  { key: 'transactions.delete', label: 'Delete Transactions', system: false },
  { key: 'accounts.read', label: 'View Accounts', system: true },
  { key: 'accounts.write', label: 'Manage Accounts', system: false },
  { key: 'statements.upload', label: 'Upload Statements', system: false },
  { key: 'statements.delete', label: 'Delete Statements', system: false },
  { key: 'reports.read', label: 'View Reports', system: true },
  { key: 'reports.export', label: 'Export Reports', system: false },
  { key: 'gst.manage', label: 'Manage GST', system: false },
  { key: 'bas.manage', label: 'Manage BAS', system: false },
  { key: 'tax.manage', label: 'Manage Tax', system: false },
  { key: 'members.manage', label: 'Manage Members', system: false },
  { key: 'settings.manage', label: 'Workspace Settings', system: false },
  { key: 'billing.manage', label: 'Billing & Plans', system: false },
  { key: 'ai.query', label: 'AI Queries', system: false },
] as const;

type PermissionMap = Record<string, Record<string, boolean>>;

// Default permission matrix
const DEFAULTS: PermissionMap = {
  owner: Object.fromEntries(PERMISSIONS.map((p) => [p.key, true])),
  admin: Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.key !== 'billing.manage'])),
  accountant: Object.fromEntries(PERMISSIONS.map((p) => [p.key, !['members.manage', 'settings.manage', 'billing.manage', 'statements.delete'].includes(p.key)])),
  bookkeeper: Object.fromEntries(PERMISSIONS.map((p) => [p.key, ['transactions.read', 'transactions.write', 'accounts.read', 'statements.upload', 'reports.read', 'gst.manage', 'ai.query'].includes(p.key)])),
  viewer: Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.system])),
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-[#FFCC00]',
  admin: 'text-blue-400',
  accountant: 'text-emerald-400',
  bookkeeper: 'text-purple-400',
  viewer: 'text-zinc-400',
};

export function PermissionMatrix() {
  const [matrix, setMatrix] = useState<PermissionMap>(DEFAULTS);
  const [original, setOriginal] = useState<PermissionMap>(DEFAULTS);
  const [modified, setModified] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantId = localStorage.getItem('tenantId');

  useEffect(() => {
    if (!tenantId) return;
    tenantApi
      .getPermissions(tenantId)
      .then((data: PermissionMap) => {
        const merged = { ...DEFAULTS, ...data };
        setMatrix(merged);
        setOriginal(merged);
      })
      .catch(() => {
        // Use defaults if fetch fails
      });
  }, [tenantId]);

  const togglePermission = useCallback((role: string, permission: string) => {
    if (role === 'owner') return; // Owner always has all perms
    const perm = PERMISSIONS.find((p) => p.key === permission);
    if (perm?.system && matrix[role]?.[permission]) return; // Can't remove system read perms

    setMatrix((prev) => {
      const rolePerms = { ...(prev[role] ?? {}) };
      rolePerms[permission] = !rolePerms[permission];
      return { ...prev, [role]: rolePerms };
    });
    setModified((prev) => new Set([...prev, role]));
  }, [matrix]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      for (const role of modified) {
        await tenantApi.updatePermissions(tenantId, role, matrix[role] ?? {});
      }
      setOriginal({ ...matrix });
      setModified(new Set());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setMatrix(DEFAULTS);
    setModified(new Set(ROLES as unknown as string[]));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Permissions</h2>
          <p className="text-sm text-zinc-500">Configure what each role can access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-zinc-200 neu-raised-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || modified.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 font-medium">{error}</p>}

      <div className="neu-raised rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest min-w-[200px]">Permission</th>
                {ROLES.map((role) => (
                  <th key={role} className="text-center px-3 py-3 min-w-[100px]">
                    <span className={cn('text-[10px] font-black uppercase tracking-widest', ROLE_COLORS[role])}>
                      {role}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm) => (
                <tr key={perm.key} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {perm.system && <Lock className="w-3 h-3 text-[#FFCC00]" />}
                      <span className="text-zinc-300 font-medium">{perm.label}</span>
                    </div>
                  </td>
                  {ROLES.map((role) => {
                    const granted = matrix[role]?.[perm.key] ?? false;
                    const isOwner = role === 'owner';
                    const isSystemLocked = perm.system && granted;
                    const isLocked = isOwner || isSystemLocked;

                    return (
                      <td key={role} className="text-center px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => togglePermission(role, perm.key)}
                          disabled={isLocked}
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center transition-all mx-auto',
                            isLocked
                              ? granted
                                ? 'bg-[#FFCC00]/10 text-[#FFCC00] cursor-not-allowed'
                                : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                              : granted
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-zinc-800/30 text-zinc-600 hover:bg-zinc-700/30 hover:text-zinc-400'
                          )}
                        >
                          {isLocked && granted ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : granted ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Granted</span>
        <span className="flex items-center gap-1"><X className="w-3 h-3 text-zinc-600" /> Denied</span>
        <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-[#FFCC00]" /> System (immutable)</span>
      </div>
    </div>
  );
}
