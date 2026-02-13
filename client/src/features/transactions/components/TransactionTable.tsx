import { useState, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table';
import type { Transaction } from '@/api';
import { api } from '@/api';
import {
  ArrowUpDown,
  Search,
  FileText,
  FileSpreadsheet,
  Activity,
  Wallet,
  Scissors,
  Plus,
  Trash2,
  History,
  Calendar,
  PiggyBank,
  CreditCard,
  Filter,
  X,
  Edit2,
  Save,
  Tag,
  DollarSign,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryColor } from '@/utils/categoryColors';
import { AccountHoverCard } from '@/features/accounts/components/AccountHoverCard';
import type { Account } from '@/api';
import './TransactionTable.css';
import { TransactionCard, TransactionCardSkeleton } from './TransactionCard';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Skeleton } from '@/components/ui/skeleton';

interface TransactionTableProps {
  transactions: Transaction[];
  accounts?: Account[];
  loading?: boolean;
  onDataChange?: () => void;
}

const DynamicHeightRow = ({ height, children }: { height: number; children: React.ReactNode }) => {
  const ref = useRef<HTMLTableRowElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.style.height = `${height}px`;
  }, [height]);
  return <tr ref={ref}>{children}</tr>;
};

const DynamicTh = ({
  width,
  children,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableHeaderCellElement> & { width?: number }) => {
  const ref = useRef<HTMLTableHeaderCellElement>(null);
  useLayoutEffect(() => {
    if (ref.current && width) {
      ref.current.style.setProperty('--column-width', `${width}px`);
    }
  }, [width]);
  return (
    <th ref={ref} className={className} {...props}>
      {children}
    </th>
  );
};

export function TransactionTable({
  transactions,
  accounts = [],
  loading = false,
  onDataChange,
}: TransactionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  // Split state
  const [splittingTx, setSplittingTx] = useState<Transaction | null>(null);
  const [splits, setSplits] = useState<
    Array<{ category: string; amount: number; description: string; gst: boolean }>
  >([]);

  // Get unique categories
  const categories = useMemo(
    () =>
      [
        'All',
        'Office Supplies',
        'Travel',
        'Meals',
        'Utilities',
        'Professional Fees',
        'Rent',
        'Software',
        'Uncategorized',
        ...new Set(transactions.map((t) => t.category || 'Uncategorized')),
      ]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort(),
    [transactions],
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesCategory =
        selectedCategory === 'All' || (t.category || 'Uncategorized') === selectedCategory;
      const matchesStart = !startDate || t.date >= startDate;
      const matchesEnd = !endDate || t.date <= endDate;
      return matchesCategory && matchesStart && matchesEnd;
    });
  }, [transactions, selectedCategory, startDate, endDate]);

  const handleEditStart = useCallback((tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm({
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
      gstApplicable: tx.gstApplicable,
    });
  }, []);

  const handleSave = useCallback(
    async (id: string) => {
      // Find original transaction data for undo
      const originalTx = transactions.find((t) => t.id === id);
      if (!originalTx) {
        alert('Transaction not found');
        return;
      }

      try {
        await api.updateTransaction(id, editForm);
        setEditingId(null);
        onDataChange?.();
      } catch (err) {
        console.error(err);
        alert('Failed to save changes');
      }
    },
    [editForm, transactions, onDataChange],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (confirm('Delete this transaction?')) {
        try {
          await api.deleteTransaction(id);
          onDataChange?.();
        } catch (err) {
          console.error(err);
          alert('Failed to delete transaction');
        }
      }
    },
    [onDataChange],
  );

  const handleSplitStart = useCallback((tx: Transaction) => {
    setSplittingTx(tx);
    setSplits([
      {
        category: tx.category || 'Uncategorized',
        amount: Math.floor(tx.amount / 2),
        description: tx.description,
        gst: tx.gstApplicable,
      },
      {
        category: 'Uncategorized',
        amount: tx.amount - Math.floor(tx.amount / 2),
        description: tx.description,
        gst: tx.gstApplicable,
      },
    ]);
  }, []);

  const handleSplitSave = useCallback(async () => {
    if (!splittingTx) return;
    const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
    if (totalSplit !== splittingTx.amount) {
      alert(
        `Total split amount (${totalSplit / 100}) must equal original amount (${splittingTx.amount / 100})`,
      );
      return;
    }

    try {
      await api.splitTransaction(splittingTx.id, splits);
      setSplittingTx(null);
      onDataChange?.();
    } catch (err) {
      console.error(err);
      alert('Failed to split transaction');
    }
  }, [splittingTx, splits, onDataChange]);

  const columns: ColumnDef<Transaction>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        size: 100,
        minSize: 90,
        header: ({ column }) => (
          <button
            type="button"
            title="Sort by date"
            className="flex items-center gap-2 hover:text-[#FFCC00] transition-colors group/head"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <Calendar className="h-3 w-3 text-zinc-500 group-hover/head:text-[#FFCC00]" />
            <span className="uppercase tracking-widest text-[9px] font-black">Date</span>
            <ArrowUpDown className="h-3 w-3 opacity-50" />
          </button>
        ),
        cell: ({ row }) => {
          if (!row) return null;
          return (
            <div className="flex flex-col">
              <span className="font-mono text-[10px] font-black text-zinc-500 tracking-wider neu-inset px-2.5 py-1 rounded-lg border border-white/5 w-fit whitespace-nowrap">
                {row.original.date}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'description',
        size: 280,
        minSize: 200,
        header: () => (
          <div className="flex items-center gap-2">
            <FileText className="h-3 w-3 text-zinc-500" />
            <span className="uppercase tracking-widest text-[9px] font-black">Description</span>
          </div>
        ),
        cell: ({ row }) => {
          if (!row) return null;
          const tx = row.original;
          const isEditing = editingId === tx.id;

          if (isEditing) {
            return (
              <div className="relative group min-w-[200px]">
                <input
                  type="text"
                  aria-label="Edit description"
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-2 text-sm neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] font-bold"
                  autoFocus
                />
                <Edit2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-[#FFCC00]/50" />
              </div>
            );
          }

          return (
            <div
              className="flex items-center gap-3 group cursor-pointer min-w-[200px]"
              onClick={() => handleEditStart(tx)}
            >
              <div className="w-8 h-8 neu-inset rounded-lg flex items-center justify-center shrink-0 group-hover:neu-raised transition-all">
                <Activity className="h-3.5 w-3.5 text-zinc-600 group-hover:text-[#FFCC00] transition-colors" />
              </div>
              <div
                className="max-w-[140px] sm:max-w-[220px] lg:max-w-[280px] truncate text-zinc-100 font-bold tracking-tight text-sm group-hover:text-[#FFCC00] transition-colors"
                title={tx.description}
              >
                {tx.description}
              </div>
              {tx.isEdited && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase tracking-[0.15em] border border-amber-500/20 whitespace-nowrap">
                  <History className="h-2.5 w-2.5" /> Modified
                </span>
              )}
              <button
                type="button"
                aria-label="Quick edit"
                title="Quick edit"
                className="opacity-0 group-hover:opacity-100 p-1.5 neu-raised-sm rounded-lg text-[#FFCC00] transition-all transform scale-90 group-hover:scale-100 border border-white/5"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: 'amount',
        size: 130,
        minSize: 110,
        header: () => (
          <div className="flex items-center gap-2">
            <DollarSign className="h-3 w-3 text-zinc-500" />
            <span className="uppercase tracking-widest text-[9px] font-black">Amount</span>
          </div>
        ),
        cell: ({ row }) => {
          if (!row) return null;
          const tx = row.original;
          const isEditing = editingId === tx.id;
          const amount = (isEditing ? editForm.amount || 0 : tx.amount) / 100;

          if (isEditing) {
            return (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-500">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  aria-label="Edit amount"
                  value={amount}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      amount: Math.round(parseFloat(e.target.value) * 100),
                    })
                  }
                  className="w-28 pl-6 pr-3 py-2 text-sm neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] font-bold"
                />
              </div>
            );
          }

          return <CurrencyDisplay amount={isEditing ? editForm.amount || 0 : tx.amount} />;
        },
      },
      {
        accessorKey: 'category',
        size: 180,
        minSize: 150,
        header: () => (
          <div className="flex items-center gap-2">
            <Tag className="h-3 w-3 text-zinc-500" />
            <span className="uppercase tracking-widest text-[9px] font-black">Category</span>
          </div>
        ),
        cell: ({ row }) => {
          if (!row) return null;
          const tx = row.original;
          const isEditing = editingId === tx.id;
          const cat = isEditing
            ? editForm.category || 'Uncategorized'
            : tx.category || 'Uncategorized';

          if (isEditing) {
            return (
              <div className="relative group min-w-[150px]">
                <select
                  aria-label="Edit category"
                  value={cat}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full pl-4 pr-10 py-2 text-sm neu-inset rounded-xl text-[#FFCC00] font-bold bg-transparent border-none focus:ring-0 appearance-none cursor-pointer"
                >
                  {categories
                    .filter((c) => c !== 'All')
                    .map((c) => (
                      <option key={c} value={c} className="bg-[#12121a] text-zinc-300">
                        {c}
                      </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-[#FFCC00]/50 pointer-events-none" />
              </div>
            );
          }

          const color = getCategoryColor(cat) || getCategoryColor('Uncategorized');
          return (
            <div className="flex items-center gap-2 min-w-[150px]">
              <span
                className={cn(
                  'px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all whitespace-nowrap',
                  color?.badge?.bg || 'bg-red-500/10',
                  color?.badge?.text || 'text-red-500',
                  color?.badge?.border || 'border-red-500/20',
                  color?.badge?.shadow || '',
                  'neu-raised-sm',
                )}
              >
                {cat}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'gstApplicable',
        size: 80,
        minSize: 70,
        header: () => (
          <span className="uppercase tracking-widest text-[9px] font-black text-zinc-500">Tax</span>
        ),
        cell: ({ row }) => {
          if (!row) return null;
          const tx = row.original;
          const isEditing = editingId === tx.id;
          const gst = isEditing ? !!editForm.gstApplicable : !!tx.gstApplicable;

          return (
            <button
              type="button"
              aria-label={gst ? 'GST included' : 'GST not included'}
              title={gst ? 'Click to remove GST' : 'Click to add GST'}
              onClick={() =>
                isEditing ? setEditForm({ ...editForm, gstApplicable: !gst }) : handleEditStart(tx)
              }
              className={cn(
                'px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all btn-press border',
                gst
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] neu-raised-sm'
                  : 'neu-inset text-zinc-600 border-zinc-800/50',
              )}
            >
              {gst ? 'GST' : 'Excl.'}
            </button>
          );
        },
      },
      {
        accessorKey: 'accountId',
        size: 140,
        minSize: 120,
        header: () => (
          <div className="flex items-center gap-2">
            <Wallet className="h-3 w-3 text-zinc-500" />
            <span className="uppercase tracking-widest text-[9px] font-black">Account</span>
          </div>
        ),
        cell: ({ row }) => {
          if (!row) return null;
          const tx = row.original;
          const account = accounts.find((a) => a.id === tx.accountId);

          if (!account) {
            return <span className="text-[10px] font-bold text-zinc-700 italic">Unlinked</span>;
          }

          return (
            <AccountHoverCard account={account} accountId={tx.accountId} accounts={accounts}>
              <div className="flex items-center gap-2 cursor-pointer group/account">
                <div
                  className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center neu-inset transition-all group-hover/account:glow-success',
                    account.accountType === 'credit_card' ? 'text-purple-400' : 'text-[#FFCC00]',
                  )}
                >
                  {account.accountType === 'credit_card' ? (
                    <CreditCard className="h-3 w-3" />
                  ) : account.accountType === 'savings' ? (
                    <PiggyBank className="h-3 w-3" />
                  ) : (
                    <Wallet className="h-3 w-3" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-zinc-400 truncate max-w-[80px] group-hover/account:text-[#FFCC00] transition-colors">
                  {account.accountName}
                </span>
              </div>
            </AccountHoverCard>
          );
        },
      },
      {
        id: 'actions',
        size: 120,
        minSize: 100,
        header: () => (
          <div className="flex justify-end pr-4">
            <span className="uppercase tracking-widest text-[9px] font-black text-zinc-500">
              Actions
            </span>
          </div>
        ),
        cell: ({ row }) => {
          if (!row) return null;
          const tx = row.original;
          const isEditing = editingId === tx.id;

          if (isEditing) {
            return (
              <div className="flex items-center justify-end gap-2 animate-in fade-in slide-in-from-right-2">
                <button
                  type="button"
                  onClick={() => handleSave(tx.id)}
                  title="Save changes"
                  className="p-2 neu-raised-sm text-emerald-400 hover:glow-success rounded-xl btn-press border border-emerald-500/20"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  title="Cancel"
                  className="p-2 neu-raised-sm text-zinc-500 hover:text-red-400 rounded-xl btn-press border border-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
              <button
                type="button"
                onClick={() => handleSplitStart(tx)}
                className="p-2.5 neu-raised-sm text-zinc-500 hover:text-purple-400 hover:border-purple-500/30 rounded-xl btn-press border border-white/5 transition-colors"
                title="Split Transaction"
              >
                <Scissors className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(tx.id)}
                className="p-2.5 neu-raised-sm text-zinc-500 hover:text-red-400 hover:border-red-500/30 rounded-xl btn-press border border-white/5 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [
      editingId,
      editForm,
      categories,
      accounts,
      handleEditStart,
      handleSave,
      handleDelete,
      handleSplitStart,
    ],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredTransactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Approximate row height
    overscan: 10,
  });

  console.log('[Ledger] Render Check:', {
    total: transactions.length,
    filtered: filteredTransactions.length,
    loading,
    tableRows: table.getRowModel().rows.length,
  });

  const handleExport = (format: 'csv' | 'xlsx') => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (selectedCategory !== 'All') params.append('category', selectedCategory);
    if (globalFilter) params.append('search', globalFilter);

    window.open(`http://localhost:3000/api/transactions/export?${params.toString()}`, '_blank');
  };

  const hasActiveFilters = startDate || endDate || selectedCategory !== 'All' || globalFilter;

  // Calculate Summary Stats
  const summaryStats = useMemo(() => {
    const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const avgAmount =
      filteredTransactions.length > 0 ? totalAmount / filteredTransactions.length : 0;

    const SimpleStat = ({ label, value }: { label: string; value: React.ReactNode }) => (
      <div className="flex flex-col bg-[#12121a]/80 border border-white/5 rounded-xl px-4 py-2 min-w-[100px] shrink-0">
        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
          {label}
        </span>
        <span className="text-sm font-bold text-white tracking-tight">{value}</span>
      </div>
    );

    return (
      <>
        <SimpleStat label="Total Vol." value={<CurrencyDisplay amount={totalAmount} />} />
        <SimpleStat label="Tx Count" value={filteredTransactions.length} />
        <SimpleStat label="Avg Value" value={<CurrencyDisplay amount={avgAmount} />} />
      </>
    );
  }, [filteredTransactions]);

  if (loading) {
    return (
      <>
        <div className="md:hidden space-y-4">
          <div className="p-4 bg-[#0a0a0f] border-b border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex gap-3 overflow-hidden">
              <Skeleton className="h-12 w-28 rounded-xl shrink-0" />
              <Skeleton className="h-12 w-28 rounded-xl shrink-0" />
              <Skeleton className="h-12 w-28 rounded-xl shrink-0" />
            </div>
          </div>
          <div className="px-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <TransactionCardSkeleton key={i} />
            ))}
          </div>
        </div>

        <div className="hidden md:block space-y-6 p-1">
          {/* Header Skeleton */}
          <div className="neu-raised rounded-3xl flex flex-col border border-white/10">
            <div className="p-6 border-b border-white/5 bg-white/1 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-[200px] rounded-2xl" />
                  <Skeleton className="h-12 w-32 rounded-2xl" />
                  <div className="flex gap-2">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="bg-black/20 border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-8 space-y-4">
              <div className="flex gap-4 mb-6 px-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center py-4 border-b border-white/5 px-3">
                  <Skeleton className="h-6 w-20 rounded-lg" />
                  <div className="flex items-center gap-3 w-64">
                    <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                    <Skeleton className="h-4 w-40 rounded" />
                  </div>
                  <Skeleton className="h-6 w-24 rounded-lg" />
                  <Skeleton className="h-6 w-32 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-xl" />
                  <Skeleton className="h-6 w-28 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile Layout */}
      <MobileLayout
        title="Ledger"
        subtitle={`${filteredTransactions.length} nodes active`}
        onFilterClick={() => setShowFilters(!showFilters)}
        activeFiltersCount={
          Number(!!startDate) + Number(!!endDate) + Number(selectedCategory !== 'All')
        }
        summaryStats={summaryStats}
      >
        {(showFilters || hasActiveFilters) && (
          <div className="grid grid-cols-1 gap-4 p-4 neu-inset rounded-2xl mb-4 animate-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">
                Search
              </label>
              <input
                type="text"
                placeholder="Search..."
                aria-label="Search transactions"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full px-4 py-3 text-sm neu-inset rounded-xl focus-gold outline-none text-[#FFCC00]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">
                  Start
                </label>
                <input
                  type="date"
                  aria-label="Start date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-3 text-xs neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] bg-transparent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">
                  End
                </label>
                <input
                  type="date"
                  aria-label="End date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-3 text-xs neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] bg-transparent"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">
                Class
              </label>
              <div className="relative">
                <select
                  aria-label="Filter by category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 text-xs neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] bg-transparent appearance-none"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#12121a] text-zinc-300">
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FFCC00]/50 pointer-events-none" />
              </div>
            </div>
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedCategory('All');
                setGlobalFilter('');
                setShowFilters(false);
              }}
              className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-red-400 neu-raised-sm rounded-xl border border-red-500/10"
            >
              Reset
            </button>
          </div>
        )}

        {filteredTransactions.map((tx) => (
          <TransactionCard
            key={tx.id}
            transaction={tx}
            accounts={accounts}
            onEdit={handleEditStart}
            onDelete={handleDelete}
            onSplit={handleSplitStart}
            isEditing={editingId === tx.id}
            editForm={editForm}
            setEditForm={setEditForm}
            onSave={handleSave}
            onCancelEdit={() => setEditingId(null)}
          />
        ))}

        {filteredTransactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Search className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-xs font-bold uppercase tracking-widest">No nodes found</span>
          </div>
        )}
      </MobileLayout>

      {/* Desktop Table View */}
      <div className="space-y-6 p-1 hidden md:block">
        <div className="neu-raised-sm lg:neu-raised rounded-3xl flex flex-col border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_10px_30px_-5px_rgba(0,0,0,0.5)]">
          {/* Header Control Panel */}
          <div className="p-4 lg:p-6 border-b border-white/5 bg-white/1 space-y-4 lg:space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="absolute -inset-1 cba-gold-gradient rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative cba-gold-gradient p-3 rounded-xl">
                    <Activity className="h-6 w-6 text-[#0a0a0f]" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg lg:text-xl font-black text-gradient-gold uppercase tracking-tight">
                    Ledger Matrix
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-nowrap">
                      {filteredTransactions.length} nodes active
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-[#FFCC00]" />
                  <input
                    type="text"
                    aria-label="Global Search"
                    placeholder="Search nodes..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="pl-11 pr-4 py-3 text-sm neu-inset rounded-2xl w-full focus-gold outline-none text-[#FFCC00] placeholder-zinc-700 font-medium"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    'px-5 py-3 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all btn-press border border-white/5',
                    showFilters || hasActiveFilters
                      ? 'cba-gold-gradient text-[#0a0a0f] cba-gold-glow'
                      : 'neu-raised-sm text-zinc-500 hover:text-[#FFCC00]',
                  )}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                  {hasActiveFilters && (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="p-3 neu-raised-sm rounded-2xl text-zinc-500 hover:text-blue-400 btn-press border border-white/5"
                    title="Export CSV"
                  >
                    <FileText className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('xlsx')}
                    className="p-3 neu-raised-sm rounded-2xl text-zinc-500 hover:text-emerald-400 btn-press border border-white/5"
                    title="Export Excel"
                  >
                    <FileSpreadsheet className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Expandable Filters Matrix */}
          {(showFilters || hasActiveFilters) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 neu-inset rounded-3xl animate-in zoom-in-95 duration-300">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em] flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Origin Date
                </label>
                <input
                  type="date"
                  aria-label="Filter by Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] bg-transparent"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em] flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Termination Date
                </label>
                <input
                  type="date"
                  aria-label="Filter by End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full py-3 px-4 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] bg-transparent"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em] flex items-center gap-2">
                  <Tag className="h-3 w-3" /> Class Matrix
                </label>
                <div className="relative">
                  <select
                    aria-label="Filter by Category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full py-3 pl-4 pr-10 text-xs font-bold neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] bg-transparent appearance-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#12121a] text-zinc-300">
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FFCC00]/50 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedCategory('All');
                    setGlobalFilter('');
                  }}
                  className="w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 neu-raised-sm hover:glow-danger rounded-xl btn-press border border-red-500/10"
                >
                  Reset Matrix
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Neumorphic Table View - Scrollable Container */}
        <div className="flex-1 bg-black/20 border-t border-white/5 relative group/table">
          {/* Horizontal Scroll Indicators */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-black/20 to-transparent pointer-events-none z-10 opacity-0 group-hover/table:opacity-100 transition-opacity md:hidden" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-black/20 to-transparent pointer-events-none z-10 opacity-0 group-hover/table:opacity-100 transition-opacity md:hidden" />

          <div
            ref={parentRef}
            className="overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent max-h-[70vh]"
          >
            <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 min-w-max">
              <table
                className="transaction-table w-full border-separate border-spacing-y-2 lg:border-spacing-y-3"
                aria-label="Financial Transactions Ledger"
              >
                <caption className="sr-only">
                  List of financial transactions with details including date, description, amount,
                  and category.
                </caption>
                <thead className="sticky top-0 z-20 bg-[#12121a]">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="text-zinc-600">
                      {hg.headers.map((h) => {
                        const isSorted = h.column.getIsSorted();
                        const ariaSortValue: 'ascending' | 'descending' | 'none' | undefined =
                          !h.column.getCanSort()
                            ? undefined
                            : isSorted === 'asc'
                              ? 'ascending'
                              : isSorted === 'desc'
                                ? 'descending'
                                : 'none';

                        return (
                          <DynamicTh
                            key={h.id}
                            scope="col"
                            aria-sort={ariaSortValue}
                            className={cn(
                              'px-3 lg:px-6 pb-2 text-left whitespace-nowrap dynamic-column-width',
                              h.id === 'gstApplicable' && 'hidden md:table-cell',
                            )}
                            width={h.column.getSize() !== 150 ? h.column.getSize() : undefined}
                          >
                            {h.isPlaceholder
                              ? null
                              : flexRender(h.column.columnDef.header, h.getContext())}
                          </DynamicTh>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="py-32 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="w-20 h-20 neu-inset rounded-3xl flex items-center justify-center">
                            <Search className="h-10 w-10 text-zinc-800" />
                          </div>
                          <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">
                            No matching nodes in current view
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {rowVirtualizer.getVirtualItems().length > 0 && (
                        <DynamicHeightRow height={rowVirtualizer.getVirtualItems()[0]?.start || 0}>
                          <td colSpan={columns.length} />
                        </DynamicHeightRow>
                      )}
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        if (!row) return null;
                        return (
                          <tr
                            key={row.id}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            className="group transition-all duration-300"
                          >
                            {row.getVisibleCells().map((cell) => {
                              return (
                                <td
                                  key={cell.id}
                                  className={cn(
                                    'px-3 lg:px-6 py-3 lg:py-5 bg-[#12121a] first:rounded-l-xl last:rounded-r-xl border-y border-white/5 first:border-l last:border-r transition-shadow duration-300 group-hover:bg-[#16161f] group-hover:border-white/10 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]',
                                    editingId === row.original.id &&
                                      'bg-[#16161f] border-[#FFCC00]/20',
                                    cell.column.id === 'gstApplicable' && 'hidden md:table-cell',
                                  )}
                                >
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      {rowVirtualizer.getVirtualItems().length > 0 && (
                        <DynamicHeightRow
                          height={
                            rowVirtualizer.getTotalSize() -
                            (rowVirtualizer.getVirtualItems()[
                              rowVirtualizer.getVirtualItems().length - 1
                            ]?.end || 0)
                          }
                        >
                          <td colSpan={columns.length} />
                        </DynamicHeightRow>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sticky Footer Info */}
        <div className="px-8 py-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                Total Nodes
              </span>
              <span className="text-xs font-bold text-zinc-400 tracking-tight">
                {transactions.length}
              </span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                Current View
              </span>
              <span className="text-xs font-bold text-[#FFCC00] tracking-tight">
                {filteredTransactions.length}
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
                  key={i}
                  className={`w-1 h-1 rounded-full bg-[#FFCC00]/30 animate-pulse pulse-delay-${i}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Split Modal */}
      {splittingTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-100 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[160px]" />
          </div>

          <div className="neu-raised rounded-[2.5rem] w-full max-w-2xl overflow-hidden relative border border-white/5 shadow-2xl">
            {/* Modal Header */}
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/1">
              <div className="flex items-center gap-4">
                <div className="p-3 neu-inset rounded-2xl text-purple-400">
                  <Scissors className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gradient-gold tracking-tight uppercase">
                    Node Fission
                  </h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">
                    Splitting: {splittingTx.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSplittingTx(null)}
                className="neu-raised-sm p-3 rounded-2xl text-zinc-500 hover:text-red-400 btn-press"
                aria-label="Close modal"
                title="Close modal"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6 max-h-[55vh] overflow-y-auto scrollbar-thin">
              {splits.map((split, idx) => (
                <div
                  key={idx}
                  className="neu-raised-sm p-6 rounded-3xl space-y-5 relative group border border-white/5 hover:border-purple-500/20 transition-all"
                >
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 neu-inset rounded-full flex items-center justify-center text-[10px] font-black text-[#FFCC00]">
                        {idx + 1}
                      </span>
                      <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                        Fragment Node
                      </span>
                    </div>
                    {splits.length > 2 && (
                      <button
                        onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                        className="text-red-400/50 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-xl transition-all btn-press"
                        aria-label="Remove split"
                        title="Remove split"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">
                        Classification
                      </label>
                      <div className="relative">
                        <select
                          aria-label="Split category"
                          value={split.category}
                          onChange={(e) => {
                            const newSplits = [...splits];
                            if (newSplits[idx]) {
                              newSplits[idx].category = e.target.value;
                              setSplits(newSplits);
                            }
                          }}
                          className="w-full p-4 text-sm neu-inset rounded-2xl text-[#FFCC00] font-bold bg-transparent border-none focus:ring-0 appearance-none"
                        >
                          {categories
                            .filter((c) => c !== 'All')
                            .map((c) => (
                              <option key={c} value={c} className="bg-[#12121a] text-zinc-300">
                                {c}
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FFCC00]/50 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">
                        Quantum Value ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-xs">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          aria-label="Split amount"
                          value={split.amount / 100}
                          onChange={(e) => {
                            const newSplits = [...splits];
                            if (newSplits[idx]) {
                              newSplits[idx].amount = Math.round(parseFloat(e.target.value) * 100);
                              setSplits(newSplits);
                            }
                          }}
                          className="w-full pl-8 pr-4 py-4 text-sm neu-inset rounded-2xl text-[#FFCC00] font-bold focus-gold outline-none"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">
                        Data Label
                      </label>
                      <input
                        type="text"
                        aria-label="Split description"
                        value={split.description}
                        onChange={(e) => {
                          const newSplits = [...splits];
                          if (newSplits[idx]) {
                            newSplits[idx].description = e.target.value;
                            setSplits(newSplits);
                          }
                        }}
                        className="w-full p-4 text-sm neu-inset rounded-2xl text-[#FFCC00] font-bold focus-gold outline-none"
                        placeholder="Enter new label..."
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() =>
                  setSplits([
                    ...splits,
                    {
                      category: 'Uncategorized',
                      amount: 0,
                      description: splittingTx.description,
                      gst: splittingTx.gstApplicable,
                    },
                  ])
                }
                className="w-full py-6 border-2 border-dashed border-zinc-800 rounded-4xl text-zinc-600 hover:text-[#FFCC00] hover:border-[#FFCC00]/30 hover:bg-[#FFCC00]/5 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-xs"
              >
                <Plus className="h-5 w-5" /> Expand Fission
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t border-white/5 bg-white/1 flex flex-col sm:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                    Original Mass
                  </span>
                  <span className="text-sm font-bold text-zinc-400">
                    ${splittingTx.amount / 100}
                  </span>
                </div>
                <div className="w-px h-8 bg-white/5" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                    Residual
                  </span>
                  <span className="text-sm font-black tracking-tight text-red-400">
                    ${(splittingTx.amount - splits.reduce((sum, s) => sum + s.amount, 0)) / 100}
                  </span>
                </div>
              </div>
              <div className="flex gap-4 w-full sm:w-auto">
                <button
                  onClick={() => setSplittingTx(null)}
                  className="flex-1 sm:flex-none px-8 py-4 rounded-2xl text-zinc-500 font-bold text-xs uppercase tracking-widest neu-raised-sm btn-press"
                >
                  Abort
                </button>
                <button
                  onClick={handleSplitSave}
                  disabled={splits.reduce((sum, s) => sum + s.amount, 0) !== splittingTx.amount}
                  className="flex-1 sm:flex-none px-10 py-4 rounded-2xl cba-gold-gradient text-[#0a0a0f] font-black text-xs uppercase tracking-[0.2em] cba-gold-glow btn-press disabled:opacity-30 disabled:grayscale"
                >
                  Execute Split
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
