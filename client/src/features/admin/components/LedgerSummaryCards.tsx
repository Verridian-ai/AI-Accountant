import { Receipt, TrendingUp, TrendingDown, Calendar, FileText } from 'lucide-react';
import type { LedgerSummary, BASSummary } from '../../../api/misc';

interface LedgerSummaryCardsProps {
  ledger: LedgerSummary | null;
  bas: BASSummary | null;
}

function formatAud(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function LedgerSummaryCards({ ledger, bas }: LedgerSummaryCardsProps) {
  if (!ledger && !bas) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-primary">Ledger Health</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ledger && (
          <>
            <Card
              icon={Receipt}
              color="text-blue-400"
              title="Total Transactions"
              value={ledger.totalTransactions.toLocaleString()}
              subtitle={`${ledger.totalUsers} user${ledger.totalUsers !== 1 ? 's' : ''}`}
            />
            <Card
              icon={TrendingUp}
              color="text-emerald-400"
              title="Total Income"
              value={formatAud(ledger.totalIncomeCents)}
              subtitle="Non-transfer credits"
            />
            <Card
              icon={TrendingDown}
              color="text-red-400"
              title="Total Expenses"
              value={formatAud(ledger.totalExpensesCents)}
              subtitle="Non-transfer debits"
            />
          </>
        )}
        {bas && (
          <>
            <Card
              icon={FileText}
              color="text-violet-400"
              title="BAS Periods"
              value={String(bas.totalPeriods)}
              subtitle={`${bas.lodgedCount} lodged, ${bas.draftCount} draft`}
            />
            <Card
              icon={Calendar}
              color="text-cba-gold"
              title="BAS Users"
              value={String(bas.usersWithBas)}
              subtitle="With BAS data"
            />
          </>
        )}
      </div>
      {ledger?.earliestTransaction && ledger?.latestTransaction && (
        <p className="text-xs text-zinc-600">
          Date range: {ledger.earliestTransaction} to {ledger.latestTransaction}
        </p>
      )}
    </div>
  );
}

function Card({
  icon: Icon,
  color,
  title,
  value,
  subtitle,
}: {
  icon: React.ElementType;
  color: string;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold mt-1.5 ${color}`}>{value}</p>
          <p className="text-xs text-muted mt-1">{subtitle}</p>
        </div>
        <div className="p-2 rounded-xl bg-[#1a1a2e]">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}
