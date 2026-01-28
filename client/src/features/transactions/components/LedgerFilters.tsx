import { Calendar, Tag } from 'lucide-react';
import { CategorySelect } from './CategorySelect';

interface LedgerFiltersProps {
  startDate: string;
  endDate: string;
  selectedCategory: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onCategoryChange: (category: string) => void;
  onReset: () => void;
}

export function LedgerFilters({
  startDate,
  endDate,
  selectedCategory,
  onStartDateChange,
  onEndDateChange,
  onCategoryChange,
  onReset,
}: LedgerFiltersProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 neu-inset rounded-3xl animate-in zoom-in-95 duration-300">
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
