import { useState, useEffect } from 'react';
import {
  FileText,
  ClipboardList,
  Users,
  Banknote,
  Plus,
  AlertTriangle,
  Clock,
  DollarSign,
  ShoppingCart,
} from 'lucide-react';
import { apApi } from '../../../api';
import type { APAgingReport } from '../../../api';
import { SupplierList } from './SupplierList';
import { SupplierDetail } from './SupplierDetail';
import { SupplierForm } from './SupplierForm';
import { BillEntry } from './BillEntry';
import { BillList } from './BillList';
import { BillApproval } from './BillApproval';
import { POList } from './POList';
import { PurchaseOrderEditor } from './PurchaseOrderEditor';
import { POReceiving } from './POReceiving';
import { SupplierPaymentRun } from './SupplierPaymentRun';

type APTab = 'bills' | 'purchase-orders' | 'suppliers' | 'payment-runs';
type View =
  | { type: 'list' }
  | { type: 'supplier-detail'; id: string }
  | { type: 'supplier-form'; id?: string }
  | { type: 'bill-entry'; id?: string }
  | { type: 'bill-approval'; id: string }
  | { type: 'po-editor'; id?: string }
  | { type: 'po-receiving'; id: string }
  | { type: 'payment-run' };

export function APDashboard() {
  const [activeTab, setActiveTab] = useState<APTab>('bills');
  const [view, setView] = useState<View>({ type: 'list' });
  const [aging, setAging] = useState<APAgingReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAging = async () => {
    try {
      const data = await apApi.fetchAPAging();
      setAging(data);
    } catch (e) {
      console.error('Failed to fetch AP aging', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAging();
  }, []);

  const handleTabChange = (tab: APTab) => {
    setActiveTab(tab);
    setView({ type: 'list' });
  };

  const tabs: { id: APTab; label: string; icon: typeof FileText }[] = [
    { id: 'bills', label: 'Bills', icon: FileText },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
    { id: 'suppliers', label: 'Suppliers', icon: Users },
    { id: 'payment-runs', label: 'Payment Runs', icon: Banknote },
  ];

  const overdueBucket = aging?.buckets.find(
    (b) => b.label === '61-90 days' || b.label === '90+ days',
  );
  const totalOverdue = aging
    ? aging.buckets
        .filter((b) => b.label.includes('61') || b.label.includes('90'))
        .reduce((sum, b) => sum + b.amount, 0)
    : 0;

  const statCards = [
    {
      label: 'Total Outstanding',
      value: aging ? formatCurrency(aging.totalOutstanding) : '$0.00',
      icon: DollarSign,
      color: 'text-blue-400',
    },
    {
      label: 'Total Overdue',
      value: formatCurrency(totalOverdue),
      icon: AlertTriangle,
      color: 'text-red-400',
    },
    {
      label: 'Bills Due This Week',
      value: aging?.buckets.find((b) => b.label === 'Current')?.count?.toString() ?? '0',
      icon: Clock,
      color: 'text-amber-400',
    },
    {
      label: 'Open POs',
      value: '—',
      icon: ShoppingCart,
      color: 'text-emerald-400',
    },
  ];

  const quickActions = [
    {
      label: 'New Bill',
      icon: FileText,
      action: () => {
        setActiveTab('bills');
        setView({ type: 'bill-entry' });
      },
    },
    {
      label: 'New PO',
      icon: ClipboardList,
      action: () => {
        setActiveTab('purchase-orders');
        setView({ type: 'po-editor' });
      },
    },
    {
      label: 'New Supplier',
      icon: Users,
      action: () => {
        setActiveTab('suppliers');
        setView({ type: 'supplier-form' });
      },
    },
    {
      label: 'Payment Run',
      icon: Banknote,
      action: () => {
        setActiveTab('payment-runs');
        setView({ type: 'payment-run' });
      },
    },
  ];

  // Sub-view renders
  if (view.type === 'supplier-detail') {
    return (
      <SupplierDetail
        supplierId={view.id}
        onBack={() => setView({ type: 'list' })}
        onEdit={(id) => setView({ type: 'supplier-form', id })}
      />
    );
  }

  if (view.type === 'supplier-form') {
    return (
      <SupplierForm
        supplierId={view.id}
        onSave={() => {
          setView({ type: 'list' });
          loadAging();
        }}
        onCancel={() => setView({ type: 'list' })}
      />
    );
  }

  if (view.type === 'bill-entry') {
    return (
      <BillEntry
        billId={view.id}
        onSave={() => {
          setView({ type: 'list' });
          loadAging();
        }}
        onCancel={() => setView({ type: 'list' })}
      />
    );
  }

  if (view.type === 'bill-approval') {
    return (
      <BillApproval
        billId={view.id}
        onBack={() => setView({ type: 'list' })}
        onAction={() => {
          setView({ type: 'list' });
          loadAging();
        }}
      />
    );
  }

  if (view.type === 'po-editor') {
    return (
      <PurchaseOrderEditor
        poId={view.id}
        onSave={() => {
          setView({ type: 'list' });
          loadAging();
        }}
        onCancel={() => setView({ type: 'list' })}
      />
    );
  }

  if (view.type === 'po-receiving') {
    return (
      <POReceiving
        poId={view.id}
        onBack={() => setView({ type: 'list' })}
        onReceived={() => {
          setView({ type: 'list' });
          loadAging();
        }}
      />
    );
  }

  if (view.type === 'payment-run') {
    return (
      <SupplierPaymentRun
        onBack={() => setView({ type: 'list' })}
        onComplete={() => {
          setView({ type: 'list' });
          loadAging();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts Payable</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage suppliers, bills, purchase orders, and payment runs
          </p>
        </div>
        <div className="flex gap-2">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={qa.action}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-zinc-300 hover:bg-[#FFCC00]/10 hover:text-[#FFCC00] transition-all border border-white/5"
            >
              <qa.icon className="h-3.5 w-3.5" />
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="neu-raised rounded-2xl p-5 animate-pulse">
                <div className="h-4 w-20 bg-white/5 rounded mb-3" />
                <div className="h-8 w-16 bg-white/5 rounded" />
              </div>
            ))
          : statCards.map((card) => (
              <div key={card.label} className="neu-raised rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    {card.label}
                  </span>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold text-white">{card.value}</p>
              </div>
            ))}
      </div>

      {/* AP Aging Mini-Chart */}
      {aging && aging.buckets.length > 0 && (
        <div className="neu-raised rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">AP Aging Distribution</h3>
          <div className="flex items-end gap-2 h-20">
            {aging.buckets.map((bucket) => {
              const maxAmount = Math.max(...aging.buckets.map((b) => b.amount));
              const height = maxAmount > 0 ? (bucket.amount / maxAmount) * 100 : 0;
              return (
                <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-[#FFCC00]/60 transition-all hover:bg-[#FFCC00]/80"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${bucket.label}: ${formatCurrency(bucket.amount)} (${bucket.count} bills)`}
                  />
                  <span className="text-[10px] text-zinc-500 truncate w-full text-center">
                    {bucket.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 neu-inset rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#FFCC00]/10 text-[#FFCC00] shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'bills' && (
        <BillList
          onNewBill={() => setView({ type: 'bill-entry' })}
          onEditBill={(id) => setView({ type: 'bill-entry', id })}
          onApproveBill={(id) => setView({ type: 'bill-approval', id })}
        />
      )}

      {activeTab === 'purchase-orders' && (
        <POList
          onNewPO={() => setView({ type: 'po-editor' })}
          onEditPO={(id) => setView({ type: 'po-editor', id })}
          onReceive={(id) => setView({ type: 'po-receiving', id })}
        />
      )}

      {activeTab === 'suppliers' && (
        <SupplierList
          onSelect={(id) => setView({ type: 'supplier-detail', id })}
          onNew={() => setView({ type: 'supplier-form' })}
        />
      )}

      {activeTab === 'payment-runs' && (
        <SupplierPaymentRun
          onBack={() => handleTabChange('bills')}
          onComplete={() => {
            handleTabChange('bills');
            loadAging();
          }}
        />
      )}
    </div>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100);
}
