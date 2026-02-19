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
import { Sparkline, CHART_COLORS } from '@/components/charts';
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

  const gstBadge = (status: 'registered' | 'not_registered' | 'unknown') => {
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
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.15em] bg-zinc-500/15 text-secondary border border-zinc-500/20">
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
    <div className="space-y-4 sm:space-y-6">
      {/* ---- Header row ---- */}
      <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-gradient-gold">
            GST Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Classify transactions, review GST, and track input tax credits
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Business Only toggle */}
          <div className="neu-inset rounded-full p-0.5 flex items-center">
            <button
              onClick={() => setBusinessOnly(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200',
                businessOnly
                  ? 'bg-cba-gold text-base shadow-md'
                  : 'text-secondary hover:text-primary',
              )}
            >
              <Briefcase className="w-3 h-3" />
              Business
            </button>
            <button
              onClick={() => setBusinessOnly(false)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200',
                !businessOnly
                  ? 'bg-cba-gold text-base shadow-md'
                  : 'text-secondary hover:text-primary',
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
              className="bg-transparent text-primary text-xs font-medium px-3 py-2.5 min-h-[44px] pr-8 rounded-xl border-none outline-none appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23FFCC00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center',
              }}
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value} className="bg-base text-primary">
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ---- GST Category Summary Cards with Sparklines ---- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="neu-raised rounded-2xl border border-border/50 p-3 sm:p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-muted uppercase tracking-widest">
              GST Collected
            </p>
            <p className="text-lg font-black text-cba-gold tabular-nums">10%</p>
          </div>
          <Sparkline
            data={[820, 950, 870, 1100, 1050, 1200]}
            width={80}
            height={24}
            color={CHART_COLORS.primary}
            showArea
            trend="up"
          />
        </div>
        <div className="neu-raised rounded-2xl border border-border/50 p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-muted uppercase tracking-widest">
              GST Free
            </p>
            <p className="text-lg font-black text-primary tabular-nums">0%</p>
          </div>
          <Sparkline
            data={[300, 280, 350, 310, 290, 320]}
            width={80}
            height={24}
            color={CHART_COLORS.axis}
            trend="flat"
          />
        </div>
        <div className="neu-raised rounded-2xl border border-border/50 p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-muted uppercase tracking-widest">
              Input Taxed
            </p>
            <p className="text-lg font-black text-primary tabular-nums">N/A</p>
          </div>
          <Sparkline
            data={[50, 60, 45, 70, 55, 65]}
            width={80}
            height={24}
            color={CHART_COLORS.primaryDark}
            trend="flat"
          />
        </div>
        <div className="neu-raised rounded-2xl border border-border/50 p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-muted uppercase tracking-widest">
              BAS Ready
            </p>
            <p className="text-lg font-black text-emerald-400 tabular-nums">Q1</p>
          </div>
          <Sparkline
            data={[1, 2, 3, 3, 4, 4]}
            width={80}
            height={24}
            color={CHART_COLORS.revenue}
            showArea
            trend="up"
          />
        </div>
      </div>

      {/* ---- Enrichment Status ---- */}
      <div className="neu-raised rounded-2xl border border-border/50 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-2">
              Enrichment Status
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {enrichmentLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted" />
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em] bg-zinc-500/15 text-secondary border border-zinc-500/20">
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
              'neu-raised flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200',
              enrichmentRunning
                ? 'text-muted cursor-not-allowed opacity-60'
                : 'text-cba-gold hover:bg-cba-gold/10 border border-cba-gold/20 hover:border-cba-gold/40',
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
        <div className="neu-inset rounded-xl p-1 flex gap-1 overflow-x-auto w-full sm:w-fit sm:inline-flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-cba-gold text-base shadow-md'
                  : 'text-secondary hover:text-primary hover:bg-white/[0.03]',
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.id === 'overview'
                  ? 'Overview'
                  : tab.id === 'review'
                    ? 'Review'
                    : tab.id === 'credits'
                      ? 'Credits'
                      : 'Merch.'}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && <GSTSummary period={period} businessOnly={businessOnly} />}

        {activeTab === 'review' && <GSTReviewQueue businessOnly={businessOnly} />}

        {activeTab === 'credits' && <InputTaxCredits period={period} businessOnly={businessOnly} />}

        {activeTab === 'merchants' && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
              Merchant Intelligence
            </p>

            {merchantsLoading ? (
              <div className="neu-raised rounded-2xl border border-border/50 p-8 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-cba-gold" />
                <span className="ml-2 text-sm text-secondary">Loading merchants...</span>
              </div>
            ) : merchants.length === 0 ? (
              <div className="neu-raised rounded-2xl border border-border/50 p-8 text-center">
                <Store className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
                <p className="text-sm text-muted">
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
                      <p className="text-sm font-semibold text-primary truncate">{m.name}</p>
                      {m.abn && (
                        <p className="text-[10px] font-mono text-muted mt-0.5">ABN {m.abn}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {gstBadge(resolveGstStatus(m.gstRegistered))}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.12em] bg-overlay text-secondary border border-border/50">
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
