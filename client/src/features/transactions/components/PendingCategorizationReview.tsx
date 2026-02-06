import { useState, useEffect } from 'react';
import { api, type PendingCategorization } from '@/api';
import { Check, X, Edit2, Loader2, ChevronDown, Brain, Sparkles, ShieldAlert, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { CategorySelect } from './CategorySelect';
import { getTaxCodeForCategory } from '../constants/categories';

interface PendingCategorizationReviewProps {
    onUpdate?: () => void;
}

export function PendingCategorizationReview({ onUpdate }: PendingCategorizationReviewProps) {
    const [pending, setPending] = useState<PendingCategorization[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editCategory, setEditCategory] = useState<string>('');
    const [editGst, setEditGst] = useState(false);
    const [resolving, setResolving] = useState<string | null>(null);

    useEffect(() => {
        const fetchPending = async () => {
            try {
                const data = await api.fetchPendingCategorizations();
                setPending(data);
            } catch (err) {
                console.error('Failed to fetch pending categorizations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPending();
    }, []);

    const handleResolve = async (id: string, action: 'approve' | 'reject' | 'modify') => {
        setResolving(id);
        try {
            if (action === 'modify') {
                await api.resolveCategorization(id, action, editCategory, editGst);
            } else {
                await api.resolveCategorization(id, action);
            }
            setPending(prev => prev.filter(p => p.id !== id));
            setExpandedId(null);
            onUpdate?.();
        } catch (err) {
            console.error('Failed to resolve categorization:', err);
        } finally {
            setResolving(null);
        }
    };

    const toggleExpand = (item: PendingCategorization) => {
        if (expandedId === item.id) {
            setExpandedId(null);
        } else {
            setExpandedId(item.id);
            setEditCategory(item.suggestedCategory || 'Uncategorized');
            setEditGst(false);
        }
    };

    if (loading) {
        return (
            <div className="neu-raised rounded-[2rem] p-6 mb-10 border border-amber-500/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-amber-500/[0.02] pointer-events-none" />
                <div className="flex items-center gap-4 mb-8">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </div>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-5 rounded-[1.5rem] neu-raised-sm border border-white/5 flex items-center justify-between">
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-1/2" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-6 w-20 rounded-full" />
                                <Skeleton className="h-8 w-8 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (pending.length === 0) {
        return null; // Don't show anything if no pending items
    }

    return (
        <div className="neu-raised rounded-[2rem] p-6 mb-10 border border-amber-500/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-amber-500/[0.02] pointer-events-none" />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 relative">
                <div className="flex items-center gap-4">
                    <div className="relative group/icon">
                        <div className="absolute -inset-1 bg-amber-500 rounded-xl blur opacity-20 group-hover/icon:opacity-40 transition-opacity" />
                        <div className="relative bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-amber-500">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-amber-500 uppercase tracking-tight">Intelligence Audit</h3>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                            {pending.length} nodes require human verification
                        </p>
                    </div>
                </div>
                <div className="neu-inset px-4 py-2 rounded-full hidden md:flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                    <span className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest italic">Action Required</span>
                </div>
            </div>

            <div className="space-y-4 relative">
                {pending.slice(0, 5).map((item) => (
                    <div
                        key={item.id}
                        className={cn(
                            "transition-all duration-300 rounded-[1.5rem] overflow-hidden border",
                            expandedId === item.id
                                ? "neu-raised border-amber-500/20 shadow-2xl scale-[1.02] z-10"
                                : "neu-raised-sm border-white/5 hover:border-amber-500/10"
                        )}
                    >
                        <div
                            className={cn(
                                "flex items-center justify-between p-5 cursor-pointer transition-colors",
                                expandedId === item.id ? "bg-amber-500/[0.03]" : "hover:bg-white/[0.01]"
                            )}
                            onClick={() => toggleExpand(item)}
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <p className="font-black text-zinc-100 truncate text-sm uppercase tracking-tight">
                                    {item.transaction?.description || 'Unknown Data Packet'}
                                </p>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{item.transaction?.date}</span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                    <span className={cn(
                                        "text-[10px] font-black tracking-tighter",
                                        item.transaction?.amount && item.transaction.amount < 0 ? 'text-red-400' : 'text-emerald-400'
                                    )}>
                                        ${Math.abs((item.transaction?.amount || 0) / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="flex flex-col items-end">
                                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[9px] font-black rounded-full border border-amber-500/20 uppercase tracking-widest">
                                        {Math.round((item.suggestedConfidence || 0) * 100)}% Match
                                    </span>
                                </div>
                                <div className={cn(
                                    "p-2 rounded-xl neu-inset transition-transform duration-300",
                                    expandedId === item.id ? "rotate-180 text-amber-500" : "text-zinc-600"
                                )}>
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        {expandedId === item.id && (
                            <div className="p-6 bg-black/20 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                    <div className="p-4 neu-inset rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Brain className="w-3.5 h-3.5 text-[#FFCC00]" />
                                            <span className="text-[10px] font-black text-[#FFCC00] uppercase tracking-widest">AI Inference</span>
                                        </div>
                                        <p className="text-xs text-zinc-200 font-bold mb-2">Suggested: <span className="text-[#FFCC00]">{item.suggestedCategory}</span></p>
                                        {item.aiReasoning && (
                                            <p className="text-[11px] text-zinc-500 italic leading-relaxed">"{item.aiReasoning}"</p>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Manual Override</label>
                                            <CategorySelect
                                                value={editCategory}
                                                onChange={(value) => {
                                                    setEditCategory(value);
                                                    const taxCode = getTaxCodeForCategory(value);
                                                    setEditGst(taxCode === 'GST');
                                                }}
                                                aria-label="Override category"
                                                size="sm"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-3 neu-inset rounded-xl border border-white/5">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Apply GST</span>
                                            <button
                                                onClick={() => setEditGst(!editGst)}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all",
                                                    editGst
                                                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                                        : "bg-zinc-800 text-zinc-600"
                                                )}
                                            >
                                                {editGst ? 'ACTIVE' : 'OFF'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleResolve(item.id, 'approve')}
                                        disabled={resolving === item.id}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-[#0a0a0f] rounded-xl text-[10px] font-black uppercase tracking-[0.15em] hover:brightness-110 btn-press disabled:opacity-50 shadow-lg shadow-emerald-500/10"
                                    >
                                        {resolving === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Verify Inference
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleResolve(item.id, 'modify')}
                                        disabled={resolving === item.id}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] hover:brightness-110 btn-press disabled:opacity-50 shadow-lg shadow-blue-600/10"
                                    >
                                        <Edit2 className="w-4 h-4" /> Override Data
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleResolve(item.id, 'reject')}
                                        disabled={resolving === item.id}
                                        className="px-6 py-3 neu-raised-sm text-zinc-500 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] hover:text-red-400 btn-press border border-white/5"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {pending.length > 5 && (
                <div className="mt-8 flex flex-col items-center gap-2">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">
                        + {pending.length - 5} remaining packets in buffer
                    </p>
                    <button className="text-[10px] font-black text-[#FFCC00] hover:brightness-110 flex items-center gap-1 uppercase tracking-widest py-2 px-4 neu-raised-sm rounded-xl">
                        Process All <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
    );
}
