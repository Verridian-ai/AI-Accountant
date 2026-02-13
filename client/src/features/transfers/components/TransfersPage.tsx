import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getAuthHeaders, BASE_URL } from '@/api';
import {
  GitCompareArrows,
  GitBranch,
  Calculator,
  Zap,
  Loader2,
  Wallet,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { TransferConfirmation } from './TransferConfirmation';
import { MoneyFlowDiagram } from './MoneyFlowDiagram';
import { NetPositionCalculator } from './NetPositionCalculator';

interface TransferSummary {
  totalMatched: number;
  ownerContributions: number; // cents
  creditCardPayments: number; // cents
  totalAmount: number; // cents
}

const formatAUD = (cents: number): string =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

type TabId = 'matches' | 'flow' | 'position';

const TABS: { id: TabId; label: string; icon: typeof GitCompareArrows }[] = [
  { id: 'matches', label: 'Transfer Matches', icon: GitCompareArrows },
  { id: 'flow', label: 'Money Flow', icon: GitBranch },
  { id: 'position', label: 'Net Position', icon: Calculator },
];

export function TransfersPage() {
  const [activeTab, setActiveTab] = useState<TabId>('matches');
  const [summary, setSummary] = useState<TransferSummary | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/transfers/summary`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data: TransferSummary = await res.json();
      setSummary(data);
    } catch {
      // Gracefully handle — leave summary null
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/transfers/detect`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Detection failed');
      const data: { matchCount: number } = await res.json();
      setNotification(
        `Detected ${data.matchCount} new transfer match${data.matchCount !== 1 ? 'es' : ''}`,
      );
      await fetchSummary();
    } catch {
      setNotification('Transfer detection failed. Please try again.');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">
          Cross-Account Intelligence
        </h2>
        <p className="text-sm text-zinc-500">
          Confirm transfer matches, visualise money flow, and calculate net positions
        </p>
      </div>

      {/* Header bar: Detect button + Summary stats */}
      <div className="neu-raised rounded-2xl border border-white/5 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Left: Detect button */}
          <button
            type="button"
            onClick={handleDetect}
            disabled={detecting}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all btn-press shrink-0',
              'bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFE066] disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {detecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Detecting...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Detect Transfers
              </>
            )}
          </button>

          {/* Right: Summary stats */}
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <div className="neu-inset rounded-xl px-3 py-2 flex items-center gap-2">
              <GitCompareArrows className="w-3.5 h-3.5 text-[#FFCC00]" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">
                Matched
              </span>
              <span className="text-xs font-black text-zinc-200">
                {summary ? summary.totalMatched : '\u2014'}
              </span>
            </div>
            <div className="neu-inset rounded-xl px-3 py-2 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">
                Owner
              </span>
              <span className="text-xs font-black text-zinc-200">
                {summary ? formatAUD(summary.ownerContributions) : '\u2014'}
              </span>
            </div>
            <div className="neu-inset rounded-xl px-3 py-2 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">
                CC Payments
              </span>
              <span className="text-xs font-black text-zinc-200">
                {summary ? formatAUD(summary.creditCardPayments) : '\u2014'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast-like notification */}
      {notification && (
        <div className="neu-raised rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-emerald-300">{notification}</span>
        </div>
      )}

      {/* Neumorphic tabs */}
      <div className="space-y-4">
        <div className="neu-inset rounded-xl p-1 inline-flex">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all',
                activeTab === id
                  ? 'bg-[#FFCC00] text-[#0a0a0f]'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'matches' && <TransferConfirmation />}
        {activeTab === 'flow' && <MoneyFlowDiagram />}
        {activeTab === 'position' && <NetPositionCalculator />}
      </div>
    </div>
  );
}
