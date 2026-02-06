import { useMemo } from 'react';
import type { Transaction } from '../types/ledger';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { cn } from '@/lib/utils';

interface LedgerSummaryBarProps {
  transactions: Transaction[];
}

export function LedgerSummaryBar({ transactions }: LedgerSummaryBarProps) {
  const stats = useMemo(() => {
    const nonTransfers = transactions.filter((t) => !t.isTransfer);
    const transfers = transactions.filter((t) => t.isTransfer);
    const income = nonTransfers.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expenses = nonTransfers.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);
    const netFlow = income + expenses;
    const gstTotal = nonTransfers
      .filter((t) => t.gstApplicable)
      .reduce((sum, t) => sum + Math.round(Math.abs(t.amount) / 11), 0);

    return {
      income,
      expenses,
      netFlow,
      gstTotal,
      count: transactions.length,
      transferCount: transfers.length,
    };
  }, [transactions]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      <StatPill label="Income" value={<CurrencyDisplay amount={stats.income} />} colorClass="text-emerald-400" />
      <StatPill label="Expenses" value={<CurrencyDisplay amount={stats.expenses} />} colorClass="text-red-400" />
      <StatPill
        label="Net Flow"
        value={<CurrencyDisplay amount={stats.netFlow} />}
        colorClass={stats.netFlow >= 0 ? 'text-[#FFCC00]' : 'text-red-400'}
      />
      <StatPill label="GST" value={<CurrencyDisplay amount={stats.gstTotal} />} colorClass="text-blue-400" />
      <StatPill label="Count" value={stats.count} />
      {stats.transferCount > 0 && (
        <StatPill label="Transfers" value={stats.transferCount} colorClass="text-zinc-400" />
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: React.ReactNode;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col bg-[#12121a]/80 border border-white/5 rounded-xl px-4 py-2 min-w-[100px] shrink-0">
      <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">{label}</span>
      <span className={cn('text-sm font-bold tracking-tight', colorClass || 'text-white')}>{value}</span>
    </div>
  );
}
