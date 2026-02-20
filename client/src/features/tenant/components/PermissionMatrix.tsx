import { useReducer, useEffect, useCallback } from 'react';
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
  accountant: Object.fromEntries(
    PERMISSIONS.map((p) => [
      p.key,
      !['members.manage', 'settings.manage', 'billing.manage', 'statements.delete'].includes(p.key),
    ]),
  ),
  bookkeeper: Object.fromEntries(
    PERMISSIONS.map((p) => [
      p.key,
      [
        'transactions.read',
        'transactions.write',
        'accounts.read',
        'statements.upload',
        'reports.read',
        'gst.manage',
        'ai.query',
      ].includes(p.key),
    ]),
  ),
  viewer: Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.system])),
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-cba-gold',
  admin: 'text-blue-400',
  accountant: 'text-emerald-400',
  bookkeeper: 'text-purple-400',
  viewer: 'text-secondary',
};

type PMState = {
  matrix: PermissionMap;
  original: PermissionMap;
  modified: Set<string>;
  saving: boolean;
  saved: boolean;
  error: string | null;
};

type PMAction =
  | { type: 'loaded'; data: PermissionMap }
  | { type: 'toggle'; role: string; permission: string }
  | { type: 'save_start' }
  | { type: 'save_success' }
  | { type: 'save_error'; message: string }
  | { type: 'reset' }
  | { type: 'clear_saved' };

function pmReducer(state: PMState, action: PMAction): PMState {
  switch (action.type) {
    case 'loaded': {
      return { ...state, matrix: action.data, original: action.data };
    }
    case 'toggle': {
      const rolePerms = { ...(state.matrix[action.role] ?? {}) };
      rolePerms[action.permission] = !rolePerms[action.permission];
      return {
        ...state,
        matrix: { ...state.matrix, [action.role]: rolePerms },
        modified: new Set([...state.modified, action.role]),
      };
    }
    case 'save_start':
      return { ...state, saving: true, error: null };
    case 'save_success':
      return {
        ...state,
        saving: false,
        saved: true,
        original: { ...state.matrix },
        modified: new Set(),
      };
    case 'save_error':
      return { ...state, saving: false, error: action.message };
    case 'reset':
      return { ...state, matrix: DEFAULTS, modified: new Set(ROLES as unknown as string[]) };
    case 'clear_saved':
      return { ...state, saved: false };
    default:
      return state;
  }
}

const PM_INITIAL: PMState = {
  matrix: DEFAULTS,
  original: DEFAULTS,
  modified: new Set(),
  saving: false,
  saved: false,
  error: null,
};

export function PermissionMatrix() {
  const [state, dispatch] = useReducer(pmReducer, PM_INITIAL);
  const { matrix, modified, saving, saved, error } = state;

  const tenantId = localStorage.getItem('tenantId');

  useEffect(() => {
    if (!tenantId) return;
    tenantApi
      .getPermissions(tenantId)
      .then((data: PermissionMap) => {
        dispatch({ type: 'loaded', data: { ...DEFAULTS, ...data } });
      })
      .catch(() => {
        // Use defaults if fetch fails
      });
  }, [tenantId]);

  const togglePermission = useCallback(
    (role: string, permission: string) => {
      if (role === 'owner') return; // Owner always has all perms
      const perm = PERMISSIONS.find((p) => p.key === permission);
      if (perm?.system && matrix[role]?.[permission]) return; // Can't remove system read perms
      dispatch({ type: 'toggle', role, permission });
    },
    [matrix],
  );

  const handleSave = async () => {
    if (!tenantId) return;
    dispatch({ type: 'save_start' });
    try {
      for (const role of modified) {
        await tenantApi.updatePermissions(tenantId, role, matrix[role] ?? {});
      }
      dispatch({ type: 'save_success' });
      setTimeout(() => dispatch({ type: 'clear_saved' }), 3000);
    } catch (err: unknown) {
      dispatch({
        type: 'save_error',
        message: err instanceof Error ? err.message : 'Failed to save permissions',
      });
    }
  };

  const handleReset = () => {
    dispatch({ type: 'reset' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Permissions</h2>
          <p className="text-sm text-muted">Configure what each role can access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-secondary hover:text-primary neu-raised-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || modified.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-cba-gold text-base hover:bg-[#FFD633] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 font-medium">{error}</p>}

      <div className="neu-raised rounded-2xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Role permissions">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest min-w-[200px]">
                  Permission
                </th>
                {ROLES.map((role) => (
                  <th key={role} className="text-center px-3 py-3 min-w-[100px]">
                    <span
                      className={cn(
                        'text-[10px] font-black uppercase tracking-widest',
                        ROLE_COLORS[role],
                      )}
                    >
                      {role}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm) => (
                <tr
                  key={perm.key}
                  className="border-b border-border/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {perm.system && <Lock className="w-3 h-3 text-cba-gold" />}
                      <span className="text-primary font-medium">{perm.label}</span>
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
                                ? 'bg-cba-gold/10 text-cba-gold cursor-not-allowed'
                                : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                              : granted
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-zinc-800/30 text-zinc-600 hover:bg-zinc-700/30 hover:text-secondary',
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

      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-400" /> Granted
        </span>
        <span className="flex items-center gap-1">
          <X className="w-3 h-3 text-zinc-600" /> Denied
        </span>
        <span className="flex items-center gap-1">
          <Lock className="w-3 h-3 text-cba-gold" /> System (immutable)
        </span>
      </div>
    </div>
  );
}
