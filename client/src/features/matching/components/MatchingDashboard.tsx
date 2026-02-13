import { useState, useEffect } from 'react';
import { Link2, Zap, Settings, BarChart3, ArrowRightLeft } from 'lucide-react';
import { matchesApi } from '@/api';
import type { MatchStats } from '@/api';
import { MatchReviewPanel } from './MatchReviewPanel';
import { AutoMatchView } from './AutoMatchView';
import { RuleManager } from './RuleManager';
import { MatchStatistics } from './MatchStatistics';

type MatchTab = 'review' | 'auto' | 'rules' | 'stats';

const TABS: Array<{ id: MatchTab; label: string; icon: typeof Link2 }> = [
  { id: 'review', label: 'Match Review', icon: ArrowRightLeft },
  { id: 'auto', label: 'Auto-Match', icon: Zap },
  { id: 'rules', label: 'Rules', icon: Settings },
  { id: 'stats', label: 'Statistics', icon: BarChart3 },
];

export function MatchingDashboard() {
  const [activeTab, setActiveTab] = useState<MatchTab>('review');
  const [stats, setStats] = useState<MatchStats | null>(null);

  useEffect(() => {
    matchesApi
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="neu-inset p-2.5 rounded-xl">
            <Link2 className="h-5 w-5 text-[#FFCC00]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Payment Matching</h2>
            <p className="text-xs text-zinc-500">Match documents to transactions</p>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="flex items-center gap-3">
            {stats.pending > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-400 text-xs font-bold">
                {stats.pending} unmatched
              </span>
            )}
            <span className="px-3 py-1.5 neu-raised-sm rounded-full text-xs font-mono text-zinc-400">
              {stats.matchRate.toFixed(0)}% match rate
            </span>
          </div>
        )}
      </div>

      {/* Quick Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="neu-raised rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Total Docs
            </p>
            <p className="text-xl font-bold text-zinc-100 mt-1">{stats.totalDocuments}</p>
          </div>
          <div className="neu-raised rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Match Rate
            </p>
            <p
              className={`text-xl font-bold mt-1 ${stats.matchRate > 80 ? 'text-emerald-400' : stats.matchRate < 50 ? 'text-red-400' : 'text-amber-400'}`}
            >
              {stats.matchRate.toFixed(1)}%
            </p>
          </div>
          <div className="neu-raised rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Avg Confidence
            </p>
            <p className="text-xl font-bold text-zinc-100 mt-1">
              {(stats.averageConfidence * 100).toFixed(0)}%
            </p>
          </div>
          <div className="neu-raised rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Pending
            </p>
            <p className="text-xl font-bold text-amber-400 mt-1">{stats.pending}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="neu-raised rounded-xl p-1.5 flex items-center gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_12px_rgba(255,204,0,0.15)]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'review' && <MatchReviewPanel />}
        {activeTab === 'auto' && <AutoMatchView />}
        {activeTab === 'rules' && <RuleManager />}
        {activeTab === 'stats' && <MatchStatistics />}
      </div>
    </div>
  );
}
