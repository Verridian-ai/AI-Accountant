import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getAuthHeaders, BASE_URL } from '@/api';
import {
    Receipt,
    ShieldCheck,
    FileStack,
    Store,
    Loader2,
    Sparkles,
    CheckCircle2,
    Clock,
    HelpCircle,
    Briefcase,
    Wallet,
} from 'lucide-react';
import { GSTSummary } from './GSTSummary';
import { GSTReviewQueue } from './GSTReviewQueue';
import { InputTaxCredits } from './InputTaxCredits';

// ---------- constants ----------

const PERIODS = [
    { value: 'current', label: 'Current Quarter' },
    { value: '2024-Q1', label: 'Q1 2024-25 (Jul-Sep 2024)' },
    { value: '2023-Q4', label: 'Q4 2023-24 (Apr-Jun 2024)' },
    { value: '2023-Q3', label: 'Q3 2023-24 (Jan-Mar 2024)' },
    { value: '2023-Q2', label: 'Q2 2023-24 (Oct-Dec 2023)' },
    { value: '2023-Q1', label: 'Q1 2023-24 (Jul-Sep 2023)' },
];

type TabId = 'overview' | 'review' | 'credits' | 'merchants';

interface TabDef {
    id: TabId;
    label: string;
    icon: React.ReactNode;
}

const TABS: TabDef[] = [
    { id: 'overview', label: 'Overview', icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'review', label: 'Review Queue', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'credits', label: 'Input Credits', icon: <FileStack className="w-3.5 h-3.5" /> },
    { id: 'merchants', label: 'Merchants', icon: <Store className="w-3.5 h-3.5" /> },
];

// ---------- types ----------

interface EnrichmentStats {
    enriched: number;
    pending: number;
    unknown: number;
}

interface MerchantInfo {
    name: string;
    abn?: string | null;
    gstRegistered?: boolean | null;
    transactionCount: number;
}

// ---------- component ----------

export function GSTPage() {
    const [period, setPeriod] = useState('current');
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [businessOnly, setBusinessOnly] = useState(true);

    // enrichment
    const [enrichmentStats, setEnrichmentStats] = useState<EnrichmentStats | null>(null);
    const [enrichmentLoading, setEnrichmentLoading] = useState(false);
    const [enrichmentRunning, setEnrichmentRunning] = useState(false);

    // merchants
    const [merchants, setMerchants] = useState<MerchantInfo[]>([]);
    const [merchantsLoading, setMerchantsLoading] = useState(false);

    // ---------- data loaders ----------

    const loadEnrichmentStats = useCallback(async () => {
        setEnrichmentLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/api/enrichment/stats`, {
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const data: EnrichmentStats = await res.json();
                setEnrichmentStats(data);
            }
        } catch {
            // silently ignore -- stats card will show dashes
        } finally {
            setEnrichmentLoading(false);
        }
    }, []);

    const runEnrichment = async () => {
        setEnrichmentRunning(true);
        try {
            const res = await fetch(`${BASE_URL}/api/enrichment/run`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Enrichment failed');
            await loadEnrichmentStats();
        } catch (err) {
            console.error('Enrichment run failed:', err);
        } finally {
            setEnrichmentRunning(false);
        }
    };

    const loadMerchants = useCallback(async () => {
        setMerchantsLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/api/enrichment/merchants`, {
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const data: MerchantInfo[] = await res.json();
                setMerchants(data);
            }
        } catch {
            // silently ignore
        } finally {
            setMerchantsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadEnrichmentStats();
    }, [loadEnrichmentStats]);

    useEffect(() => {
        if (activeTab === 'merchants') {
            loadMerchants();
        }
    }, [activeTab, loadMerchants]);

    // ---------- sub-renders ----------

    const gstBadge = (
        status: 'registered' | 'not_registered' | 'unknown',
    ) => {
        if (status === 'registered') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.15em] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    GST REG
                </span>
            );
        }
        if (status === 'not_registered') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.15em] bg-red-500/15 text-red-400 border border-red-500/20">
                    NO GST
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.15em] bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">
                UNKNOWN
            </span>
        );
    };

    const resolveGstStatus = (
        registered: boolean | null | undefined,
    ): 'registered' | 'not_registered' | 'unknown' => {
        if (registered === true) return 'registered';
        if (registered === false) return 'not_registered';
        return 'unknown';
    };

    // ---------- render ----------

    return (
        <div className="space-y-6">
            {/* ---- Header row ---- */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">
                        GST Dashboard
                    </h2>
                    <p className="text-sm text-zinc-500">
                        Classify transactions, review GST, and track input tax credits
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Business Only toggle */}
                    <div className="neu-inset rounded-full p-0.5 flex items-center">
                        <button
                            onClick={() => setBusinessOnly(true)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200',
                                businessOnly
                                    ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-md'
                                    : 'text-zinc-400 hover:text-zinc-200',
                            )}
                        >
                            <Briefcase className="w-3 h-3" />
                            Business
                        </button>
                        <button
                            onClick={() => setBusinessOnly(false)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200',
                                !businessOnly
                                    ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-md'
                                    : 'text-zinc-400 hover:text-zinc-200',
                            )}
                        >
                            <Wallet className="w-3 h-3" />
                            All
                        </button>
                    </div>

                    {/* Period selector */}
                    <div className="neu-inset rounded-xl">
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="bg-transparent text-zinc-200 text-xs font-medium px-3 py-2 pr-8 rounded-xl border-none outline-none appearance-none cursor-pointer"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23FFCC00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.5rem center',
                            }}
                        >
                            {PERIODS.map((p) => (
                                <option key={p.value} value={p.value} className="bg-[#0a0a0f] text-zinc-200">
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ---- Enrichment Status ---- */}
            <div className="neu-raised rounded-2xl border border-white/5 p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
                            Enrichment Status
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                            {enrichmentLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                            ) : enrichmentStats ? (
                                <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                        <CheckCircle2 className="w-3 h-3" />
                                        {enrichmentStats.enriched} enriched
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em] bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                        <Clock className="w-3 h-3" />
                                        {enrichmentStats.pending} pending
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em] bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">
                                        <HelpCircle className="w-3 h-3" />
                                        {enrichmentStats.unknown} unknown
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs text-zinc-600">No enrichment data available</span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={runEnrichment}
                        disabled={enrichmentRunning}
                        className={cn(
                            'neu-raised flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200',
                            enrichmentRunning
                                ? 'text-zinc-500 cursor-not-allowed opacity-60'
                                : 'text-[#FFCC00] hover:bg-[#FFCC00]/10 border border-[#FFCC00]/20 hover:border-[#FFCC00]/40',
                        )}
                    >
                        {enrichmentRunning ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {enrichmentRunning ? 'Running...' : 'Run Enrichment'}
                    </button>
                </div>
            </div>

            {/* ---- Tabs ---- */}
            <div className="space-y-4">
                {/* Tab pills */}
                <div className="neu-inset rounded-xl p-1 inline-flex gap-1">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200',
                                activeTab === tab.id
                                    ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-md'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]',
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                {activeTab === 'overview' && (
                    <GSTSummary period={period} businessOnly={businessOnly} />
                )}

                {activeTab === 'review' && (
                    <GSTReviewQueue businessOnly={businessOnly} />
                )}

                {activeTab === 'credits' && (
                    <InputTaxCredits period={period} businessOnly={businessOnly} />
                )}

                {activeTab === 'merchants' && (
                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                            Merchant Intelligence
                        </p>

                        {merchantsLoading ? (
                            <div className="neu-raised rounded-2xl border border-white/5 p-8 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
                                <span className="ml-2 text-sm text-zinc-400">Loading merchants...</span>
                            </div>
                        ) : merchants.length === 0 ? (
                            <div className="neu-raised rounded-2xl border border-white/5 p-8 text-center">
                                <Store className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
                                <p className="text-sm text-zinc-500">
                                    No merchant data available yet. Run enrichment to populate.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {merchants.map((m, idx) => (
                                    <div
                                        key={idx}
                                        className="neu-inset rounded-xl p-3 flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-zinc-200 truncate">
                                                {m.name}
                                            </p>
                                            {m.abn && (
                                                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                                    ABN {m.abn}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {gstBadge(resolveGstStatus(m.gstRegistered))}
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.12em] bg-white/5 text-zinc-400 border border-white/5">
                                                {m.transactionCount} txn{m.transactionCount !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
