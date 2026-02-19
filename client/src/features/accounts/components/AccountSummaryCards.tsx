import { useState, useEffect } from 'react';
import { api, type Account, type Transaction } from '@/api';
import { cn } from '@/lib/utils';
import {
  Wallet,
  CreditCard,
  PiggyBank,
  Building2,
  TrendingUp,
  TrendingDown,
  Clock,
  Receipt,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ACCOUNT_TYPE_ICONS: Record<string, React.ElementType> = {
  checking: Wallet,
  savings: PiggyBank,
  credit_card: CreditCard,
  loan: Building2,
  transaction: Wallet,
  credit: CreditCard,
  other: Wallet,
};

interface AccountSummary {
  account: Account;
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  lastActivity: string | null;
  gstTotal: number;
}

export function AccountSummaryCards() {
  const [summaries, setSummaries] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    try {
      const [accounts, { transactions }] = await Promise.all([
        api.fetchAccounts(),
        api.fetchTransactions({ limit: 10000 }),
      ]);

      const summaryData: AccountSummary[] = accounts.map((account) => {
        const accountTxs = transactions.filter((t: Transaction) => t.accountId === account.id);
        const nonTransfers = accountTxs.filter((t: Transaction) => !t.isTransfer);

        return {
          account,
          transactionCount: accountTxs.length,
          totalIncome: nonTransfers
            .filter((t: Transaction) => t.amount > 0)
            .reduce((s: number, t: Transaction) => s + t.amount, 0),
          totalExpenses: nonTransfers
            .filter((t: Transaction) => t.amount < 0)
            .reduce((s: number, t: Transaction) => s + Math.abs(t.amount), 0),
          lastActivity:
            accountTxs.length > 0
              ? (accountTxs.sort((a: Transaction, b: Transaction) =>
                  b.date.localeCompare(a.date),
                )[0]?.date ?? null)
              : null,
          gstTotal: accountTxs
            .filter((t: Transaction) => t.gstApplicable)
            .reduce((s: number, t: Transaction) => s + Math.abs(t.amount), 0),
        };
      });

      setSummaries(summaryData);
    } catch (err) {
      console.error('Failed to load account summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No activity';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-44 neu-raised rounded-2xl animate-pulse border border-border/50"
          />
        ))}
      </div>
    );
  }

  if (summaries.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-cba-gold animate-pulse" />
        <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.25em]">
          Account Summary
        </h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map(
          ({ account, transactionCount, totalIncome, totalExpenses, lastActivity }) => {
            const Icon = ACCOUNT_TYPE_ICONS[account.accountType] || Wallet;
            const isNegative = account.currentBalance !== null && account.currentBalance < 0;
            const ownershipTag = account.ownershipTag;

            return (
              <div
                key={account.id}
                className="neu-raised rounded-2xl p-5 border border-border/50 group hover:border-cba-gold/10 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="neu-inset p-2.5 rounded-xl text-cba-gold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-100 uppercase tracking-tight truncate max-w-[140px]">
                        {account.accountName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="secondary" className="text-[7px]">
                          {account.accountType.replace('_', ' ')}
                        </Badge>
                        {ownershipTag && (
                          <Badge
                            variant={ownershipTag === 'personal' ? 'outline' : 'default'}
                            className="text-[7px]"
                          >
                            {ownershipTag}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p
                    className={cn(
                      'text-lg font-black tracking-tighter',
                      isNegative ? 'text-red-400' : 'text-emerald-400',
                    )}
                  >
                    {formatCurrency(account.currentBalance || 0)}
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="neu-inset rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">
                        Income
                      </span>
                    </div>
                    <p className="text-xs font-black text-emerald-400">
                      {formatCurrency(totalIncome)}
                    </p>
                  </div>
                  <div className="neu-inset rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingDown className="w-3 h-3 text-red-400" />
                      <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">
                        Expenses
                      </span>
                    </div>
                    <p className="text-xs font-black text-red-400">
                      {formatCurrency(totalExpenses)}
                    </p>
                  </div>
                  <div className="neu-inset rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Receipt className="w-3 h-3 text-cba-gold" />
                      <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">
                        Transactions
                      </span>
                    </div>
                    <p className="text-xs font-black text-primary">{transactionCount}</p>
                  </div>
                  <div className="neu-inset rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-secondary" />
                      <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">
                        Last Active
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-secondary">
                      {formatDate(lastActivity)}
                    </p>
                  </div>
                </div>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
