import type { RefObject } from 'react';
import { Activity, Search, Filter, FileText, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LedgerHeaderProps {
  filteredCount: number;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  onExport: (format: 'csv' | 'xlsx') => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

export function LedgerHeader({
  filteredCount,
  globalFilter,
  onGlobalFilterChange,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  onExport,
  searchInputRef,
}: LedgerHeaderProps) {
  return (
    <div className="p-4 lg:p-6 border-b border-white/5 bg-white/1 space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute -inset-1 cba-gold-gradient rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative cba-gold-gradient p-3 rounded-xl">
              <Activity className="h-6 w-6 text-[#0a0a0f]" />
            </div>
          </div>
          <div>
            <h2 className="text-lg lg:text-xl font-black text-gradient-gold uppercase tracking-tight">
              Transaction Ledger
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-nowrap">
                {filteredCount} transactions
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search transactions"
              placeholder="Search transactions..."
              value={globalFilter}
              onChange={(e) => onGlobalFilterChange(e.target.value)}
              className="pl-11 pr-4 py-3 text-sm neu-inset rounded-2xl w-full focus-gold outline-none text-[#FFCC00] placeholder-zinc-700 font-medium"
            />
          </div>

          {/* Filter toggle button */}
          <button
            type="button"
            onClick={onToggleFilters}
            className={cn(
              "px-5 py-3 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all btn-press border border-white/5",
              showFilters || hasActiveFilters
                ? "cba-gold-gradient text-[#0a0a0f] cba-gold-glow"
                : "neu-raised-sm text-zinc-500 hover:text-[#FFCC00]"
            )}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
          </button>

          {/* Export buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => onExport('csv')}
              className="p-3 neu-raised-sm rounded-2xl text-zinc-500 hover:text-blue-400 btn-press border border-white/5"
              title="Export CSV"
            >
              <FileText className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onExport('xlsx')}
              className="p-3 neu-raised-sm rounded-2xl text-zinc-500 hover:text-emerald-400 btn-press border border-white/5"
              title="Export Excel"
            >
              <FileSpreadsheet className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
