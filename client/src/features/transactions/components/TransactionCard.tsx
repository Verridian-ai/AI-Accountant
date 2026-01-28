import { useState } from 'react';
import type { Transaction } from '@/api';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { CategorySelect } from './CategorySelect';
import { cn } from '@/lib/utils';
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
    X
} from 'lucide-react';
import type { Account } from '@/api';
import { Skeleton } from '@/components/ui/skeleton';

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
    accounts = [],
    onEdit,
    onDelete,
    onSplit,
    isEditing,
    editForm,
    setEditForm,
    onSave,
    onCancelEdit
}: TransactionCardProps) {
    const [expanded, setExpanded] = useState(false);

    const account = accounts.find(a => a.id === transaction.accountId);

    if (isEditing && editForm && setEditForm && onSave && onCancelEdit) {
        return (
            <div className="neu-raised-sm rounded-2xl p-4 mb-4 border border-[#FFCC00]/20 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Description</label>
                        <input
                            type="text"
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-4 py-3 text-sm neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] font-bold"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                value={(editForm.amount || 0) / 100}
                                onChange={(e) => setEditForm({ ...editForm, amount: Math.round(parseFloat(e.target.value) * 100) })}
                                className="w-full px-4 py-3 text-sm neu-inset rounded-xl focus-gold outline-none text-[#FFCC00] font-bold"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tax</label>
                            <button
                                type="button"
                                onClick={() => setEditForm({ ...editForm, gstApplicable: !editForm.gstApplicable })}
                                className={cn(
                                    "w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border",
                                    editForm.gstApplicable
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : "neu-inset text-zinc-600 border-zinc-800/50"
                                )}
                            >
                                {editForm.gstApplicable ? 'GST Incl.' : 'No Tax'}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Category</label>
                        <CategorySelect
                            value={editForm.category || 'Uncategorized'}
                            onChange={(value) => setEditForm({ ...editForm, category: value })}
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
                            className="flex-1 py-3 neu-raised-sm text-zinc-500 border border-white/5 rounded-xl font-black uppercase text-xs tracking-widest hover:text-red-400 transition-colors flex items-center justify-center gap-2"
                        >
                            <X className="h-4 w-4" /> Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="neu-raised-sm rounded-2xl p-4 mb-4 border border-white/5 relative overflow-hidden group active:scale-[0.99] transition-transform duration-200">
            {/* Main Row */}
            <div className="flex items-center justify-between gap-4" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 neu-inset rounded-xl flex items-center justify-center shrink-0 text-[#FFCC00]">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="font-bold text-zinc-100 truncate text-sm">{transaction.description}</span>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {transaction.date}</span>
                            {transaction.category && (
                                <>
                                    <span>•</span>
                                    <span className="text-[#FFCC00]">{transaction.category}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                    <CurrencyDisplay amount={transaction.amount} className="text-base" />
                    <button className="p-1 text-zinc-600">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 flex items-center gap-1">
                                <Wallet className="h-3 w-3" /> Account
                            </span>
                            <span className="text-xs font-bold text-zinc-300">
                                {account ? account.accountName : 'Unlinked'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 flex items-center gap-1">
                                <Tag className="h-3 w-3" /> Tax
                            </span>
                            <span className={cn(
                                "text-xs font-bold",
                                transaction.gstApplicable ? "text-emerald-400" : "text-zinc-500"
                            )}>
                                {transaction.gstApplicable ? 'GST Included' : 'No Tax'}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(transaction); }}
                            className="flex-1 py-3 neu-raised-sm rounded-xl text-zinc-400 hover:text-[#FFCC00] border border-white/5 transition-colors flex flex-col items-center gap-1"
                        >
                            <Edit2 className="h-4 w-4" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Edit</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onSplit(transaction); }}
                            className="flex-1 py-3 neu-raised-sm rounded-xl text-zinc-400 hover:text-purple-400 border border-white/5 transition-colors flex flex-col items-center gap-1"
                        >
                            <Scissors className="h-4 w-4" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Split</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(transaction.id); }}
                            className="flex-1 py-3 neu-raised-sm rounded-xl text-zinc-400 hover:text-red-400 border border-white/5 transition-colors flex flex-col items-center gap-1"
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
        <div className="neu-raised-sm rounded-2xl p-4 mb-4 border border-white/5">
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