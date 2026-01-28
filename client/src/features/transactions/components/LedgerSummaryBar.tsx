import { useMemo } from 'react';
import type { Transaction } from '../types/ledger';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';

interface LedgerSummaryBarProps {
  transactions: Transaction[];
}

export function LedgerSummaryBar({ transactions }: LedgerSummaryBarProps) {
  const stats = useMemo(() => {
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const avgAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;
    return { totalAmount, avgAmount, count: transactions.length };
  }, [transactions]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      <StatPill label="Total" value={<CurrencyDisplay amount={stats.totalAmount} />} />
      <StatPill label="Count" value={stats.count} />
      <StatPill label="Average" value={<CurrencyDisplay amount={stats.avgAmount} />} />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col bg-[#12121a]/80 border border-white/5 rounded-xl px-4 py-2 min-w-[100px] shrink-0">
      <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-bold text-white tracking-tight">{value}</span>
    </div>
  );
}
