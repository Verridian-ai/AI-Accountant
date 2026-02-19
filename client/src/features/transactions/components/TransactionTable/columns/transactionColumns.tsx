import type { ColumnDef } from '@tanstack/react-table';
import type { Transaction, Account } from '@/api';
import {
  ArrowUpDown,
  FileText,
  Activity,
  Wallet,
  Scissors,
  Trash2,
  History,
  Calendar,
  PiggyBank,
  CreditCard,
  Tag,
  DollarSign,
  ChevronDown,
  X,
  Edit2,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryColor } from '@/utils/categoryColors';
import { AccountHoverCard } from '@/features/accounts/components/AccountHoverCard';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';

export interface TransactionColumnsParams {
  editingId: string | null;
  editForm: Partial<Transaction>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<Transaction>>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  categories: string[];
  accounts: Account[];
  handleEditStart: (tx: Transaction) => void;
  handleSave: (id: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleSplitStart: (tx: Transaction) => void;
}

export function createTransactionColumns({
  editingId,
  editForm,
  setEditForm,
  setEditingId,
  categories,
  accounts,
  handleEditStart,
  handleSave,
  handleDelete,
  handleSplitStart,
}: TransactionColumnsParams): ColumnDef<Transaction>[] {
  return [
    {
      accessorKey: 'date',
      size: 100,
      minSize: 90,
      header: ({ column }) => (
        <button
          type="button"
          title="Sort by date"
          className="flex items-center gap-2 hover:text-cba-gold transition-colors group/head"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <Calendar className="h-3 w-3 text-muted group-hover/head:text-cba-gold" />
          <span className="uppercase tracking-widest text-[9px] font-black">Date</span>
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        </button>
      ),
      cell: ({ row }) => {
        if (!row) return null;
        return (
          <div className="flex flex-col">
            <span className="font-mono text-[10px] font-black text-muted tracking-wider neu-inset px-2.5 py-1 rounded-lg border border-border/50 w-fit whitespace-nowrap">
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
          <FileText className="h-3 w-3 text-muted" />
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
                className="w-full px-4 py-2 text-sm neu-inset rounded-xl focus-gold outline-none text-cba-gold font-bold"
              />
              <Edit2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-cba-gold/50" />
            </div>
          );
        }

        return (
          <div
            role="button"
            tabIndex={0}
            className="flex items-center gap-3 group cursor-pointer min-w-[200px]"
            onClick={() => handleEditStart(tx)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEditStart(tx); } }}
          >
            <div className="w-8 h-8 neu-inset rounded-lg flex items-center justify-center shrink-0 group-hover:neu-raised transition-all">
              <Activity className="h-3.5 w-3.5 text-zinc-600 group-hover:text-cba-gold transition-colors" />
            </div>
            <div
              className="max-w-[140px] sm:max-w-[220px] lg:max-w-[280px] truncate text-zinc-100 font-bold tracking-tight text-sm group-hover:text-cba-gold transition-colors"
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
              className="opacity-0 group-hover:opacity-100 p-1.5 neu-raised-sm rounded-lg text-cba-gold transition-all transform scale-90 group-hover:scale-100 border border-border/50"
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
          <DollarSign className="h-3 w-3 text-muted" />
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">
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
                className="w-28 pl-6 pr-3 py-2 text-sm neu-inset rounded-xl focus-gold outline-none text-cba-gold font-bold"
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
          <Tag className="h-3 w-3 text-muted" />
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
                className="w-full pl-4 pr-10 py-2 text-sm neu-inset rounded-xl text-cba-gold font-bold bg-transparent border-none focus:ring-0 appearance-none cursor-pointer"
              >
                {categories
                  .filter((c) => c !== 'All')
                  .map((c) => (
                    <option key={c} value={c} className="bg-surface text-primary">
                      {c}
                    </option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-cba-gold/50 pointer-events-none" />
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
        <span className="uppercase tracking-widest text-[9px] font-black text-muted">Tax</span>
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
          <Wallet className="h-3 w-3 text-muted" />
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
                  account.accountType === 'credit_card' ? 'text-purple-400' : 'text-cba-gold',
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
              <span className="text-[10px] font-bold text-secondary truncate max-w-[80px] group-hover/account:text-cba-gold transition-colors">
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
          <span className="uppercase tracking-widest text-[9px] font-black text-muted">
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
                className="p-2 neu-raised-sm text-muted hover:text-red-400 rounded-xl btn-press border border-border/50"
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
              className="p-2.5 neu-raised-sm text-muted hover:text-purple-400 hover:border-purple-500/30 rounded-xl btn-press border border-border/50 transition-colors"
              title="Split Transaction"
            >
              <Scissors className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(tx.id)}
              className="p-2.5 neu-raised-sm text-muted hover:text-red-400 hover:border-red-500/30 rounded-xl btn-press border border-border/50 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];
}
