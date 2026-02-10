import { useState, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import { Activity, Search, Filter, FileText, FileSpreadsheet, Columns3, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOGGLEABLE_COLUMNS = [
  { id: 'date', label: 'Date' },
  { id: 'description', label: 'Description' },
  { id: 'amount', label: 'Amount' },
  { id: 'balance', label: 'Balance' },
  { id: 'category', label: 'Category' },
  { id: 'gstApplicable', label: 'Tax/GST' },
  { id: 'accountId', label: 'Account' },
  { id: 'actions', label: 'Actions' },
];

interface LedgerHeaderProps {
  filteredCount: number;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  onExport: (format: 'csv' | 'xlsx') => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (visibility: VisibilityState) => void;
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
  columnVisibility,
  onColumnVisibilityChange,
}: LedgerHeaderProps) {
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showColumnMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColumnMenu]);

  const toggleColumn = (columnId: string) => {
    const current = columnVisibility[columnId];
    // undefined or true means visible; toggle to false to hide
    onColumnVisibilityChange({
      ...columnVisibility,
      [columnId]: current === false ? true : false,
    });
  };

  const hiddenCount = TOGGLEABLE_COLUMNS.filter(
    (col) => columnVisibility[col.id] === false
  ).length;

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

          {/* Column visibility toggle */}
          <div className="relative" ref={columnMenuRef}>
            <button
              type="button"
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className={cn(
                "px-5 py-3 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all btn-press border border-white/5",
                showColumnMenu || hiddenCount > 0
                  ? "cba-gold-gradient text-[#0a0a0f] cba-gold-glow"
                  : "neu-raised-sm text-zinc-500 hover:text-[#FFCC00]"
              )}
              title="Toggle column visibility"
            >
              <Columns3 className="h-4 w-4" />
              <span>Columns</span>
              {hiddenCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                  {hiddenCount}
                </span>
              )}
            </button>

            {showColumnMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 neu-raised rounded-2xl border border-white/10 bg-[#12121a] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Show / Hide</p>
                </div>
                <div className="py-2">
                  {TOGGLEABLE_COLUMNS.map((col) => {
                    const isVisible = columnVisibility[col.id] !== false;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => toggleColumn(col.id)}
                        className={cn(
                          "w-full px-4 py-2.5 flex items-center justify-between text-sm font-bold transition-colors hover:bg-white/5",
                          isVisible ? "text-zinc-200" : "text-zinc-600"
                        )}
                      >
                        <span>{col.label}</span>
                        {isVisible ? (
                          <Eye className="h-4 w-4 text-[#FFCC00]" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-zinc-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {hiddenCount > 0 && (
                  <div className="px-4 py-3 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => onColumnVisibilityChange({})}
                      className="w-full text-xs font-black text-[#FFCC00] uppercase tracking-widest hover:text-[#FFE066] transition-colors"
                    >
                      Show All Columns
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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
