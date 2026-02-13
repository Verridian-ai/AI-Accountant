import { useState, useEffect } from 'react';
import {
  FileText,
  BarChart3,
  Wallet,
  ArrowUpDown,
  GitCompareArrows,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/api';
import type { Account } from '@/api';
import { cn } from '@/lib/utils';
import { ProfitAndLoss } from './ProfitAndLoss';
import { BalanceSheet } from './BalanceSheet';
import { CashFlow } from './CashFlow';
import { TrialBalance } from './TrialBalance';
import { PeriodComparison } from './PeriodComparison';
import { KPIDashboard } from './KPIDashboard';

type ReportTab = 'pnl' | 'balance-sheet' | 'cash-flow' | 'trial-balance' | 'comparison' | 'kpis';

const tabs: { id: ReportTab; label: string; icon: typeof FileText }[] = [
  { id: 'pnl', label: 'P&L', icon: FileText },
  { id: 'balance-sheet', label: 'Balance Sheet', icon: BarChart3 },
  { id: 'cash-flow', label: 'Cash Flow', icon: Wallet },
  { id: 'trial-balance', label: 'Trial Balance', icon: ArrowUpDown },
  { id: 'comparison', label: 'Comparison', icon: GitCompareArrows },
  { id: 'kpis', label: 'KPIs', icon: TrendingUp },
];

const generateFinancialYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i < 5; i++) {
    const year = currentYear - i;
    years.push({
      label: `FY${year}`,
      start: `${year - 1}-07-01`,
      end: `${year}-06-30`,
    });
  }
  return years;
};

export function ReportsDashboard() {
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedFY, setSelectedFY] = useState(0); // index into financialYears

  const financialYears = generateFinancialYears();
  const fy = financialYears[selectedFY];

  const [customStart, setCustomStart] = useState(fy.start);
  const [customEnd, setCustomEnd] = useState(fy.end);

  useEffect(() => {
    api.fetchAccounts().then(setAccounts).catch(console.error);
  }, []);

  // Sync custom dates with FY selection
  useEffect(() => {
    setCustomStart(fy.start);
    setCustomEnd(fy.end);
  }, [selectedFY]);

  // For single-date reports (balance sheet, trial balance): use end date
  const asAtDate = customEnd;
  // For KPI: use FY label
  const kpiPeriod = fy.label;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gradient-gold">Financial Reports</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Comprehensive financial statements and KPI tracking
          </p>
        </div>
      </div>

      {/* Controls Row */}
      <div className="neu-raised rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Financial Year Selector */}
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
              Financial Year
            </label>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(Number(e.target.value))}
              className="neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            >
              {financialYears.map((y, i) => (
                <option key={y.label} value={i}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
              Period Start
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
              Period End
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>

          {/* Account Filter */}
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
              Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            >
              <option value="">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_20px_rgba(255,204,0,0.2)]'
                : 'neu-raised text-zinc-400 hover:text-zinc-100 hover:bg-white/5',
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'pnl' && (
          <ProfitAndLoss
            periodStart={customStart}
            periodEnd={customEnd}
            accountId={selectedAccountId || undefined}
          />
        )}
        {activeTab === 'balance-sheet' && <BalanceSheet asAtDate={asAtDate} />}
        {activeTab === 'cash-flow' && <CashFlow periodStart={customStart} periodEnd={customEnd} />}
        {activeTab === 'trial-balance' && <TrialBalance asAtDate={asAtDate} />}
        {activeTab === 'comparison' && <PeriodComparison />}
        {activeTab === 'kpis' && <KPIDashboard period={kpiPeriod} />}
      </div>
    </div>
  );
}
