import { useMemo, useRef, type ReactNode } from 'react';
import { API_URL } from '@/api/client.js';
import {
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Search,
  FileText,
  FileSpreadsheet,
  Activity,
  Filter,
  Calendar,
  Tag,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { TransactionCard } from '../TransactionCard';
import { MobileLayout } from '@/components/layout/MobileLayout';
import './TransactionTable.css';
import type { TransactionTableProps } from './types.js';
import { useTransactionFilters } from './hooks/useTransactionFilters.js';
import { useTransactionEdit } from './hooks/useTransactionEdit.js';
import { useTransactionSplit } from './hooks/useTransactionSplit.js';
import { createTransactionColumns } from './columns/transactionColumns.js';
import { LoadingSkeleton } from './components/LoadingSkeleton.js';
import { SplitModal } from './components/SplitModal.js';
import { VirtualizedTable } from './components/VirtualizedTable.js';

function SimpleStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col bg-surface/80 border border-border/50 rounded-xl px-4 py-2 min-w-[100px] shrink-0">
      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-bold text-primary tracking-tight">{value}</span>
    </div>
  );
}

const EMPTY_ACCOUNTS: NonNullable<TransactionTableProps['accounts']> = [];

export function TransactionTable({
  transactions,
  accounts,
  loading = false,
  onDataChange,
}: TransactionTableProps) {
  const resolvedAccounts = accounts ?? EMPTY_ACCOUNTS;
  const filters = useTransactionFilters({ transactions });
  const edit = useTransactionEdit({ transactions, onDataChange });
  const split = useTransactionSplit({ onDataChange });

  const columns = useMemo(
    () =>
      createTransactionColumns({
        editingId: edit.editingId,
        editForm: edit.editForm,
        setEditForm: edit.setEditForm,
        setEditingId: edit.setEditingId,
        categories: filters.categories,
        accounts: resolvedAccounts,
        handleEditStart: edit.handleEditStart,
        handleSave: edit.handleSave,
        handleDelete: edit.handleDelete,
        handleSplitStart: split.handleSplitStart,
      }),
    [
      edit.editingId,
      edit.editForm,
      edit.setEditForm,
      edit.setEditingId,
      filters.categories,
      resolvedAccounts,
      edit.handleEditStart,
      edit.handleSave,
      edit.handleDelete,
      split.handleSplitStart,
    ],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filters.filteredTransactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: filters.setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting: filters.sorting, globalFilter: filters.globalFilter },
    onGlobalFilterChange: filters.setGlobalFilter,
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const handleExport = (format: 'csv' | 'xlsx') => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.selectedCategory !== 'All') params.append('category', filters.selectedCategory);
    if (filters.globalFilter) params.append('search', filters.globalFilter);
    window.open(`${API_URL}/transactions/export?${params.toString()}`, '_blank');
  };

  const summaryStats = useMemo(() => {
    const totalAmount = filters.filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const avgAmount =
      filters.filteredTransactions.length > 0
        ? totalAmount / filters.filteredTransactions.length
        : 0;
    return (
      <>
        <SimpleStat label="Total Vol." value={<CurrencyDisplay amount={totalAmount} />} />
        <SimpleStat label="Tx Count" value={filters.filteredTransactions.length} />
        <SimpleStat label="Avg Value" value={<CurrencyDisplay amount={avgAmount} />} />
      </>
    );
  }, [filters.filteredTransactions]);

  if (loading) return <LoadingSkeleton />;

  return (
    <>
      {/* Mobile Layout */}
      <MobileLayout
        title="Ledger"
        subtitle={`${filters.filteredTransactions.length} nodes active`}
        onFilterClick={() => filters.setShowFilters(!filters.showFilters)}
        activeFiltersCount={
          Number(!!filters.startDate) +
          Number(!!filters.endDate) +
          Number(filters.selectedCategory !== 'All')
        }
        summaryStats={summaryStats}
      >
        {(filters.showFilters || filters.hasActiveFilters) && (
          <div className="grid grid-cols-1 gap-4 p-4 neu-inset rounded-2xl mb-4 animate-in slide-in-from-top-2">
            <div className="space-y-2">
              <label htmlFor="mobile-tx-search" className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">
                Search
              </label>
              <input
                id="mobile-tx-search"
                type="text"
                placeholder="Search..."
                aria-label="Search transactions"
                value={filters.globalFilter}
                onChange={(e) => filters.setGlobalFilter(e.target.value)}
                className="w-full px-4 py-3 text-sm neu-inset rounded-xl focus-gold outline-none text-cba-gold"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="mobile-tx-start" className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">
                  Start
                </label>
                <input
                  id="mobile-tx-start"
                  type="date"
                  aria-label="Start date"
                  value={filters.startDate}
                  onChange={(e) => filters.setStartDate(e.target.value)}
                  className="w-full px-3 py-3 text-xs neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="mobile-tx-end" className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">
                  End
                </label>
                <input
                  id="mobile-tx-end"
                  type="date"
                  aria-label="End date"
                  value={filters.endDate}
                  onChange={(e) => filters.setEndDate(e.target.value)}
                  className="w-full px-3 py-3 text-xs neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="mobile-tx-category" className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">
                Class
              </label>
              <div className="relative">
                <select
                  id="mobile-tx-category"
                  aria-label="Filter by category"
                  value={filters.selectedCategory}
                  onChange={(e) => filters.setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 text-xs neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent appearance-none"
                >
                  {filters.categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-surface text-primary">
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cba-gold/50 pointer-events-none" />
              </div>
            </div>
            <button
              onClick={() => {
                filters.setStartDate('');
                filters.setEndDate('');
                filters.setSelectedCategory('All');
                filters.setGlobalFilter('');
                filters.setShowFilters(false);
              }}
              className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-red-400 neu-raised-sm rounded-xl border border-red-500/10"
            >
              Reset
            </button>
          </div>
        )}

        {filters.filteredTransactions.map((tx) => (
          <TransactionCard
            key={tx.id}
            transaction={tx}
            accounts={resolvedAccounts}
            onEdit={edit.handleEditStart}
            onDelete={edit.handleDelete}
            onSplit={split.handleSplitStart}
            isEditing={edit.editingId === tx.id}
            editForm={edit.editForm}
            setEditForm={edit.setEditForm}
            onSave={edit.handleSave}
            onCancelEdit={() => edit.setEditingId(null)}
          />
        ))}

        {filters.filteredTransactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted">
            <Search className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-xs font-bold uppercase tracking-widest">No nodes found</span>
          </div>
        )}
      </MobileLayout>

      {/* Desktop Table View */}
      <div className="space-y-6 p-1 hidden md:block">
        <div className="neu-raised-sm lg:neu-raised rounded-3xl flex flex-col border border-border shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_10px_30px_-5px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="p-4 lg:p-6 border-b border-border/50 bg-white/1 space-y-4 lg:space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="absolute -inset-1 cba-gold-gradient rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative cba-gold-gradient p-3 rounded-xl">
                    <Activity className="h-6 w-6 text-base" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg lg:text-xl font-black text-gradient-gold uppercase tracking-tight">
                    Ledger Matrix
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest text-nowrap">
                      {filters.filteredTransactions.length} nodes active
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <input
                    type="text"
                    aria-label="Global Search"
                    placeholder="Search nodes..."
                    value={filters.globalFilter}
                    onChange={(e) => filters.setGlobalFilter(e.target.value)}
                    className="pl-11 pr-4 py-3 text-sm neu-inset rounded-2xl w-full focus-gold outline-none text-cba-gold placeholder-zinc-700 font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => filters.setShowFilters(!filters.showFilters)}
                  className={cn(
                    'px-5 py-3 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all btn-press border border-border/50',
                    filters.showFilters || filters.hasActiveFilters
                      ? 'cba-gold-gradient text-base cba-gold-glow'
                      : 'neu-raised-sm text-muted hover:text-cba-gold',
                  )}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                  {filters.hasActiveFilters && (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="p-3 neu-raised-sm rounded-2xl text-muted hover:text-blue-400 btn-press border border-border/50"
                    title="Export CSV"
                  >
                    <FileText className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('xlsx')}
                    className="p-3 neu-raised-sm rounded-2xl text-muted hover:text-emerald-400 btn-press border border-border/50"
                    title="Export Excel"
                  >
                    <FileSpreadsheet className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filter panel */}
          {(filters.showFilters || filters.hasActiveFilters) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 neu-inset rounded-3xl animate-in zoom-in-95 duration-300">
              <div className="space-y-3">
                <label htmlFor="desktop-tx-start" className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em] flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Origin Date
                </label>
                <input
                  id="desktop-tx-start"
                  type="date"
                  aria-label="Filter by Start Date"
                  value={filters.startDate}
                  onChange={(e) => filters.setStartDate(e.target.value)}
                  className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent"
                />
              </div>
              <div className="space-y-3">
                <label htmlFor="desktop-tx-end" className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em] flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Termination Date
                </label>
                <input
                  id="desktop-tx-end"
                  type="date"
                  aria-label="Filter by End Date"
                  value={filters.endDate}
                  onChange={(e) => filters.setEndDate(e.target.value)}
                  className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent"
                />
              </div>
              <div className="space-y-3">
                <label htmlFor="desktop-tx-category" className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em] flex items-center gap-2">
                  <Tag className="h-3 w-3" /> Class Matrix
                </label>
                <div className="relative">
                  <select
                    id="desktop-tx-category"
                    aria-label="Filter by Category"
                    value={filters.selectedCategory}
                    onChange={(e) => filters.setSelectedCategory(e.target.value)}
                    className="w-full py-3 pl-4 pr-10 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-cba-gold bg-transparent appearance-none"
                  >
                    {filters.categories.map((cat) => (
                      <option key={cat} value={cat} className="bg-surface text-primary">
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cba-gold/50 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    filters.setStartDate('');
                    filters.setEndDate('');
                    filters.setSelectedCategory('All');
                    filters.setGlobalFilter('');
                  }}
                  className="w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 neu-raised-sm hover:glow-danger rounded-xl btn-press border border-red-500/10"
                >
                  Reset Matrix
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 bg-overlay border-t border-border/50 relative group/table">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-overlay to-transparent pointer-events-none z-10 opacity-0 group-hover/table:opacity-100 transition-opacity md:hidden" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-overlay to-transparent pointer-events-none z-10 opacity-0 group-hover/table:opacity-100 transition-opacity md:hidden" />
          <VirtualizedTable
            table={table}
            columns={columns}
            rows={rows}
            rowVirtualizer={rowVirtualizer}
            parentRef={parentRef}
            editingId={edit.editingId}
          />
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border/50 bg-overlay flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                Total Nodes
              </span>
              <span className="text-xs font-bold text-secondary tracking-tight">
                {transactions.length}
              </span>
            </div>
            <div className="w-px h-6 bg-overlay" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                Current View
              </span>
              <span className="text-xs font-bold text-cba-gold tracking-tight">
                {filters.filteredTransactions.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest italic">
              Encrypted Secure Ledger
            </span>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={`dot-${i}`}
                  className={`w-1 h-1 rounded-full bg-cba-gold/30 animate-pulse pulse-delay-${i}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Split Modal */}
      {split.splittingTx && (
        <SplitModal
          splittingTx={split.splittingTx}
          splits={split.splits}
          setSplits={split.setSplits}
          setSplittingTx={split.setSplittingTx}
          categories={filters.categories}
          onSave={split.handleSplitSave}
        />
      )}
    </>
  );
}
