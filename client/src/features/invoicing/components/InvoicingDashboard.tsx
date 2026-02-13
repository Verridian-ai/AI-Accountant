import { useState, useEffect } from 'react';
import { invoicingApi } from '@/api';
import {
  FileText,
  Users,
  PlusCircle,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Loader2,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomerList } from './CustomerList';
import { CustomerDetail } from './CustomerDetail';
import { CustomerForm } from './CustomerForm';
import { InvoiceList } from './InvoiceList';
import { InvoiceEditor } from './InvoiceEditor';
import { InvoicePreview } from './InvoicePreview';
import { InvoicePDF } from './InvoicePDF';

type SubTab = 'customers' | 'invoices' | 'create';

const tabs: { id: SubTab; label: string; icon: typeof FileText }[] = [
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'create', label: 'Create Invoice', icon: PlusCircle },
];

interface SummaryStats {
  totalOutstanding: number;
  overdueCount: number;
  revenueThisMonth: number;
  totalCustomers: number;
}

const formatAUD = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function InvoicingDashboard() {
  const [activeTab, setActiveTab] = useState<SubTab>('customers');
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  // Invoice state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [invoiceViewLoading, setInvoiceViewLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const customersRes = await invoicingApi
        .listCustomers({ limit: 1000 })
        .catch(() => ({ customers: [], total: 0 }));
      const customers = customersRes?.customers ?? [];
      const totalOutstanding = customers.reduce(
        (sum: number, c: any) => sum + (c.outstandingBalance ?? 0),
        0,
      );
      const overdueCount = customers.filter((c: any) => (c.overdueAmount ?? 0) > 0).length;

      setStats({
        totalOutstanding,
        overdueCount,
        revenueThisMonth: 0,
        totalCustomers: customersRes?.total ?? customers.length,
      });
    } catch (err) {
      console.error('Failed to load invoicing stats:', err);
      setStats({ totalOutstanding: 0, overdueCount: 0, revenueThisMonth: 0, totalCustomers: 0 });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
  };

  const handleBackToList = () => {
    setSelectedCustomerId(null);
    setEditingCustomer(null);
  };

  const handleEditCustomer = (customer: any) => {
    setEditingCustomer(customer);
    setShowCustomerForm(true);
  };

  const handleCustomerSaved = () => {
    setShowCustomerForm(false);
    setEditingCustomer(null);
    setSelectedCustomerId(null);
  };

  const handleSelectInvoice = async (id: string) => {
    setSelectedInvoiceId(id);
    setInvoiceViewLoading(true);
    try {
      const inv = await invoicingApi.getInvoice(id);
      setViewingInvoice(inv);
    } catch (err) {
      console.error('Failed to load invoice:', err);
    } finally {
      setInvoiceViewLoading(false);
    }
  };

  const handleBackToInvoices = () => {
    setSelectedInvoiceId(null);
    setEditingInvoiceId(null);
    setViewingInvoice(null);
  };

  const handleInvoiceSaved = () => {
    setEditingInvoiceId(null);
    setActiveTab('invoices');
    loadStats();
  };

  const renderCustomerContent = () => {
    if (showCustomerForm) {
      return (
        <CustomerForm
          customer={editingCustomer}
          onSave={handleCustomerSaved}
          onCancel={() => {
            setShowCustomerForm(false);
            setEditingCustomer(null);
          }}
        />
      );
    }
    if (selectedCustomerId) {
      return (
        <CustomerDetail
          customerId={selectedCustomerId}
          onBack={handleBackToList}
          onEdit={handleEditCustomer}
        />
      );
    }
    return (
      <CustomerList
        onSelectCustomer={handleSelectCustomer}
        onAddCustomer={() => {
          setEditingCustomer(null);
          setShowCustomerForm(true);
        }}
      />
    );
  };

  const renderInvoiceContent = () => {
    // Viewing a specific invoice
    if (selectedInvoiceId && viewingInvoice && !editingInvoiceId) {
      if (invoiceViewLoading) {
        return (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
          </div>
        );
      }
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToInvoices}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Invoices
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingInvoiceId(selectedInvoiceId)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg neu-raised text-xs font-semibold text-zinc-200 hover:text-zinc-100 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
          <InvoicePDF
            invoiceId={viewingInvoice.id}
            invoiceNumber={viewingInvoice.invoiceNumber}
            status={viewingInvoice.status}
            onSent={() => handleSelectInvoice(selectedInvoiceId)}
          />
          <InvoicePreview
            invoice={{
              ...viewingInvoice,
              lineItems: (viewingInvoice.lineItems ?? []).map((li: any) => ({
                description: li.description ?? '',
                quantity: li.quantity ?? 1,
                unitPrice: li.unitPrice ?? 0,
                gstRate: li.gstRate ?? 0.1,
                amount: li.amount ?? 0,
                gstAmount: li.gstAmount ?? 0,
              })),
            }}
          />
        </div>
      );
    }

    // Editing an existing invoice
    if (editingInvoiceId) {
      return (
        <InvoiceEditor
          invoiceId={editingInvoiceId}
          onSave={handleInvoiceSaved}
          onCancel={handleBackToInvoices}
        />
      );
    }

    // Default: invoice list
    return (
      <InvoiceList
        onSelectInvoice={handleSelectInvoice}
        onCreateInvoice={() => setActiveTab('create')}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">
          Invoicing & Customers
        </h2>
        <p className="text-sm text-zinc-500">
          Manage customers, create invoices, and track payments
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="neu-raised rounded-2xl p-4 flex items-center gap-3">
          <div className="neu-inset p-2.5 rounded-xl text-[#FFCC00]">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider">
              Outstanding
            </p>
            {statsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mt-1" />
            ) : (
              <p className="text-lg font-bold text-gradient-gold">
                {formatAUD(stats?.totalOutstanding ?? 0)}
              </p>
            )}
          </div>
        </div>

        <div className="neu-raised rounded-2xl p-4 flex items-center gap-3">
          <div
            className={cn(
              'neu-inset p-2.5 rounded-xl',
              stats && stats.overdueCount > 0 ? 'text-red-400' : 'text-zinc-500',
            )}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider">
              Overdue
            </p>
            {statsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mt-1" />
            ) : (
              <p
                className={cn(
                  'text-lg font-bold',
                  stats && stats.overdueCount > 0 ? 'text-red-400' : 'text-zinc-300',
                )}
              >
                {stats?.overdueCount ?? 0}
              </p>
            )}
          </div>
        </div>

        <div className="neu-raised rounded-2xl p-4 flex items-center gap-3">
          <div className="neu-inset p-2.5 rounded-xl text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider">
              Revenue (Month)
            </p>
            {statsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mt-1" />
            ) : (
              <p className="text-lg font-bold text-emerald-400">
                {formatAUD(stats?.revenueThisMonth ?? 0)}
              </p>
            )}
          </div>
        </div>

        <div className="neu-raised rounded-2xl p-4 flex items-center gap-3">
          <div className="neu-inset p-2.5 rounded-xl text-zinc-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider">
              Customers
            </p>
            {statsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mt-1" />
            ) : (
              <p className="text-lg font-bold text-zinc-100">{stats?.totalCustomers ?? 0}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedCustomerId(null);
              setShowCustomerForm(false);
              setEditingCustomer(null);
              setSelectedInvoiceId(null);
              setEditingInvoiceId(null);
              setViewingInvoice(null);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300',
              activeTab === tab.id
                ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_20px_rgba(255,204,0,0.2)]'
                : 'neu-raised text-zinc-400 hover:text-zinc-100',
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'customers' && renderCustomerContent()}
        {activeTab === 'invoices' && renderInvoiceContent()}
        {activeTab === 'create' && (
          <InvoiceEditor onSave={handleInvoiceSaved} onCancel={() => setActiveTab('invoices')} />
        )}
      </div>
    </div>
  );
}
