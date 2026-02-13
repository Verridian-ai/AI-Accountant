import { useState, useEffect, useCallback } from 'react';
import { invoicingApi } from '@/api';
import { Search, Plus, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerListProps {
    onSelectCustomer: (id: string) => void;
    onAddCustomer: () => void;
}

const formatABN = (abn: string | null | undefined): string => {
    if (!abn) return '—';
    const digits = abn.replace(/\D/g, '');
    if (digits.length !== 11) return abn;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
};

const formatAUD = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const PAGE_SIZE = 20;

export function CustomerList({ onSelectCustomer, onAddCustomer }: CustomerListProps) {
    const [customers, setCustomers] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showActiveOnly, setShowActiveOnly] = useState(true);
    const [page, setPage] = useState(0);

    const loadCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await invoicingApi.listCustomers({
                offset: page * PAGE_SIZE,
                limit: PAGE_SIZE,
                search: search || undefined,
                isActive: showActiveOnly ? true : undefined,
            });
            setCustomers(res?.customers ?? []);
            setTotal(res?.total ?? 0);
        } catch (err) {
            console.error('Failed to load customers:', err);
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [page, search, showActiveOnly]);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    useEffect(() => {
        setPage(0);
    }, [search, showActiveOnly]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-4">
            {/* Search & Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative flex-1 w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search customers..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl neu-inset bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowActiveOnly(!showActiveOnly)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                            showActiveOnly
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "neu-raised text-zinc-400"
                        )}
                    >
                        {showActiveOnly ? 'Active Only' : 'All'}
                    </button>
                    <button
                        onClick={onAddCustomer}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFCC00] text-[#0a0a0f] text-sm font-bold hover:bg-[#FFD633] transition-colors shadow-[0_0_15px_rgba(255,204,0,0.15)]"
                    >
                        <Plus className="w-4 h-4" />
                        Add Customer
                    </button>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
                </div>
            ) : customers.length === 0 ? (
                <div className="neu-raised rounded-2xl p-8 text-center">
                    <Users className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                    <p className="text-zinc-400 text-sm">
                        {search ? 'No customers match your search.' : 'No customers yet. Add your first customer to get started.'}
                    </p>
                </div>
            ) : (
                <div className="neu-raised rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800">
                                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Business Name</th>
                                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold hidden md:table-cell">Contact</th>
                                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold hidden lg:table-cell">Email</th>
                                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold hidden xl:table-cell">ABN</th>
                                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Outstanding</th>
                                    <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((c: any) => (
                                    <tr
                                        key={c.id}
                                        onClick={() => onSelectCustomer(c.id)}
                                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3 font-semibold text-zinc-100">{c.businessName}</td>
                                        <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{c.contactName || '—'}</td>
                                        <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">{c.email || '—'}</td>
                                        <td className="px-4 py-3 text-zinc-500 font-mono text-xs hidden xl:table-cell">{formatABN(c.abn)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={cn(
                                                "font-semibold",
                                                (c.outstandingBalance ?? 0) > 0 ? "text-[#FFCC00]" : "text-zinc-500"
                                            )}>
                                                {formatAUD(c.outstandingBalance ?? 0)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                c.isActive !== false
                                                    ? "bg-emerald-500/20 text-emerald-400"
                                                    : "bg-zinc-700/50 text-zinc-500"
                                            )}>
                                                {c.isActive !== false ? 'Active' : 'Archived'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">
                        Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="p-1.5 rounded-lg neu-raised text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-zinc-400 tabular-nums">
                            {page + 1} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="p-1.5 rounded-lg neu-raised text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
