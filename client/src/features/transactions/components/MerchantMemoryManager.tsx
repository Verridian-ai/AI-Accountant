import { useState, useEffect, useCallback } from 'react';
import { api, type MerchantMemory } from '@/api';
import { Brain, Trash2, Edit2, Check, X, Loader2, Search, Sparkles, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface MerchantMemoryManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

const CATEGORIES = [
    'Advertising & Marketing', 'Bank Fees', 'Business Insurance', 'Car & Transport',
    'Clothing & Apparel', 'Computer & IT', 'Consulting & Professional Services',
    'Donations & Charity', 'Education & Training', 'Entertainment', 'Equipment & Tools',
    'Food & Dining', 'Gifts', 'Groceries', 'Health & Medical', 'Home Office',
    'Income', 'Insurance', 'Interest & Fees', 'Legal & Accounting', 'Loan Repayment',
    'Memberships & Subscriptions', 'Office Supplies', 'Personal Care', 'Rent & Utilities',
    'Repairs & Maintenance', 'Salary & Wages', 'Shopping', 'Software & Apps',
    'Superannuation', 'Tax', 'Telecommunications', 'Transfer', 'Travel', 'Uncategorized', 'Utilities'
];

export function MerchantMemoryManager({ isOpen, onClose }: MerchantMemoryManagerProps) {
    const [memory, setMemory] = useState<MerchantMemory[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editCategory, setEditCategory] = useState('');
    const [editGst, setEditGst] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchMemory = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.fetchMerchantMemory();
            setMemory(data);
        } catch (err) {
            console.error('Failed to fetch merchant memory:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            void fetchMemory();
        }
    }, [isOpen, fetchMemory]);

    const handleEdit = (item: MerchantMemory) => {
        setEditingId(item.id);
        setEditCategory(item.category);
        setEditGst(item.gstApplicable);
    };

    const handleSave = async (id: string) => {
        setSaving(true);
        try {
            await api.updateMerchantMemory(id, { category: editCategory, gstApplicable: editGst });
            setMemory(prev => prev.map(m => m.id === id ? { ...m, category: editCategory, gstApplicable: editGst } : m));
            setEditingId(null);
        } catch (err) {
            console.error('Failed to update merchant memory:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this learned pattern? Future transactions from this merchant will need to be categorized again.')) return;
        try {
            await api.deleteMerchantMemory(id);
            setMemory(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            console.error('Failed to delete merchant memory:', err);
        }
    };

    if (!isOpen) return null;

    const filtered = memory.filter(m =>
        m.merchantPattern.toLowerCase().includes(search.toLowerCase()) ||
        m.category.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFCC00]/5 rounded-full blur-[128px] animate-breathe" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#FFCC00]/5 rounded-full blur-[100px] animate-breathe animate-delay-2s" />
            </div>

            <div className="neu-raised rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300 border border-white/5">
                {/* Header */}
                <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="flex items-center gap-4 relative">
                        <div className="relative group">
                            <div className="absolute -inset-1 cba-gold-gradient rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
                            <div className="relative cba-gold-gradient p-3 rounded-xl">
                                <Brain className="w-6 h-6 text-[#0a0a0f]" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gradient-gold">Merchant Memory</h2>
                            <p className="text-zinc-500 text-sm font-medium flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-[#FFCC00]" />
                                Learned categorization patterns
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 neu-raised-sm rounded-xl text-zinc-400 hover:text-white btn-press"
                        aria-label="Close"
                        title="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-6 bg-white/[0.01]">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#FFCC00] transition-colors" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search merchants or categories..."
                            className="w-full pl-12 pr-4 py-4 neu-inset rounded-2xl focus-gold transition-all outline-none text-zinc-100 placeholder-zinc-600 font-medium bg-transparent"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {loading ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-5 neu-raised-sm rounded-2xl border border-white/5">
                                    <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-20" />
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Skeleton className="h-6 w-24 rounded-full" />
                                        <Skeleton className="h-2 w-16" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 neu-inset rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Brain className="w-8 h-8 text-zinc-700" />
                            </div>
                            <h3 className="text-zinc-400 font-bold text-lg mb-2">
                                {search ? 'No matches found' : 'Memory is empty'}
                            </h3>
                            <p className="text-zinc-600 max-w-xs mx-auto text-sm font-medium">
                                {search ? `We couldn't find any patterns matching "${search}"` : 'Categorize transactions in the main view to build your merchant intelligence.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filtered.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-4 p-5 neu-raised-sm rounded-2xl hover:neu-float transition-all group"
                                >
                                    <div className="w-10 h-10 neu-inset rounded-xl flex items-center justify-center shrink-0">
                                        <Activity className="w-5 h-5 text-zinc-600 group-hover:text-[#FFCC00] transition-colors" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-zinc-100 truncate text-base">{item.merchantPattern}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                                                Used {item.timesUsed}x
                                            </span>
                                            {item.isUserConfirmed && (
                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Confirmed
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {editingId === item.id ? (
                                        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="relative">
                                                <select
                                                    value={editCategory}
                                                    onChange={(e) => setEditCategory(e.target.value)}
                                                    aria-label="Merchant category"
                                                    className="pl-3 pr-8 py-2 neu-inset rounded-xl text-sm font-bold text-[#FFCC00] bg-transparent border-none focus:ring-0 appearance-none min-w-[160px]"
                                                >
                                                    {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-[#12121a] text-zinc-300">{cat}</option>)}
                                                </select>
                                                <Edit2 className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setEditGst(!editGst)}
                                                className={cn(
                                                    "px-3 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all",
                                                    editGst
                                                        ? "cba-gold-bg text-[#0a0a0f] shadow-lg cba-gold-glow"
                                                        : "neu-inset text-zinc-600"
                                                )}
                                            >
                                                GST
                                            </button>

                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSave(item.id)}
                                                    disabled={saving}
                                                    className="p-2 neu-raised-sm rounded-xl text-emerald-400 hover:glow-success btn-press disabled:opacity-50"
                                                    aria-label="Save changes"
                                                    title="Save"
                                                >
                                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingId(null)}
                                                    className="p-2 neu-raised-sm rounded-xl text-zinc-500 hover:text-white btn-press"
                                                    aria-label="Cancel edit"
                                                    title="Cancel"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="px-3 py-1.5 neu-inset rounded-full text-[#FFCC00] text-[10px] font-black tracking-wider uppercase">
                                                    {item.category}
                                                </span>
                                                {item.gstApplicable && (
                                                    <span className="text-[9px] font-bold text-zinc-600 tracking-tighter italic">+ GST Applicable</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2 ml-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(item)}
                                                    className="p-2 neu-raised-sm rounded-xl text-zinc-500 hover:text-[#FFCC00] btn-press group-hover:opacity-100 sm:opacity-0 transition-opacity"
                                                    aria-label={`Edit ${item.merchantPattern} pattern`}
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 neu-raised-sm rounded-xl text-zinc-500 hover:text-red-400 btn-press group-hover:opacity-100 sm:opacity-0 transition-opacity"
                                                    aria-label={`Delete ${item.merchantPattern} pattern`}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                            {[...Array(3)].map((_, i) => {
                                const delayClass = i === 1 ? 'animate-delay-200' : i === 2 ? 'animate-delay-400' : '';
                                return (
                                    <div key={i} className={`w-2 h-2 rounded-full cba-gold-bg opacity-30 animate-pulse ${delayClass}`} />
                                );
                            })}
                        </div>
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
                            Intelligence Engine v1.0
                        </span>
                    </div>
                    <p className="text-[11px] font-bold text-zinc-500 italic">
                        <span className="text-zinc-400 font-black">{memory.length}</span> patterns indexed
                    </p>
                </div>
            </div>
        </div>
    );
}