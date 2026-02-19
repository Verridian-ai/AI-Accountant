import { useState, useEffect } from 'react';
import { fetchAdminProfile } from '../../../api';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';
import { AgentMonitor } from './AgentMonitor';
import { AgentCostDashboard } from './AgentCostDashboard';
import { AgentConfigManager } from './AgentConfigManager';
import { SystemHealthDashboard } from './SystemHealthDashboard';
import { CogneeManager } from './CogneeManager';
import { CogneeSearchTester } from './CogneeSearchTester';
import { UserManager } from './UserManager';
import { ActivityLog } from './ActivityLog';
import { FeatureFlagManager } from './FeatureFlagManager';
import { SystemMetricsCharts } from './SystemMetricsCharts';
import { AdminTransactionsView } from '../../../components/admin/AdminTransactionsView';
import {
  LayoutDashboard,
  Bot,
  DollarSign,
  Settings,
  Activity,
  Server,
  Brain,
  Search,
  Users,
  ScrollText,
  Flag,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Receipt,
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

interface AdminLayoutProps {
  onLogout: () => void;
}

const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ElementType; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'transactions', label: 'Transactions', icon: Receipt, group: 'Overview' },
  { id: 'agents', label: 'Agent Monitor', icon: Bot, group: 'AI Agents' },
  { id: 'costs', label: 'Cost Analysis', icon: DollarSign, group: 'AI Agents' },
  { id: 'config', label: 'Agent Config', icon: Settings, group: 'AI Agents' },
  { id: 'cognee', label: 'Cognee Datasets', icon: Brain, group: 'Knowledge' },
  { id: 'search', label: 'Search Tester', icon: Search, group: 'Knowledge' },
  { id: 'health', label: 'System Health', icon: Server, group: 'System' },
  { id: 'metrics', label: 'Metrics Charts', icon: BarChart3, group: 'System' },
  { id: 'users', label: 'User Manager', icon: Users, group: 'Admin' },
  { id: 'activity', label: 'Activity Log', icon: ScrollText, group: 'Admin' },
  { id: 'features', label: 'Feature Flags', icon: Flag, group: 'Admin' },
];

function AdminSectionPanel({
  section,
  onNavigate,
}: {
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
}) {
  switch (section) {
    case 'dashboard':
      return <AdminDashboard onNavigate={onNavigate} />;
    case 'transactions':
      return <AdminTransactionsView />;
    case 'agents':
      return <AgentMonitor />;
    case 'costs':
      return <AgentCostDashboard />;
    case 'config':
      return <AgentConfigManager />;
    case 'health':
      return <SystemHealthDashboard />;
    case 'cognee':
      return <CogneeManager />;
    case 'search':
      return <CogneeSearchTester />;
    case 'users':
      return <UserManager />;
    case 'activity':
      return <ActivityLog />;
    case 'features':
      return <FeatureFlagManager />;
    case 'metrics':
      return <SystemMetricsCharts />;
    default:
      return <AdminDashboard onNavigate={onNavigate} />;
  }
}

export function AdminLayout({ onLogout }: AdminLayoutProps) {
  const [authenticated, setAuthenticated] = useState(() => !!localStorage.getItem('admin_token'));
  const [adminUser, setAdminUser] = useState<{ username: string; role: string } | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    fetchAdminProfile()
      .then((p: { username?: string; role?: string }) => setAdminUser({ username: p.username || 'admin', role: p.role || 'admin' }))
      .catch(() => {
        /* token might be stale, let them use it until a real call fails */
      });
  }, [authenticated]);

  const handleLogin = (_token: string, user: { username: string; role: string }) => {
    setAuthenticated(true);
    setAdminUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    setAuthenticated(false);
    setAdminUser(null);
    onLogout();
  };

  if (!authenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex">
      {/* Sidebar */}
      <aside
        className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-[#0f0f23] border-r border-white/5 flex flex-col transition-all duration-300 shrink-0`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#FFCC00] shrink-0" />
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-white">Admin</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">GoldLedger</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {NAV_ITEMS.map((item, index) => {
            const showGroup = index === 0 || item.group !== NAV_ITEMS[index - 1].group;
            return (
              <div key={item.id}>
                {showGroup && !sidebarCollapsed && (
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-3 mt-4 mb-2">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  title={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeSection === item.id
                      ? 'bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/20'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors text-xs"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" /> <span>Collapse</span>
              </>
            )}
          </button>
          {!sidebarCollapsed && adminUser && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Activity className="w-3 h-3" />
              <span>{adminUser.username}</span>
              <span className="ml-auto px-1.5 py-0.5 rounded bg-[#FFCC00]/10 text-[#FFCC00] text-[10px] font-bold uppercase">
                {adminUser.role}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <AdminSectionPanel section={activeSection} onNavigate={setActiveSection} />
        </div>
      </main>
    </div>
  );
}
