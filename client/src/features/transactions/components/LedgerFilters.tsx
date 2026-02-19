import { Calendar, Tag, Wallet, DollarSign } from 'lucide-react';
import { CategorySelect } from './CategorySelect';
import type { Account } from '../types/ledger';

interface LedgerFiltersProps {
  startDate: string;
  endDate: string;
  selectedCategory: string;
  minAmount: string;
  maxAmount: string;
  selectedAccount?: string;
  accounts?: Account[];
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onCategoryChange: (category: string) => void;
  onMinAmountChange: (amount: string) => void;
  onMaxAmountChange: (amount: string) => void;
  onAccountChange?: (account: string) => void;
  onReset: () => void;
}

export function LedgerFilters({
  startDate,
  endDate,
  selectedCategory,
  minAmount,
  maxAmount,
  selectedAccount = 'All',
  accounts = [],
  onStartDateChange,
  onEndDateChange,
  onCategoryChange,
  onMinAmountChange,
  onMaxAmountChange,
  onAccountChange,
  onReset,
}: LedgerFiltersProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6 p-3 sm:p-6 neu-inset rounded-3xl animate-in zoom-in-95 duration-300">
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
          className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent"
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
          className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent"
        />
      </div>

      {/* Min Amount */}
      <div className="space-y-3">
        <label className="text-xs font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
          <DollarSign className="h-3 w-3" /> Min Amount
        </label>
        <input
          type="number"
          aria-label="Filter by minimum amount"
          value={minAmount}
          onChange={(e) => onMinAmountChange(e.target.value)}
          placeholder="0.00"
          step="0.01"
          className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent"
        />
      </div>

      {/* Max Amount */}
      <div className="space-y-3">
        <label className="text-xs font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
          <DollarSign className="h-3 w-3" /> Max Amount
        </label>
        <input
          type="number"
          aria-label="Filter by maximum amount"
          value={maxAmount}
          onChange={(e) => onMaxAmountChange(e.target.value)}
          placeholder="0.00"
          step="0.01"
          className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent"
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
              className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent border-none appearance-none cursor-pointer pr-10"
            >
              <option value="All" className="bg-surface text-primary">
                All Accounts
              </option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-surface text-primary">
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
          className="w-full py-3 min-h-[44px] text-xs font-black uppercase tracking-widest text-red-400 neu-raised-sm hover:glow-danger rounded-xl btn-press border border-red-500/10"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
