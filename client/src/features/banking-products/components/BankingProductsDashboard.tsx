import { useState } from 'react';
import {
  Search,
  BarChart3,
  Trophy,
  Building2,
  Bell,
  Calculator,
  ArrowUpDown,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductExplorer } from './ProductExplorer';
import { ProductComparison } from './ProductComparison';
import { LoanComparison } from './LoanComparison';
import { RateTracker } from './RateTracker';
import { BestRates } from './BestRates';
import { DataHolderDirectory } from './DataHolderDirectory';
import { RateAlertManager } from './RateAlertManager';
import { SavingsCalculator } from './SavingsCalculator';

type SubTab =
  | 'explore'
  | 'compare'
  | 'loan-calc'
  | 'rates'
  | 'best'
  | 'directory'
  | 'alerts'
  | 'savings';

const SUB_TABS: { id: SubTab; label: string; icon: typeof Search }[] = [
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'rates', label: 'Market Rates', icon: BarChart3 },
  { id: 'best', label: 'Best Rates', icon: Trophy },
  { id: 'loan-calc', label: 'Loan Calc', icon: Calculator },
  { id: 'savings', label: 'Savings', icon: DollarSign },
  { id: 'directory', label: 'Providers', icon: Building2 },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

export function BankingProductsDashboard() {
  const [subTab, setSubTab] = useState<SubTab>('explore');
  const [compareIds, setCompareIds] = useState<string[] | null>(null);

  const handleCompare = (ids: string[]) => {
    setCompareIds(ids);
    setSubTab('compare');
  };

  const handleBackFromCompare = () => {
    setCompareIds(null);
    setSubTab('explore');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Banking Products</h2>
        <p className="text-sm text-zinc-500">
          Compare rates, explore products & find savings across Australian banks
        </p>
      </div>

      {/* Sub-Tab Navigation */}
      {subTab !== 'compare' && (
        <div className="flex flex-wrap gap-2">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                subTab === tab.id
                  ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_15px_rgba(255,204,0,0.2)]'
                  : 'neu-raised-sm text-zinc-400 hover:text-zinc-200',
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Sub-Tab Content */}
      {subTab === 'explore' && <ProductExplorer onCompare={handleCompare} />}
      {subTab === 'compare' && compareIds && (
        <ProductComparison productIds={compareIds} onBack={handleBackFromCompare} />
      )}
      {subTab === 'loan-calc' && <LoanComparison />}
      {subTab === 'rates' && <RateTracker />}
      {subTab === 'best' && <BestRates />}
      {subTab === 'directory' && <DataHolderDirectory />}
      {subTab === 'alerts' && <RateAlertManager />}
      {subTab === 'savings' && <SavingsCalculator />}
    </div>
  );
}
