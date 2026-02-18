import type { ColumnDef } from '@tanstack/react-table';
import type { Transaction } from '../../types/ledger';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { AccountHoverCard } from '@/features/accounts/components/AccountHoverCard';
import { getCategoryColor } from '../../constants/categoryColors';
import { getTaxCodeForCategory } from '../../constants/categories';
import { CategorySelect } from '../CategorySelect';
import { cn } from '@/lib/utils';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  FileText,
  DollarSign,
  Tag,
  Wallet,
  Activity,
  Edit2,
  Save,
  X,
  Scissors,
  Trash2,
  History,
  CreditCard,
  PiggyBank,
  ArrowLeftRight,
  AlertTriangle,
} from 'lucide-react';
import type { CreateColumnsParams } from './types';

export function createLedgerColumns({
  editStateRef,
  accounts,
  categories: _categories,
  setEditForm,
  handleEditStart,
  handleSave,
  handleDelete,
  handleSplitStart,
  setEditingId,
  bulkSelectRef,
  onSelectAll,
}: CreateColumnsParams): ColumnDef<Transaction>[] {
  const columns: ColumnDef<Transaction>[] = [];

  // Checkbox Column (only when bulk select is enabled)
  if (bulkSelectRef) {
    columns.push({
      id: 'select',
      size: 40,
      minSize: 40,
      header: () => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onSelectAll}
            className="w-5 h-5 neu-inset rounded-md flex items-center justify-center text-zinc-500 hover:text-[#FFCC00] transition-colors"
            aria-label="Select all"
            title="Select all"
          >
            <span className="text-[10px] font-black">All</span>
          </button>
        </div>
      ),
      cell: ({ row }) => {
        if (!row) return null;
        const tx = row.original;
        const selected = bulkSelectRef.current?.isSelected(tx.id) ?? false;
        return (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                bulkSelectRef.current?.toggle(tx.id);
              }}
              className={cn(
                'w-5 h-5 rounded-md border transition-all flex items-center justify-center',
                selected
                  ? 'bg-[#FFCC00]/20 border-[#FFCC00]/50 text-[#FFCC00]'
                  : 'neu-inset border-white/5 text-transparent hover:border-white/20',
              )}
              aria-label={selected ? 'Deselect' : 'Select'}
            >
              {selected && <span className="text-xs font-black">✓</span>}
            </button>
          </div>
        );
      },
    });
  }

  columns.push(
    // Date Column
    {
      accessorKey: 'date',
      size: 100,
      minSize: 90,
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            title="Sort by date"
            className="flex items-center gap-2 hover:text-[#FFCC00] transition-colors group/head"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <Calendar className="h-3 w-3 text-zinc-500 group-hover/head:text-[#FFCC00]" />
            <span className="uppercase tracking-widest text-xs font-black">Date</span>
            {sorted === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-[#FFCC00]" />
            ) : sorted === 'desc' ? (
              <ArrowDown className="h-3 w-3 text-[#FFCC00]" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        if (!row) return null;
        const dateStr = row.original.date;
        let formatted = dateStr;
        try {
          const d = new Date(dateStr + 'T00:00:00');
          formatted = d.toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        } catch {
          /* keep original */
        }
        return (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-black text-zinc-500 tracking-wider neu-inset px-2.5 py-1 rounded-lg border border-white/5 w-fit whitespace-nowrap">
              {formatted}
            </span>
          </div>
        );
      },
    },

    // Description Column
    {
      accessorKey: 'description',
      size: 280,
      minSize: 200,
      header: () => (
        <div className="flex items-center gap-2">
          <FileText className="h-3 w-3 text-zinc-500" />
          <span className="uppercase tracking-widest text-xs font-black">Description</span>
        </div>
      ),
      cell: ({ row }) => {
        if (!row) return null;
        const tx = row.original;
        const { editingId, editForm } = editStateRef.current;
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
              className="max-w-[200px] sm:max-w-[300px] lg:max-w-[400px] xl:max-w-[500px] truncate text-zinc-100 font-bold tracking-tight text-sm group-hover:text-[#FFCC00] transition-colors"
              title={tx.description}
            >
              {tx.description}
            </div>
            {tx.isTransfer && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 text-xs font-black uppercase tracking-[0.15em] border border-zinc-500/20 whitespace-nowrap">
                <ArrowLeftRight className="h-2.5 w-2.5" /> Transfer
              </span>
            )}
            {tx.isEdited && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-black uppercase tracking-[0.15em] border border-amber-500/20 whitespace-nowrap">
                <History className="h-2.5 w-2.5" /> Modified
              </span>
            )}
            <button
              type="button"
              aria-label="Quick edit"
              title="Quick edit"
              className="opacity-60 group-hover:opacity-100 focus-within:opacity-100 p-1.5 neu-raised-sm rounded-lg text-[#FFCC00] transition-all transform scale-90 group-hover:scale-100 border border-white/5"
            >
              <Edit2 className="h-3 w-3" />
            </button>
          </div>
        );
      },
    },

    // Amount Column
    {
      accessorKey: 'amount',
      size: 130,
      minSize: 110,
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            title="Sort by amount"
            className="flex items-center gap-2 hover:text-[#FFCC00] transition-colors group/head"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <DollarSign className="h-3 w-3 text-zinc-500 group-hover/head:text-[#FFCC00]" />
            <span className="uppercase tracking-widest text-xs font-black">Amount</span>
            {sorted === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-[#FFCC00]" />
            ) : sorted === 'desc' ? (
              <ArrowDown className="h-3 w-3 text-[#FFCC00]" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        if (!row) return null;
        const tx = row.original;
        const { editingId, editForm } = editStateRef.current;
        const isEditing = editingId === tx.id;
        const amount = (isEditing ? editForm.amount || 0 : tx.amount) / 100;

        if (isEditing) {
          return (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-500">
                $
              </span>
              <input
                type="number"
                step="0.01"
                aria-label="Edit amount"
                value={amount}
                onChange={(e) =>
                  setEditForm({ ...editForm, amount: Math.round(parseFloat(e.target.value) * 100) })
                }
                className="w-28 pl-6 pr-3 py-2 text-sm neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] font-bold"
              />
            </div>
          );
        }

        return <CurrencyDisplay amount={isEditing ? editForm.amount || 0 : tx.amount} />;
      },
    },

    // Balance Column
    {
      accessorKey: 'balance',
      size: 120,
      minSize: 100,
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            title="Sort by balance"
            className="flex items-center gap-2 hover:text-[#FFCC00] transition-colors group/head"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <Wallet className="h-3 w-3 text-zinc-500 group-hover/head:text-[#FFCC00]" />
            <span className="uppercase tracking-widest text-xs font-black">Balance</span>
            {sorted === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-[#FFCC00]" />
            ) : sorted === 'desc' ? (
              <ArrowDown className="h-3 w-3 text-[#FFCC00]" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        if (!row) return null;
        const balance = row.original.balance;
        if (balance == null) {
          return <span className="text-xs font-bold text-zinc-700">--</span>;
        }
        return <CurrencyDisplay amount={balance} />;
      },
    },

    // Category Column
    {
      accessorKey: 'category',
      size: 180,
      minSize: 150,
      header: () => (
        <div className="flex items-center gap-2">
          <Tag className="h-3 w-3 text-zinc-500" />
          <span className="uppercase tracking-widest text-xs font-black">Category</span>
        </div>
      ),
      cell: ({ row }) => {
        if (!row) return null;
        const tx = row.original;
        const { editingId, editForm } = editStateRef.current;
        const isEditing = editingId === tx.id;
        const cat = isEditing
          ? editForm.category || 'Uncategorized'
          : tx.category || 'Uncategorized';

        if (isEditing) {
          return (
            <div className="min-w-[150px]">
              <CategorySelect
                value={cat}
                onChange={(value) => {
                  const taxCode = getTaxCodeForCategory(value);
                  setEditForm({ ...editForm, category: value, gstApplicable: taxCode === 'GST' });
                }}
                aria-label="Edit category"
                size="sm"
              />
            </div>
          );
        }

        const color = getCategoryColor(cat) || getCategoryColor('Uncategorized');
        const confidence = tx.confidenceScore;
        return (
          <div className="flex items-center gap-2 min-w-[150px]">
            <span
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all whitespace-nowrap',
                color?.badge?.bg || 'bg-red-500/15',
                color?.badge?.text || 'text-red-400',
                color?.badge?.border || 'border-red-500/25',
                color?.badge?.shadow || '',
                'neu-raised-sm',
              )}
            >
              {cat}
            </span>
            {confidence != null && confidence < 0.8 && (
              <span
                className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500/60"
                title={`AI confidence: ${Math.round(confidence * 100)}%`}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {Math.round(confidence * 100)}%
              </span>
            )}
          </div>
        );
      },
    },

    // GST/Tax Column
    {
      accessorKey: 'gstApplicable',
      header: () => (
        <span className="uppercase tracking-widest text-xs font-black text-zinc-500">Tax</span>
      ),
      cell: ({ row }) => {
        if (!row) return null;
        const tx = row.original;
        const { editingId, editForm } = editStateRef.current;
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
              'px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all btn-press border',
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

    // Account Column
    {
      accessorKey: 'accountId',
      size: 140,
      minSize: 120,
      header: () => (
        <div className="flex items-center gap-2">
          <Wallet className="h-3 w-3 text-zinc-500" />
          <span className="uppercase tracking-widest text-xs font-black">Account</span>
        </div>
      ),
      cell: ({ row }) => {
        if (!row) return null;
        const tx = row.original;
        const account = accounts.find((a) => a.id === tx.accountId);

        if (!account) {
          return <span className="text-xs font-bold text-zinc-700 italic">Unlinked</span>;
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
              <span className="text-xs font-bold text-zinc-400 truncate max-w-[80px] group-hover/account:text-[#FFCC00] transition-colors">
                {account.accountName}
              </span>
            </div>
          </AccountHoverCard>
        );
      },
    },

    // Actions Column
    {
      id: 'actions',
      header: () => (
        <div className="flex justify-end pr-4">
          <span className="uppercase tracking-widest text-xs font-black text-zinc-500">
            Actions
          </span>
        </div>
      ),
      cell: ({ row }) => {
        if (!row) return null;
        const tx = row.original;
        const { editingId } = editStateRef.current;
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
          <div className="flex items-center justify-end gap-3 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
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
  );

  return columns;
}

// Re-export types for consumers that import from this module
export type { EditStateRef, BulkSelectRef, CreateColumnsParams } from './types';
