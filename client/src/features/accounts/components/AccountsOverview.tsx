import React, { useState, useEffect } from 'react';
import { api, type Account, type ReconciliationAlert } from '@/api';
import {
  Wallet,
  CreditCard,
  PiggyBank,
  Building2,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Activity,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface AccountsOverviewProps {
  onAccountSelect?: (accountId: string) => void;
}

const ACCOUNT_ICONS: Record<string, React.ElementType> = {
  checking: Wallet,
  savings: PiggyBank,
  credit_card: CreditCard,
  loan: Building2,
  investment: Activity,
  other: Wallet,
};

export function AccountsOverview({ onAccountSelect }: AccountsOverviewProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [alerts, setAlerts] = useState<ReconciliationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingAlert, setResolvingAlert] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsData, alertsData] = await Promise.all([
        api.fetchAccounts(),
        api.fetchReconciliationAlerts(),
      ]);
      setAccounts(accountsData);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    setResolvingAlert(alertId);
    try {
      await api.resolveReconciliationAlert(alertId, 'Resolved by user');
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setResolvingAlert(null);
    }
  };

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return '—';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
      cents / 100,
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Accounts List Skeleton */}
        <div className="neu-raised rounded-3xl overflow-hidden flex flex-col border border-white/5">
          <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="p-4 space-y-3 bg-white/[0.005]">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 neu-raised-sm rounded-2xl border border-white/5"
              >
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
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
        <h3 className="font-black text-zinc-200 uppercase tracking-widest text-sm">
          No Active Vaults
        </h3>
        <p className="text-xs text-zinc-600 mt-2 font-bold uppercase tracking-tight max-w-[200px] mx-auto leading-relaxed">
          Upload a verified statement to initialize your financial matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reconciliation Alerts */}
      {alerts.length > 0 && (
        <div className="neu-raised rounded-3xl p-6 border border-amber-500/10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-amber-500/[0.02] pointer-events-none" />
          <div className="flex items-center gap-3 mb-5 relative">
            <div className="p-2.5 neu-raised-sm rounded-xl text-amber-400 group-hover:glow-danger transition-all">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[11px] font-black text-amber-400 uppercase tracking-[0.2em]">
                Discrepancy Alerts
              </h3>
              <p className="text-[9px] font-bold text-zinc-600 uppercase mt-0.5">
                {alerts.length} conflicts detected
              </p>
            </div>
          </div>
          <div className="space-y-3 relative">
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between neu-inset rounded-2xl p-4 border border-white/5 hover:border-amber-500/20 transition-all"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-xs font-black text-zinc-300 uppercase tracking-tight truncate">
                    {alert.description}
                  </p>
                  {alert.difference !== null && (
                    <p className="text-[10px] font-bold text-amber-400/80 mt-1 uppercase tracking-widest">
                      Delta: {formatCurrency(alert.difference)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleResolveAlert(alert.id)}
                  disabled={resolvingAlert === alert.id}
                  className="p-2.5 neu-raised-sm rounded-xl text-amber-400 hover:text-emerald-400 btn-press disabled:opacity-50 border border-white/5 shadow-lg"
                  title="Resolve conflict"
                >
                  {resolvingAlert === alert.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div className="neu-raised rounded-3xl overflow-hidden flex flex-col border border-white/5">
        <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 neu-inset rounded-xl flex items-center justify-center text-[#FFCC00]">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-zinc-100 uppercase tracking-[0.2em]">
              Vault Inventory
            </h3>
          </div>
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest bg-black/20 px-2.5 py-1 rounded-full border border-white/5">
            {accounts.length} Active
          </span>
        </div>
        <div className="p-4 space-y-3 bg-white/[0.005]">
          {accounts.map((account) => {
            const Icon = ACCOUNT_ICONS[account.accountType] || Wallet;
            const isNegative = account.currentBalance !== null && account.currentBalance < 0;
            return (
              <div
                key={account.id}
                onClick={() => onAccountSelect?.(account.id)}
                className="group flex items-center gap-4 p-4 neu-raised-sm rounded-2xl border border-white/5 hover:neu-float transition-all cursor-pointer"
              >
                <div
                  className={cn(
                    'neu-inset p-3 rounded-xl transition-all group-hover:glow-success',
                    account.accountType === 'credit_card'
                      ? 'text-purple-400 group-hover:text-purple-300'
                      : 'text-[#FFCC00] group-hover:text-[#FFE066]',
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-zinc-100 truncate group-hover:text-[#FFCC00] transition-colors uppercase tracking-tight">
                    {account.accountName}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                      {account.accountNumber}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tight italic">
                      {account.bankName || 'Verified Source'}
                    </span>
                  </div>
                </div>
                <div className="text-right pr-2">
                  <p
                    className={cn(
                      'text-sm font-black tracking-tighter',
                      isNegative ? 'text-red-400' : 'text-emerald-400',
                    )}
                  >
                    {formatCurrency(account.currentBalance)}
                  </p>
                  <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.15em] mt-0.5">
                    {account.accountType.replace('_', ' ')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-[#FFCC00] transition-colors transform group-hover:translate-x-1" />
              </div>
            );
          })}
        </div>
        {/* Footer status */}
        <div className="px-6 py-3 border-t border-white/5 bg-black/20">
          <p className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.3em] text-center">
            Biometric Encryption Active
          </p>
        </div>
      </div>
    </div>
  );
}
