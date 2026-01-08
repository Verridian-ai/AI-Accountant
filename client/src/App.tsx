import { useEffect, useState } from 'react';
import { TransactionTable } from './components/TransactionTable';
import { ChatInterface } from './components/ChatInterface';
import { StatCard } from './components/StatCard';
import { StatementList } from './components/StatementList';
import { CategoryChart } from './components/CategoryChart';
import { MonthlyTrendChart } from './components/MonthlyTrendChart';
import { api } from './api';
import type { Transaction, TransactionStats } from './api';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  RefreshCw
} from 'lucide-react';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshData = async () => {
    try {
      const txs = await api.fetchTransactions();
      setTransactions(txs);
      setStats(api.calculateStats(txs));
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-2.5 rounded-xl shadow-md">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">CBA Statement AI</h1>
              <p className="text-xs text-gray-400">Intelligent Bank Statement Parser</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={refreshData}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Income"
            value={stats ? formatCurrency(stats.totalIncome) : '$0.00'}
            subtitle="Credits received"
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="Total Expenses"
            value={stats ? formatCurrency(stats.totalExpenses) : '$0.00'}
            subtitle="Debits made"
            icon={TrendingDown}
            trend="down"
          />
          <StatCard
            title="Net Cash Flow"
            value={stats ? formatCurrency(stats.netFlow) : '$0.00'}
            subtitle="Income - Expenses"
            icon={Wallet}
            trend={stats && stats.netFlow >= 0 ? 'up' : 'down'}
          />
          <StatCard
            title="Transactions"
            value={stats?.transactionCount.toString() || '0'}
            subtitle="Total processed"
            icon={Receipt}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Transactions Table */}
          <div className="lg:col-span-2 space-y-6">
            <TransactionTable
              transactions={transactions}
              loading={loading}
              onDataChange={refreshData}
            />
          </div>


          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            <StatementList />
            <MonthlyTrendChart transactions={transactions} />
            <CategoryChart data={stats?.categoryBreakdown || {}} />
            <ChatInterface />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-400">
          CBA Statement AI Parser • Powered by GPT-4o
        </div>
      </footer>
    </div>
  );
}

export default App;
