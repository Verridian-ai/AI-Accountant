import { useEffect, useState } from 'react';
import { LedgerPage } from './features/transactions/components/LedgerPage';
import { Toaster } from 'sonner';
import { FloatingChat } from './features/chat/components/FloatingChat';
import { StatCard, StatCardSkeleton } from './features/analytics/components/StatCard';
import { StatementList } from './features/statements/components/StatementList';
import { CategoryChart } from './features/analytics/components/CategoryChart';
import { MonthlyTrendChart } from './features/analytics/components/MonthlyTrendChart';
import { SettingsModal } from './features/settings/components/Settings';
import { Auth } from './features/auth/components/Auth';
import { PendingCategorizationReview } from './features/transactions/components/PendingCategorizationReview';
import { MerchantMemoryManager } from './features/transactions/components/MerchantMemoryManager';
import { AccountsOverview } from './features/accounts/components/AccountsOverview';
import { DebtReductionPlanner } from './features/analytics/components/DebtReductionPlanner';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { BASDashboard } from './features/bas/components/BASDashboard';
import { TaxDashboard } from './features/tax/components/TaxDashboard';
import { api, getToken } from './api';
import type { Transaction, TransactionStats, Account } from './api';
import {
  Activity,

  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  RefreshCw,
  LogOut,
  Settings as SettingsIcon,
  Brain,
  Calculator,
  LayoutDashboard,
  FileText,
  BarChart3,
  Bot
} from 'lucide-react';
import { cn } from './lib/utils';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMerchantMemoryOpen, setIsMerchantMemoryOpen] = useState(false);
  const [isAgentsPanelOpen, setIsAgentsPanelOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax'>('dashboard');

  const handleLogin = (token: string, userData: { id: string; username: string }) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
    setTransactions([]);
    setStats(null);
  };

  const refreshData = async () => {
    try {
      const [txs, accts] = await Promise.all([
        api.fetchTransactions(),
        api.fetchAccounts()
      ]);
      setTransactions(txs);
      setAccounts(accts);
      setStats(api.calculateStats(txs));
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          const userData = await api.getCurrentUser();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (e) {
          console.error('Session restoration failed', e);
          handleLogout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(cents / 100);
  };

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen font-sans pb-24 md:pb-0 bg-(--dark-base)">
      {/* Header - Glass Morphism */}
      <header className="glass sticky top-0 z-40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="relative group">
              <div className="absolute -inset-0.5 cba-gold-gradient rounded-xl blur-sm opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative cba-gold-gradient p-2.5 sm:p-3 rounded-xl flex items-center justify-center">
                <img src="/cba-logo.svg" alt="CBA Logo" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />
              </div>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight leading-tight text-gradient-gold">
                CBA AI
              </h1>
              <p className="hidden sm:block text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-semibold">
                Statement Parser
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-0.5 bg-white/5 p-1 rounded-xl border border-white/10">
            {([
              { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
              { id: 'transactions', label: 'Ledger', icon: FileText },
              { id: 'accounts', label: 'Vaults', icon: Wallet },
              { id: 'analytics', label: 'Insights', icon: BarChart3 },
              { id: 'bas', label: 'BAS', icon: Calculator },
              { id: 'tax', label: 'Tax', icon: Receipt },
            ] as const).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs lg:text-sm font-bold transition-all duration-300 whitespace-nowrap",
                  activeTab === item.id
                    ? "bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_20px_rgba(255,204,0,0.2)]"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user && (
              <span className="hidden xl:flex items-center gap-2 text-sm text-zinc-400 font-medium mr-2 neu-raised-sm px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {user.username}
              </span>
            )}

            {/* Desktop Agents Button */}
            <button
              type="button"
              title="AI Agents"
              className="hidden md:flex items-center gap-2 neu-raised-sm px-3 py-2 text-zinc-400 hover:text-[#FFCC00] hover:cba-gold-glow rounded-xl btn-press mr-2 transition-all"
              onClick={() => setIsAgentsPanelOpen(true)}
            >
              <Bot className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Agents</span>
            </button>

            {/* Sync Status Pill */}
            <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest neu-inset px-4 py-2 rounded-full text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full cba-gold-bg animate-pulse" />
              Sync: {lastUpdated?.toLocaleTimeString() || 'Never'}
            </div>

            {/* Action Buttons */}
            <button
              type="button"
              title="Merchant Memory"
              aria-label="Open merchant memory"
              onClick={() => setIsMerchantMemoryOpen(true)}
              className="neu-raised-sm p-2.5 sm:px-3 sm:py-2.5 text-zinc-400 hover:text-[#FFCC00] hover:cba-gold-glow rounded-xl btn-press"
            >
              <Brain className="h-5 w-5" />
            </button>
            <button
              type="button"
              title="Settings"
              aria-label="Open settings"
              onClick={() => setIsSettingsOpen(true)}
              className="neu-raised-sm p-2.5 sm:px-3 sm:py-2.5 text-zinc-400 hover:text-[#FFCC00] hover:cba-gold-glow rounded-xl btn-press"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              title="Refresh data"
              aria-label="Refresh data"
              onClick={refreshData}
              className="neu-raised-sm p-2.5 sm:px-3 sm:py-2.5 text-zinc-400 hover:text-emerald-400 hover:glow-success rounded-xl btn-press"
            >
              <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              title="Logout"
              aria-label="Logout"
              onClick={handleLogout}
              className="neu-raised-sm p-2.5 text-zinc-400 hover:text-red-400 hover:glow-danger rounded-xl btn-press"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <section>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {loading ? (
                  <>
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </>
                ) : (
                  <>
                    <StatCard
                      title="Income"
                      value={stats ? formatCurrency(stats.totalIncome) : '$0.00'}
                      subtitle="Credits"
                      icon={TrendingUp}
                      trend="up"
                    />
                    <StatCard
                      title="Expenses"
                      value={stats ? formatCurrency(stats.totalExpenses) : '$0.00'}
                      subtitle="Debits"
                      icon={TrendingDown}
                      trend="down"
                    />
                    <StatCard
                      title="Net Flow"
                      value={stats ? formatCurrency(stats.netFlow) : '$0.00'}
                      subtitle="Balance"
                      icon={Wallet}
                      trend={stats && stats.netFlow >= 0 ? 'up' : 'down'}
                    />
                    <StatCard
                      title="Activity"
                      value={stats?.transactionCount.toString() || '0'}
                      subtitle="Processed"
                      icon={Receipt}
                    />
                  </>
                )}
              </div>
            </section>

            <PendingCategorizationReview onUpdate={refreshData} />

            {/* Dashboard Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MonthlyTrendChart transactions={transactions} loading={loading} />
              <div className="hidden lg:block">
                <CategoryChart data={stats?.categoryBreakdown || {}} loading={loading} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <LedgerPage
              transactions={transactions}
              accounts={accounts}
              loading={loading}
              onDataChange={refreshData}
            />
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AccountsOverview />
              <StatementList />
            </div>
            <DebtReductionPlanner />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MonthlyTrendChart transactions={transactions} loading={loading} />
              <CategoryChart data={stats?.categoryBreakdown || {}} loading={loading} />
            </div>
          </div>
        )}

        {activeTab === 'bas' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <BASDashboard />
          </div>
        )}

        {activeTab === 'tax' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TaxDashboard />
          </div>
        )}
      </main>

      {/* Floating Chat */}
      <FloatingChat />

      {/* Bottom Navigation - Mobile Only */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onShowAgents={() => setIsAgentsPanelOpen(true)}
      />

      {/* AI Agents Panel */}
      {
        isAgentsPanelOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAgentsPanelOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto neu-raised rounded-t-3xl animate-slide-up">
              <div className="p-4 border-b border-white/5 flex items-center justify-between sticky top-0 glass">
                <h2 className="text-lg font-bold text-gradient-gold">AI Agents</h2>
                <button
                  type="button"
                  onClick={() => setIsAgentsPanelOpen(false)}
                  className="neu-raised-sm p-2 rounded-xl text-zinc-400 hover:text-white"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 space-y-3">
                <button
                  type="button"
                  className="w-full neu-raised p-4 rounded-2xl text-left hover:border-[#FFCC00]/30 border border-transparent transition-colors"
                  onClick={() => {
                    setIsAgentsPanelOpen(false);
                    setActiveTab('bas');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="neu-inset p-2 rounded-xl text-[#FFCC00]">
                      <Calculator className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-100">BAS Dashboard</h3>
                      <p className="text-xs text-zinc-500">GST calculations & quarterly BAS</p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="w-full neu-raised p-4 rounded-2xl text-left hover:border-[#FFCC00]/30 border border-transparent transition-colors"
                  onClick={() => {
                    setIsAgentsPanelOpen(false);
                    setActiveTab('tax');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="neu-inset p-2 rounded-xl text-emerald-400">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-100">Tax Dashboard</h3>
                      <p className="text-xs text-zinc-500">Income tax, CGT & deductions</p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="w-full neu-raised p-4 rounded-2xl text-left hover:border-[#FFCC00]/30 border border-transparent transition-colors"
                  onClick={() => {
                    setIsAgentsPanelOpen(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="neu-inset p-2 rounded-xl text-blue-400">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-100">Financial Analyst</h3>
                      <p className="text-xs text-zinc-500">Spending patterns & insights</p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="w-full neu-raised p-4 rounded-2xl text-left hover:border-[#FFCC00]/30 border border-transparent transition-colors"
                  onClick={() => {
                    setIsAgentsPanelOpen(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="neu-inset p-2 rounded-xl text-purple-400">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-100">Reconciliation</h3>
                      <p className="text-xs text-zinc-500">Find duplicates & verify balances</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )
      }

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <MerchantMemoryManager
        isOpen={isMerchantMemoryOpen}
        onClose={() => setIsMerchantMemoryOpen(false)}
      />

      {/* Footer - Only show on desktop or if scrolled to bottom on mobile views that support it */}
      <footer className="hidden md:block mt-16 py-8 border-t border-white/5 mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-zinc-600 font-medium">
            CBA Statement AI Parser • <span className="text-gradient-gold">Powered by GPT-4o</span>
          </p>
          <div className="mt-3 flex justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full cba-gold-bg opacity-40" />
            ))}
          </div>
        </div>
      </footer>

      <Toaster theme="dark" position="bottom-right" />
    </div >
  );
}

export default App;