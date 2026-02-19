import { useState } from 'react';
import type { Transaction } from '../../../api';
import { CurrencyDisplay } from '../../../components/common/CurrencyDisplay';
import { CategorySelect } from './CategorySelect';
import { getCategoryColor } from '../constants/categoryColors';
import { getTaxCodeForCategory } from '../constants/categories';
import { cn } from '../../../lib/utils';
import {
  Activity,
  Edit2,
  Trash2,
  Scissors,
  ChevronDown,
  ChevronUp,
  Tag,
  Wallet,
  Calendar,
  Save,
  X,
  ArrowLeftRight,
} from 'lucide-react';
import type { Account } from '../../../api';
import { Skeleton } from '../../../components/ui/skeleton';

const EMPTY_ACCOUNTS: Account[] = [];

interface TransactionCardProps {
  transaction: Transaction;
  accounts?: Account[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onSplit: (tx: Transaction) => void;
  isEditing?: boolean;
  editForm?: Partial<Transaction>;
  setEditForm?: (form: Partial<Transaction>) => void;
  onSave?: (id: string) => void;
  onCancelEdit?: () => void;
}

export function TransactionCard({
  transaction,
  accounts = EMPTY_ACCOUNTS,
  onEdit,
  onDelete,
  onSplit,
  isEditing,
  editForm,
  setEditForm,
  onSave,
  onCancelEdit,
}: TransactionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const account = accounts.find((a) => a.id === transaction.accountId);

  if (isEditing && editForm && setEditForm && onSave && onCancelEdit) {
    return (
      <div className="neu-raised-sm rounded-2xl p-4 mb-4 border border-cba-gold/20 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="trans-f1" className="text-[10px] font-black uppercase tracking-widest text-muted">
              Description
            </label>
            <input id="trans-f1"
              type="text"
              value={editForm.description || ''}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-4 py-3 text-sm neu-inset rounded-xl focus-gold outline-none text-cba-gold font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="trans-f2" className="text-[10px] font-black uppercase tracking-widest text-muted">
                Amount
              </label>
              <input id="trans-f2"
                type="number"
                step="0.01"
                value={(editForm.amount || 0) / 100}
                onChange={(e) =>
                  setEditForm({ ...editForm, amount: Math.round(parseFloat(e.target.value) * 100) })
                }
                className="w-full px-4 py-3 text-sm neu-inset rounded-xl focus-gold outline-none text-cba-gold font-bold"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="trans-f3" className="text-[10px] font-black uppercase tracking-widest text-muted">
                Tax
              </label>
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, gstApplicable: !editForm.gstApplicable })}
                className={cn(
                  'w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border',
                  editForm.gstApplicable
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'neu-inset text-zinc-600 border-zinc-800/50',
                )}
              >
                {editForm.gstApplicable ? 'GST Incl.' : 'No Tax'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="trans-f4" className="text-xs font-black uppercase tracking-widest text-muted">
              Category
            </label>
            <CategorySelect
              value={editForm.category || 'Uncategorized'}
              onChange={(value) => {
                const taxCode = getTaxCodeForCategory(value);
                setEditForm({ ...editForm, category: value, gstApplicable: taxCode === 'GST' });
              }}
              aria-label="Edit category"
              size="md"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onSave(transaction.id)}
              className="flex-1 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <button
              onClick={onCancelEdit}
              className="flex-1 py-3 neu-raised-sm text-muted border border-border/50 rounded-xl font-black uppercase text-xs tracking-widest hover:text-red-400 transition-colors flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="neu-raised-sm rounded-2xl p-4 mb-4 border border-border/50 relative overflow-hidden group active:scale-[0.99] transition-transform duration-200">
      {/* Main Row */}
      <button
        type="button"
        className="w-full flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 overflow-hidden text-left">
          <div className="w-10 h-10 neu-inset rounded-xl flex items-center justify-center shrink-0 text-cba-gold">
            <Activity className="h-5 w-5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-zinc-100 truncate text-sm">
              {transaction.description}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-muted font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />{' '}
                {(() => {
                  try {
                    return new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                  } catch {
                    return transaction.date;
                  }
                })()}
              </span>
              {transaction.isTransfer && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-secondary">
                    <ArrowLeftRight className="h-2.5 w-2.5" /> Transfer
                  </span>
                </>
              )}
              {transaction.category &&
                (() => {
                  const catColor = getCategoryColor(transaction.category);
                  return (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className={cn('w-1.5 h-1.5 rounded-full', catColor.dot)} />
                        <span className={catColor.text}>{transaction.category}</span>
                      </span>
                    </>
                  );
                })()}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <CurrencyDisplay amount={transaction.amount} className="text-base" />
          <div className="p-1 text-zinc-600">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Account
              </span>
              <span className="text-xs font-bold text-primary">
                {account ? account.accountName : 'Unlinked'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tax
              </span>
              <span
                className={cn(
                  'text-xs font-bold',
                  transaction.gstApplicable ? 'text-emerald-400' : 'text-muted',
                )}
              >
                {transaction.gstApplicable ? 'GST Included' : 'No Tax'}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(transaction);
              }}
              className="flex-1 py-3 neu-raised-sm rounded-xl text-secondary hover:text-cba-gold border border-border/50 transition-colors flex flex-col items-center gap-1"
            >
              <Edit2 className="h-4 w-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Edit</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSplit(transaction);
              }}
              className="flex-1 py-3 neu-raised-sm rounded-xl text-secondary hover:text-purple-400 border border-border/50 transition-colors flex flex-col items-center gap-1"
            >
              <Scissors className="h-4 w-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Split</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(transaction.id);
              }}
              className="flex-1 py-3 neu-raised-sm rounded-xl text-secondary hover:text-red-400 border border-border/50 transition-colors flex flex-col items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TransactionCardSkeleton() {
  return (
    <div className="neu-raised-sm rounded-2xl p-4 mb-4 border border-border/50">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="space-y-2 w-full">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      </div>
    </div>
  );
}
