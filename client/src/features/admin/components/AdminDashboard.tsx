import { useState, useEffect } from 'react';
import {
  fetchAgentStats,
  fetchSystemHealth,
  fetchCogneeAdminDatasets,
  fetchAdminUsers,
  fetchActivityLog,
} from '../../../api';
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

interface AdminDashboardProps {
  onNavigate: (section: AdminSection) => void;
}

interface SummaryCard {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  navigateTo: AdminSection;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [cards, setCards] = useState<SummaryCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<
    Array<{ id: string; action: string; resource: string; timestamp: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    const summaryCards: SummaryCard[] = [];

    try {
      const [agentStats, health, datasets, users, activity] = await Promise.allSettled([
        fetchAgentStats(),
        fetchSystemHealth(),
        fetchCogneeAdminDatasets(),
        fetchAdminUsers(),
        fetchActivityLog({ limit: '5' }),
      ]);

      if (agentStats.status === 'fulfilled') {
        const s = agentStats.value;
        summaryCards.push(
          {
            title: 'Executions (24h)',
            value: String(s.totalExecutions ?? 0),
            subtitle: 'Agent runs',
            icon: Bot,
            color: 'text-blue-400',
            navigateTo: 'agents',
          },
          {
            title: 'Success Rate',
            value: `${(s.successRate ?? 0).toFixed(1)}%`,
            subtitle: 'All agents',
            icon: CheckCircle,
            color: 'text-emerald-400',
            navigateTo: 'agents',
          },
          {
            title: 'Token Cost',
            value: `$${((s.totalCost ?? 0) / 100).toFixed(2)}`,
            subtitle: 'Last 24h',
            icon: DollarSign,
            color: 'text-[#FFCC00]',
            navigateTo: 'costs',
          },
        );
      } else {
        summaryCards.push(
          {
            title: 'Executions (24h)',
            value: '-',
            subtitle: 'Agent runs',
            icon: Bot,
            color: 'text-blue-400',
            navigateTo: 'agents',
          },
          {
            title: 'Success Rate',
            value: '-',
            subtitle: 'All agents',
            icon: CheckCircle,
            color: 'text-emerald-400',
            navigateTo: 'agents',
          },
          {
            title: 'Token Cost',
            value: '-',
            subtitle: 'Last 24h',
            icon: DollarSign,
            color: 'text-[#FFCC00]',
            navigateTo: 'costs',
          },
        );
      }

      if (health.status === 'fulfilled') {
        const h = health.value;
        const overallStatus = h.status || 'unknown';
        summaryCards.push({
          title: 'System Health',
          value: overallStatus.toUpperCase(),
          subtitle: `${h.services?.length ?? 0} services`,
          icon: Server,
          color: overallStatus === 'healthy' ? 'text-emerald-400' : 'text-yellow-400',
          navigateTo: 'health',
        });
      } else {
        summaryCards.push({
          title: 'System Health',
          value: 'UNKNOWN',
          subtitle: 'No data',
          icon: Server,
          color: 'text-zinc-500',
          navigateTo: 'health',
        });
      }

      if (datasets.status === 'fulfilled') {
        const d = Array.isArray(datasets.value) ? datasets.value : datasets.value?.datasets || [];
        summaryCards.push({
          title: 'Cognee Datasets',
          value: String(d.length),
          subtitle: 'Knowledge base',
          icon: Database,
          color: 'text-violet-400',
          navigateTo: 'cognee',
        });
      } else {
        summaryCards.push({
          title: 'Cognee Datasets',
          value: '-',
          subtitle: 'Knowledge base',
          icon: Database,
          color: 'text-violet-400',
          navigateTo: 'cognee',
        });
      }

      if (users.status === 'fulfilled') {
        const u = Array.isArray(users.value) ? users.value : users.value?.users || [];
        summaryCards.push({
          title: 'Admin Users',
          value: String(u.length),
          subtitle: 'Accounts',
          icon: Users,
          color: 'text-cyan-400',
          navigateTo: 'users',
        });
      } else {
        summaryCards.push({
          title: 'Admin Users',
          value: '-',
          subtitle: 'Accounts',
          icon: Users,
          color: 'text-cyan-400',
          navigateTo: 'users',
        });
      }

      if (activity.status === 'fulfilled') {
        const logs = Array.isArray(activity.value) ? activity.value : activity.value?.logs || [];
        setRecentActivity(logs.slice(0, 5));
      }
    } catch {
      // graceful degradation
    }

    setCards(summaryCards);
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
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
        <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
        <p className="text-sm text-zinc-500 mt-1">System overview and quick actions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => onNavigate(card.navigateTo)}
            className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6 text-left hover:border-[#FFCC00]/20 border border-transparent transition-all group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {card.title}
                </p>
                <p className={`text-3xl font-bold mt-2 ${card.color}`}>{card.value}</p>
                <p className="text-xs text-zinc-500 mt-1">{card.subtitle}</p>
              </div>
              <div className="p-2 rounded-xl bg-[#1a1a2e]">
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs text-zinc-600 group-hover:text-[#FFCC00] transition-colors">
              <span>View details</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Recent Activity</h3>
          <button
            type="button"
            onClick={() => onNavigate('activity')}
            className="text-xs text-[#FFCC00] hover:underline"
          >
            View all
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-zinc-500">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div
                key={item.id || i}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div>
                  <p className="text-sm text-zinc-300">{item.action}</p>
                  <p className="text-xs text-zinc-500">{item.resource}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.status === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : item.status === 'error'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-zinc-500/10 text-zinc-400'
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
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onNavigate(action.section)}
            className="flex items-center gap-3 p-4 rounded-xl bg-[#1a1a2e] border border-white/5 hover:border-[#FFCC00]/20 text-zinc-400 hover:text-[#FFCC00] transition-all text-sm font-medium"
          >
            <action.icon className="w-4 h-4" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
