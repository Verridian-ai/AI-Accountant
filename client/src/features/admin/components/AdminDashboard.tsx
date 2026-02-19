import { useState, useEffect } from 'react';
import {
  fetchAgentStats,
  fetchSystemHealth,
  fetchCogneeAdminDatasets,
  fetchAdminUsers,
  fetchActivityLog,
  fetchAdminLedgerSummary,
  fetchAdminBasSummary,
} from '../../../api';
import type { LedgerSummary, BASSummary } from '../../../api/misc';
import { LedgerSummaryCards } from './LedgerSummaryCards';
import {
  Bot,
  CheckCircle,
  DollarSign,
  Server,
  Database,
  Users,
  ArrowRight,
  Flag,
} from 'lucide-react';

type AdminSection =
  | 'dashboard'
  | 'transactions'
  | 'agents'
  | 'costs'
  | 'config'
  | 'health'
  | 'cognee'
  | 'search'
  | 'users'
  | 'activity'
  | 'features'
  | 'metrics';

interface SummaryCard {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  navigateTo: AdminSection;
}

interface ActivityItem {
  id: string;
  action: string;
  resource: string;
  timestamp: string;
  status: string;
}

function card(
  title: string,
  value: string,
  subtitle: string,
  icon: React.ElementType,
  color: string,
  navigateTo: AdminSection,
): SummaryCard {
  return { title, value, subtitle, icon, color, navigateTo };
}

export function AdminDashboard({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const [cards, setCards] = useState<SummaryCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [basSummary, setBasSummary] = useState<BASSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    const sc: SummaryCard[] = [];
    try {
      const [agentStats, health, datasets, users, activity, ledger, bas] = await Promise.allSettled(
        [
          fetchAgentStats(),
          fetchSystemHealth(),
          fetchCogneeAdminDatasets(),
          fetchAdminUsers(),
          fetchActivityLog({ limit: '5' }),
          fetchAdminLedgerSummary(),
          fetchAdminBasSummary(),
        ],
      );

      if (agentStats.status === 'fulfilled') {
        const s = agentStats.value;
        sc.push(
          card(
            'Executions (24h)',
            String(s.totalExecutions ?? 0),
            'Agent runs',
            Bot,
            'text-blue-400',
            'agents',
          ),
          card(
            'Success Rate',
            `${(s.successRate ?? 0).toFixed(1)}%`,
            'All agents',
            CheckCircle,
            'text-emerald-400',
            'agents',
          ),
          card(
            'Token Cost',
            `$${((s.totalCost ?? 0) / 100).toFixed(2)}`,
            'Last 24h',
            DollarSign,
            'text-cba-gold',
            'costs',
          ),
        );
      } else {
        sc.push(
          card('Executions (24h)', '-', 'Agent runs', Bot, 'text-blue-400', 'agents'),
          card('Success Rate', '-', 'All agents', CheckCircle, 'text-emerald-400', 'agents'),
          card('Token Cost', '-', 'Last 24h', DollarSign, 'text-cba-gold', 'costs'),
        );
      }

      if (health.status === 'fulfilled') {
        const st = health.value.status || 'unknown';
        sc.push(
          card(
            'System Health',
            st.toUpperCase(),
            `${health.value.services?.length ?? 0} services`,
            Server,
            st === 'healthy' ? 'text-emerald-400' : 'text-yellow-400',
            'health',
          ),
        );
      } else {
        sc.push(card('System Health', 'UNKNOWN', 'No data', Server, 'text-muted', 'health'));
      }

      if (datasets.status === 'fulfilled') {
        const d = Array.isArray(datasets.value) ? datasets.value : datasets.value?.datasets || [];
        sc.push(
          card(
            'Cognee Datasets',
            String(d.length),
            'Knowledge base',
            Database,
            'text-violet-400',
            'cognee',
          ),
        );
      } else {
        sc.push(
          card('Cognee Datasets', '-', 'Knowledge base', Database, 'text-violet-400', 'cognee'),
        );
      }

      if (users.status === 'fulfilled') {
        const u = Array.isArray(users.value) ? users.value : users.value?.users || [];
        sc.push(card('Admin Users', String(u.length), 'Accounts', Users, 'text-cyan-400', 'users'));
      } else {
        sc.push(card('Admin Users', '-', 'Accounts', Users, 'text-cyan-400', 'users'));
      }

      if (activity.status === 'fulfilled') {
        const logs = Array.isArray(activity.value) ? activity.value : activity.value?.logs || [];
        setRecentActivity(logs.slice(0, 5));
      }
      if (ledger.status === 'fulfilled') setLedgerSummary(ledger.value as LedgerSummary);
      if (bas.status === 'fulfilled') setBasSummary(bas.value as BASSummary);
    } catch {
      /* graceful degradation */
    }
    setCards(sc);
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      await loadDashboard();
    };
    run().catch(() => {
      /* errors handled inside loadDashboard */
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-primary">Admin Dashboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={`sk-${i}`}
              className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6 animate-pulse h-32"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-primary">Admin Dashboard</h2>
        <p className="text-sm text-muted mt-1">System overview and quick actions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={() => onNavigate(c.navigateTo)}
            className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6 text-left hover:border-cba-gold/20 border border-transparent transition-all group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted uppercase tracking-wider">
                  {c.title}
                </p>
                <p className={`text-3xl font-bold mt-2 ${c.color}`}>{c.value}</p>
                <p className="text-xs text-muted mt-1">{c.subtitle}</p>
              </div>
              <div className="p-2 rounded-xl bg-[#1a1a2e]">
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs text-zinc-600 group-hover:text-cba-gold transition-colors">
              <span>View details</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </button>
        ))}
      </div>

      {/* Ledger Health + BAS Summary */}
      <LedgerSummaryCards ledger={ledgerSummary} bas={basSummary} />

      {/* Recent Activity */}
      <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary">Recent Activity</h3>
          <button
            type="button"
            onClick={() => onNavigate('activity')}
            className="text-xs text-cba-gold hover:underline"
          >
            View all
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div
                key={item.id || i}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="text-sm text-primary">{item.action}</p>
                  <p className="text-xs text-muted">{item.resource}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.status === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : item.status === 'error'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-zinc-500/10 text-secondary'
                    }`}
                  >
                    {item.status}
                  </span>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Agent Monitor', section: 'agents' as AdminSection, icon: Bot },
          { label: 'System Health', section: 'health' as AdminSection, icon: Server },
          { label: 'Cognee Search', section: 'search' as AdminSection, icon: Database },
          { label: 'Feature Flags', section: 'features' as AdminSection, icon: Flag },
        ].map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onNavigate(a.section)}
            className="flex items-center gap-3 p-4 rounded-xl bg-[#1a1a2e] border border-border/50 hover:border-cba-gold/20 text-secondary hover:text-cba-gold transition-all text-sm font-medium"
          >
            <a.icon className="w-4 h-4" />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
