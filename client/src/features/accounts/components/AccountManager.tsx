import { useState, useEffect, useMemo } from 'react';
import { api, type Account } from '@/api';
import { cn } from '@/lib/utils';
import {
  Wallet,
  CreditCard,
  PiggyBank,
  Pencil,
  Check,
  X,
  Loader2,
  Building2,
  Briefcase,
  User,
  CalendarDays,
  Hash,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sparkline, CHART_COLORS } from '@/components/charts';

const ACCOUNT_TYPE_ICONS: Record<string, React.ElementType> = {
  checking: Wallet,
  savings: PiggyBank,
  credit_card: CreditCard,
  loan: Building2,
  transaction: Wallet,
  credit: CreditCard,
  other: Wallet,
};

const PRESET_COLORS = [
  { name: 'Gold', hex: '#FFCC00' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Amber', hex: '#F59E0B' },
];

const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'loan', 'other'] as const;

type FilterType = 'all' | 'business' | 'personal';

interface EditValues {
  accountName?: string;
  accountType?: string;
  color?: string;
  ownershipTag?: string;
  isBusinessAccount?: boolean;
}

function maskAccountNumber(num: string): string {
  if (num.length <= 4) return num;
  return `\u2022\u2022\u2022\u2022${num.slice(-4)}`;
}

function formatCurrency(cents: number | null): string {
  if (cents === null || cents === undefined) return '\u2014';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return '\u2014';
  }
}

export function AccountManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.fetchAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    if (filter === 'all') return accounts;
    if (filter === 'business') {
      return accounts.filter((a) => a.ownershipTag === 'business');
    }
    // 'personal' filter: accounts explicitly tagged personal OR untagged
    return accounts.filter((a) => !a.ownershipTag || a.ownershipTag === 'personal');
  }, [accounts, filter]);

  const filterCounts = useMemo(() => {
    const biz = accounts.filter((a) => a.ownershipTag === 'business').length;
    return {
      all: accounts.length,
      business: biz,
      personal: accounts.length - biz,
    };
  }, [accounts]);

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    setEditValues({
      accountName: account.accountName,
      accountType: account.accountType,
      isBusinessAccount: account.ownershipTag === 'business',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const { isBusinessAccount, ...rest } = editValues;
      const updates = {
        ...rest,
        ownershipTag: isBusinessAccount ? 'business' : 'personal',
      };
      await api.updateAccount(id, updates as Partial<Account>);
      setAccounts((prev) => prev.map((a) => (a.id === id ? ({ ...a, ...updates } as Account) : a)));
      setEditingId(null);
      setEditValues({});
    } catch (err) {
      console.error('Failed to update account:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 rounded-full bg-[#FFCC00] animate-pulse" />
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
            Loading accounts...
          </span>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 neu-inset rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="neu-raised rounded-3xl p-10 text-center border border-white/5">
        <div className="neu-inset w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
          <Wallet className="w-10 h-10 text-zinc-800" />
        </div>
        <h3 className="font-black text-zinc-200 uppercase tracking-widest text-sm">No Accounts</h3>
        <p className="text-xs text-zinc-600 mt-2 font-bold uppercase tracking-tight">
          Upload statements to auto-detect accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-pulse" />
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em]">
            Account Manager
          </h2>
        </div>
        <Badge variant="secondary" className="text-[9px]">
          {accounts.length} accounts
        </Badge>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 neu-inset rounded-xl p-1 mb-4">
        {(['all', 'business', 'personal'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-2 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
              filter === f ? 'bg-[#FFCC00] text-[#0a0a0f]' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {f}
            <span
              className={cn(
                'ml-1.5 text-[8px]',
                filter === f ? 'text-[#0a0a0f]/60' : 'text-zinc-600',
              )}
            >
              {filterCounts[f]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAccounts.map((account) => {
          const Icon = ACCOUNT_TYPE_ICONS[account.accountType] || Wallet;
          const isEditing = editingId === account.id;
          const isNegative = account.currentBalance !== null && account.currentBalance < 0;
          const isBusiness = account.ownershipTag === 'business';

          return (
            <div
              key={account.id}
              className={cn(
                'neu-raised rounded-2xl p-4 sm:p-5 border transition-all group',
                isEditing
                  ? 'border-[#FFCC00]/20 shadow-[0_0_20px_rgba(255,204,0,0.05)]'
                  : isBusiness
                    ? 'border-[#FFCC00]/20'
                    : 'border-white/5',
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="neu-inset p-2.5 rounded-xl text-[#FFCC00]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValues.accountName || ''}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, accountName: e.target.value }))
                        }
                        className="bg-transparent border-b border-[#FFCC00]/30 text-sm font-black text-zinc-100 uppercase tracking-tight outline-none w-full"
                      />
                    ) : (
                      <p className="text-sm font-black text-zinc-100 uppercase tracking-tight truncate max-w-[160px]">
                        {account.accountName}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                        {maskAccountNumber(account.accountNumber)}
                      </p>
                      {/* Ownership Badge */}
                      {isBusiness ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#FFCC00]/15 text-[7px] font-black text-[#FFCC00] uppercase tracking-widest">
                          <Briefcase className="w-2.5 h-2.5" />
                          BIZ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 text-[7px] font-black text-zinc-600 uppercase tracking-widest">
                          <User className="w-2.5 h-2.5" />
                          Personal
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => saveEdit(account.id)}
                      disabled={saving}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(account)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-600 hover:text-[#FFCC00] hover:bg-white/5 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isEditing && (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-1.5">
                      Type
                    </label>
                    <select
                      value={editValues.accountType || account.accountType}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, accountType: e.target.value }))
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#FFCC00]/30"
                    >
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t} className="bg-[#0a0a0f]">
                          {t.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-1.5">
                      Color
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setEditValues((prev) => ({ ...prev, color: c.hex }))}
                          className={cn(
                            'w-9 h-9 sm:w-7 sm:h-7 rounded-full border-2 transition-all',
                            editValues.color === c.hex
                              ? 'border-white scale-110'
                              : 'border-transparent hover:scale-110',
                          )}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Business Account Toggle */}
                  <div>
                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-1.5">
                      Business Account
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditValues((prev) => ({
                          ...prev,
                          isBusinessAccount: !prev.isBusinessAccount,
                        }))
                      }
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl border transition-all text-xs font-bold uppercase tracking-wider',
                        editValues.isBusinessAccount
                          ? 'bg-[#FFCC00]/10 border-[#FFCC00]/30 text-[#FFCC00]'
                          : 'bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20',
                      )}
                    >
                      {editValues.isBusinessAccount ? (
                        <>
                          <Briefcase className="w-3.5 h-3.5" />
                          Business
                        </>
                      ) : (
                        <>
                          <User className="w-3.5 h-3.5" />
                          Personal
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Account Stats Row */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1 text-[8px] font-bold text-zinc-600 uppercase tracking-wider">
                  <Hash className="w-2.5 h-2.5" />
                  <span>
                    {(account as Account & { transactionCount?: number }).transactionCount ??
                      '\u2014'}{' '}
                    txns
                  </span>
                </div>
                <div className="w-px h-3 bg-white/5" />
                <div className="flex items-center gap-1 text-[8px] font-bold text-zinc-600 uppercase tracking-wider">
                  <CalendarDays className="w-2.5 h-2.5" />
                  <span>{formatRelativeDate(account.updatedAt)}</span>
                </div>
              </div>

              {/* 30-day balance trend sparkline */}
              <div className="mb-3">
                <Sparkline
                  data={[0.85, 0.88, 0.92, 0.9, 0.96, 1.0].map(
                    (f) => Math.abs(account.currentBalance ?? 0) * f,
                  )}
                  width={180}
                  height={24}
                  color={isNegative ? CHART_COLORS.expense : CHART_COLORS.primary}
                  showArea
                  trend={isNegative ? 'down' : 'up'}
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-[8px]">
                    {account.accountType.replace('_', ' ')}
                  </Badge>
                  {account.bankName && (
                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tight italic">
                      {account.bankName}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'text-base sm:text-lg font-black tracking-tighter',
                    isNegative ? 'text-red-400' : 'text-emerald-400',
                  )}
                >
                  {formatCurrency(account.currentBalance)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state for filtered results */}
      {filteredAccounts.length === 0 && accounts.length > 0 && (
        <div className="neu-inset rounded-2xl p-8 text-center">
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
            No {filter} accounts found
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="mt-3 px-4 py-2 min-h-[44px] text-[9px] font-black text-[#FFCC00] uppercase tracking-wider hover:underline"
          >
            Show all accounts
          </button>
        </div>
      )}
    </div>
  );
}
