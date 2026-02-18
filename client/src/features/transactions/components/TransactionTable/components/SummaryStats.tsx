import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Transaction } from '@/api';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';

interface SimpleStatProps {
  label: string;
  value: ReactNode;
}

function SimpleStat({ label, value }: SimpleStatProps) {
  return (
    <div className="flex flex-col bg-[#12121a]/80 border border-white/5 rounded-xl px-4 py-2 min-w-[100px] shrink-0">
      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-bold text-white tracking-tight">{value}</span>
    </div>
  );
}

interface SummaryStatsProps {
  transactions: Transaction[];
}

export function SummaryStats({ transactions }: SummaryStatsProps) {
  const { totalAmount, avgAmount } = useMemo(() => {
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const avg = transactions.length > 0 ? total / transactions.length : 0;
    return { totalAmount: total, avgAmount: avg };
  }, [transactions]);

  return (
    <>
      <SimpleStat label="Total Vol." value={<CurrencyDisplay amount={totalAmount} />} />
      <SimpleStat label="Tx Count" value={transactions.length} />
      <SimpleStat label="Avg Value" value={<CurrencyDisplay amount={avgAmount} />} />
    </>
  );
}
