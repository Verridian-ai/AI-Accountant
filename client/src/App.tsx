import { useEffect, useState, useCallback, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSSE } from './hooks/useSSE';
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
import { AppShell } from './components/layout/AppShell';
import { BASPage } from './features/bas/components/BASPage';
import { TaxDashboard } from './features/tax/components/TaxDashboard';
import { GSTPage } from './features/gst/components/GSTPage';
import { TransfersPage } from './features/transfers/components/TransfersPage';
import { AnalyticsDashboard } from './features/analytics/components/AnalyticsDashboard';
import { AccountManager } from './features/accounts/components/AccountManager';
import { AccountSummaryCards } from './features/accounts/components/AccountSummaryCards';
import { AccountBalanceTimeline } from './features/accounts/components/AccountBalanceTimeline';
import { LedgerPage } from './features/transactions/components/LedgerPage';
import { DashboardGrid } from './features/dashboards/components/DashboardGrid';
import { MigrationDashboard } from './features/streaming/components/MigrationDashboard';
import { SessionHistory } from './features/streaming/components/SessionHistory';
import { SchemaExplorer } from './features/streaming/components/SchemaExplorer';
import { StreamingChat } from './features/streaming/components/StreamingChat';
import { MarketDashboard } from './features/market';
import { TenantSwitcher } from './features/tenant/components/TenantSwitcher';
import { TenantSettings } from './features/tenant/components/TenantSettings';
import { MemberManager } from './features/tenant/components/MemberManager';
import { PermissionMatrix } from './features/tenant/components/PermissionMatrix';
import { TenantCreate } from './features/tenant/components/TenantCreate';
import { PlanComparison } from './features/subscription/components/PlanComparison';
import { UsageDashboard } from './features/subscription/components/UsageDashboard';
import { BillingHistory } from './features/subscription/components/BillingHistory';
import { PayrollDashboard } from './features/payroll/components/PayrollDashboard';
import { APDashboard } from './features/ap/components/APDashboard';
import { InvoicingDashboard } from './features/invoicing/components/InvoicingDashboard';
import { ReportsDashboard } from './features/reports/components/ReportsDashboard';
import { BudgetsDashboard } from './features/budgets/components/BudgetsDashboard';
import { ForecastDashboard as ForecastingPage } from './features/forecasting/components/ForecastDashboard';
import { ComplianceDashboard } from './features/compliance/components/ComplianceDashboard';
import { DocumentsDashboard } from './features/documents/components/DocumentsDashboard';
import { MatchingDashboard } from './features/matching/components/MatchingDashboard';
import { IntelligenceDashboard } from './features/intelligence/components/IntelligenceDashboard';
import { KnowledgeDashboard } from './features/knowledge/components/KnowledgeDashboard';
import { LoanDashboard } from './features/loans/components/LoanDashboard';
import { BankingProductsDashboard } from './features/banking-products/components/BankingProductsDashboard';
import { AssetsDashboard } from './features/assets/components/AssetsDashboard';
import { EntitiesDashboard } from './features/entities/components/EntitiesDashboard';
import { InventoryDashboard } from './features/inventory/components/InventoryDashboard';
import { ReconDashboard } from './features/reconciliation/components/ReconDashboard';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import { UpdatePrompt } from './components/pwa/UpdatePrompt';
import { PushPermissionPrompt, NotificationPreferences } from './features/notifications';
import { SyncStatus, ConflictResolver } from './features/offline';
import { api, getToken } from './api';
import type { Transaction, TransactionStats, Account } from './api';
import { TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react';

function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#FFCC00]/30 border-t-[#FFCC00] rounded-full animate-spin" />
    </div>
  );
}

function AppContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMerchantMemoryOpen, setIsMerchantMemoryOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);

  const [totalTransactions, setTotalTransactions] = useState(0);

  const handleLogin = (
    token: string,
    userData: { id: string; username: string },
    tenantId?: string | null,
  ) => {
    localStorage.setItem('token', token);
    if (tenantId) localStorage.setItem('tenantId', tenantId);
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
    setIsAuthenticated(false);
    setUser(null);
    setTransactions([]);
    setStats(null);
  };

  const refreshData = async () => {
    try {
      const PAGE_SIZE = 1000;
      const [firstPage, accts] = await Promise.all([
        api.fetchTransactions({ limit: PAGE_SIZE, offset: 0 }),
        api.fetchAccounts(),
      ]);

      const total = firstPage.total;
      let allTransactions = [...firstPage.transactions];

      if (total > PAGE_SIZE) {
        const offsets: number[] = [];
        for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
          offsets.push(offset);
        }
        const pages = await Promise.all(
          offsets.map((offset) => api.fetchTransactions({ limit: PAGE_SIZE, offset })),
        );
        for (const page of pages) {
          allTransactions = [...allTransactions, ...page.transactions];
        }
      }

      setTransactions(allTransactions);
      setTotalTransactions(total);
      setAccounts(accts);
      setStats(api.calculateStats(allTransactions));
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch data', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTransactions = async () => {
    // All transactions are loaded on startup via parallel pagination in refreshData
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

  const stableRefreshData = useCallback(() => {
    refreshData();
  }, [isAuthenticated]);

  useSSE(stableRefreshData);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshData();
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

  // Page elements for routes
  const dashboardPage = (
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTrendChart transactions={transactions} loading={loading} />
        <div className="hidden lg:block">
          <CategoryChart data={stats?.categoryBreakdown || {}} loading={loading} />
        </div>
      </div>
    </div>
  );

  const streamingPage = (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="neu-raised rounded-2xl p-6">
          <MigrationDashboard />
        </div>
        <div className="neu-raised rounded-2xl p-6">
          <StreamingChat agentType="budget_analyzer" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="neu-raised rounded-2xl p-6">
          <SessionHistory />
        </div>
        <div className="neu-raised rounded-2xl p-6">
          <SchemaExplorer />
        </div>
      </div>
    </div>
  );

  const accountsPage = (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountsOverview />
        <StatementList />
      </div>
      <AccountSummaryCards />
      <AccountBalanceTimeline />
      <AccountManager />
      <DebtReductionPlanner />
    </div>
  );

  const settingsPage = (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <TenantSettings />
      <MemberManager />
      <PermissionMatrix />
      <div className="border-t border-white/5 pt-8">
        <TenantCreate />
      </div>
    </div>
  );

  const subscriptionPage = (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <UsageDashboard />
      <PlanComparison currentPlan={localStorage.getItem('currentPlan') ?? 'starter'} />
      <BillingHistory />
    </div>
  );

  return (
    <AppShell
      username={user?.username}
      lastSynced={lastUpdated}
      loading={loading}
      onRefresh={refreshData}
      onLogout={handleLogout}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onOpenMerchantMemory={() => setIsMerchantMemoryOpen(true)}
      tenantSwitcher={<TenantSwitcher />}
    >
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={dashboardPage} />
          <Route
            path="/transactions"
            element={
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <LedgerPage
                  transactions={transactions}
                  accounts={accounts}
                  loading={loading}
                  onDataChange={refreshData}
                  totalTransactions={totalTransactions}
                  onLoadMore={loadMoreTransactions}
                />
              </div>
            }
          />
          <Route path="/accounts" element={accountsPage} />
          <Route
            path="/analytics"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <AnalyticsDashboard />
              </div>
            }
          />
          <Route
            path="/gst"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <GSTPage />
              </div>
            }
          />
          <Route
            path="/bas"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <BASPage />
              </div>
            }
          />
          <Route
            path="/transfers"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <TransfersPage />
              </div>
            }
          />
          <Route
            path="/tax"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <TaxDashboard />
              </div>
            }
          />
          <Route
            path="/dashboards"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <DashboardGrid />
              </div>
            }
          />
          <Route path="/streaming" element={streamingPage} />
          <Route
            path="/market"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <MarketDashboard />
              </div>
            }
          />
          <Route
            path="/payroll"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PayrollDashboard />
              </div>
            }
          />
          <Route
            path="/ap"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <APDashboard />
              </div>
            }
          />
          <Route
            path="/invoicing"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <InvoicingDashboard />
              </div>
            }
          />
          <Route path="/settings" element={settingsPage} />
          <Route path="/subscription" element={subscriptionPage} />
          <Route
            path="/settings/notifications"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <NotificationPreferences />
              </div>
            }
          />
          <Route
            path="/settings/sync"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <SyncStatus />
                <ConflictResolver />
              </div>
            }
          />

          {/* Wave 13–20 feature routes */}
          <Route
            path="/reports"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ReportsDashboard />
              </div>
            }
          />
          <Route
            path="/budgets"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <BudgetsDashboard />
              </div>
            }
          />
          <Route
            path="/forecasting"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ForecastingPage />
              </div>
            }
          />
          <Route
            path="/compliance"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ComplianceDashboard />
              </div>
            }
          />
          <Route
            path="/documents"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <DocumentsDashboard />
              </div>
            }
          />
          <Route
            path="/matching"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <MatchingDashboard />
              </div>
            }
          />
          <Route
            path="/intelligence"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <IntelligenceDashboard />
              </div>
            }
          />
          <Route
            path="/knowledge"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <KnowledgeDashboard />
              </div>
            }
          />
          <Route
            path="/loans"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <LoanDashboard />
              </div>
            }
          />
          <Route
            path="/banking-products"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <BankingProductsDashboard />
              </div>
            }
          />
          <Route
            path="/assets"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <AssetsDashboard />
              </div>
            }
          />
          <Route
            path="/entities"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <EntitiesDashboard />
              </div>
            }
          />
          <Route
            path="/inventory"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <InventoryDashboard />
              </div>
            }
          />
          <Route
            path="/reconciliation"
            element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ReconDashboard />
              </div>
            }
          />

          {/* Catch-all: redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <FloatingChat />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <MerchantMemoryManager
        isOpen={isMerchantMemoryOpen}
        onClose={() => setIsMerchantMemoryOpen(false)}
      />

      <InstallPrompt />
      <UpdatePrompt />
      <PushPermissionPrompt />
      <Toaster theme="dark" position="bottom-right" />
    </AppShell>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
