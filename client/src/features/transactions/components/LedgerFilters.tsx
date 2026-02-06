import { Calendar, Tag, Wallet } from 'lucide-react';
import { CategorySelect } from './CategorySelect';
import type { Account } from '../types/ledger';

interface LedgerFiltersProps {
  startDate: string;
  endDate: string;
  selectedCategory: string;
  selectedAccount?: string;
  accounts?: Account[];
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onCategoryChange: (category: string) => void;
  onAccountChange?: (account: string) => void;
  onReset: () => void;
}

export function LedgerFilters({
  startDate,
  endDate,
  selectedCategory,
  selectedAccount = 'All',
  accounts = [],
  onStartDateChange,
  onEndDateChange,
  onCategoryChange,
  onAccountChange,
  onReset,
}: LedgerFiltersProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 p-6 neu-inset rounded-3xl animate-in zoom-in-95 duration-300">
      {/* Start Date */}
      <div className="space-y-3">
        <label className="text-xs font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
          <Calendar className="h-3 w-3" /> Start Date
        </label>
        <input
          type="date"
          aria-label="Filter by start date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] bg-transparent"
        />
      </div>

      {/* End Date */}
      <div className="space-y-3">
        <label className="text-xs font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
          <Calendar className="h-3 w-3" /> End Date
        </label>
        <input
          type="date"
          aria-label="Filter by end date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] bg-transparent"
        />
      </div>

      {/* Category */}
      <div className="space-y-3">
        <label className="text-xs font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
          <Tag className="h-3 w-3" /> Category
        </label>
        <CategorySelect
          value={selectedCategory}
          onChange={onCategoryChange}
          includeAll={true}
          aria-label="Filter by category"
        />
      </div>

      {/* Account */}
      {accounts.length > 0 && onAccountChange && (
        <div className="space-y-3">
          <label className="text-xs font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
            <Wallet className="h-3 w-3" /> Account
          </label>
          <div className="relative">
            <select
              aria-label="Filter by account"
              value={selectedAccount}
              onChange={(e) => onAccountChange(e.target.value)}
              className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] bg-transparent border-none appearance-none cursor-pointer pr-10"
            >
              <option value="All" className="bg-[#12121a] text-zinc-300">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id} className="bg-[#12121a] text-zinc-300">
                  {acc.accountName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Reset */}
      <div className="flex items-end">
        <button
          onClick={onReset}
          className="w-full py-3 text-xs font-black uppercase tracking-widest text-red-400 neu-raised-sm hover:glow-danger rounded-xl btn-press border border-red-500/10"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
