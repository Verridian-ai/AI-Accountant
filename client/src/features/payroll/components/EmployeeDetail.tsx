import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  CreditCard,
  Shield,
  FileText,
  DollarSign,
  FolderOpen,
  Pencil,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  fetchEmployee,
  updateEmployee,
  fetchBankDetails,
  addBankDetails,
  fetchSuperFund,
  addSuperFund,
  fetchTaxDeclaration,
  submitTaxDeclaration,
  fetchPayStructure,
  setPayStructure,
} from '../../../api';

type DetailTab = 'personal' | 'bank' | 'super' | 'tax' | 'pay' | 'documents';

interface EmployeeDetailProps {
  employeeId: string;
  onBack: () => void;
}

const tabs: { id: DetailTab; label: string; icon: typeof User }[] = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'bank', label: 'Bank Details', icon: CreditCard },
  { id: 'super', label: 'Super', icon: Shield },
  { id: 'tax', label: 'Tax Declaration', icon: FileText },
  { id: 'pay', label: 'Pay Structure', icon: DollarSign },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
];

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Active' },
  terminated: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Terminated' },
  on_leave: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'On Leave' },
};

const typeLabels: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  casual: 'Casual',
  contractor: 'Contractor',
};

const SUPER_MIN_RATE = 11.5;

interface EmployeeRecord {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  tfn_masked?: string;
  employment_status?: string;
  employment_type?: string;
  [key: string]: unknown;
}

interface BankDetailRecord {
  bsb?: string;
  bsb_masked?: string;
  account_number?: string;
  account_number_masked?: string;
  account_name?: string;
  split_percentage?: number;
}

interface SuperFundRecord {
  fund_name?: string;
  fund_abn?: string;
  usi?: string;
  member_number?: string;
  contribution_rate?: number;
}

interface TaxDeclarationRecord {
  tax_free_threshold?: boolean;
  has_help_debt?: boolean;
  has_sfss_debt?: boolean;
  tax_offset_claimed?: boolean;
  dependants?: number;
}

interface PayStructureRecord {
  category_name?: string;
  pay_category_id?: string;
  rate_type?: string;
  rate_cents?: number;
  standard_hours?: number;
}

export function EmployeeDetail({ employeeId, onBack }: EmployeeDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('personal');
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetailRecord[]>([]);
  const [superFund, setSuperFund] = useState<SuperFundRecord | null>(null);
  const [taxDeclaration, setTaxDeclaration] = useState<TaxDeclarationRecord | null>(null);
  const [payStructure, setPayStructureData] = useState<PayStructureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const emp = await fetchEmployee(employeeId);
      setEmployee(emp);

      const [bank, sup, tax, pay] = await Promise.all([
        fetchBankDetails(employeeId).catch(() => ({ data: [] })),
        fetchSuperFund(employeeId).catch(() => ({ data: null })),
        fetchTaxDeclaration(employeeId).catch(() => null),
        fetchPayStructure(employeeId).catch(() => ({ data: [] })),
      ]);

      setBankDetails(bank.data ?? []);
      setSuperFund(sup.data ?? null);
      setTaxDeclaration(tax);
      setPayStructureData(pay.data ?? []);
    } catch (e) {
      console.error('Failed to load employee', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonal = async () => {
    try {
      await updateEmployee(employeeId, editData);
      setEmployee({ ...employee, ...editData });
      setEditing(null);
      setEditData({});
    } catch (e) {
      console.error('Failed to save', e);
    }
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditData({});
  };

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-8 space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white/5" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-white/5 rounded" />
            <div className="h-4 w-32 bg-white/5 rounded" />
          </div>
        </div>
        <div className="h-10 w-full bg-white/5 rounded" />
        <div className="h-64 w-full bg-white/5 rounded" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="neu-raised rounded-2xl p-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-zinc-400">Employee not found</p>
        <button onClick={onBack} className="mt-4 text-sm text-[#FFCC00] hover:underline">
          Back to list
        </button>
      </div>
    );
  }

  const status = statusStyles[employee.employment_status] ?? statusStyles.active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-14 w-14 rounded-full bg-[#FFCC00]/10 flex items-center justify-center text-xl font-bold text-[#FFCC00]">
          {employee.first_name?.[0]}
          {employee.last_name?.[0]}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">
            {employee.first_name} {employee.last_name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-zinc-400">
              {typeLabels[employee.employment_type] ?? employee.employment_type}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
            >
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 neu-inset rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-[#FFCC00]/10 text-[#FFCC00]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="neu-raised rounded-2xl p-6">
        {activeTab === 'personal' && (
          <PersonalTab
            employee={employee}
            editing={editing === 'personal'}
            editData={editData}
            onEdit={() => {
              setEditing('personal');
              setEditData({
                first_name: employee.first_name,
                last_name: employee.last_name,
                email: employee.email,
                phone: employee.phone,
                date_of_birth: employee.date_of_birth,
                address: employee.address,
              });
            }}
            onSave={handleSavePersonal}
            onCancel={handleCancelEdit}
            onFieldChange={(field, value) => setEditData({ ...editData, [field]: value })}
          />
        )}

        {activeTab === 'bank' && (
          <BankTab bankDetails={bankDetails} employeeId={employeeId} onRefresh={loadData} />
        )}

        {activeTab === 'super' && (
          <SuperTab superFund={superFund} employeeId={employeeId} onRefresh={loadData} />
        )}

        {activeTab === 'tax' && (
          <TaxTab taxDeclaration={taxDeclaration} employeeId={employeeId} onRefresh={loadData} />
        )}

        {activeTab === 'pay' && (
          <PayTab payStructure={payStructure} employeeId={employeeId} onRefresh={loadData} />
        )}

        {activeTab === 'documents' && (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">Documents</p>
            <p className="text-xs text-zinc-500 mt-1">
              Document management coming in a future update
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Personal Tab ─────────────────────────────────────────── */

function PersonalTab({
  employee,
  editing,
  editData,
  onEdit,
  onSave,
  onCancel,
  onFieldChange,
}: {
  employee: EmployeeRecord;
  editing: boolean;
  editData: Record<string, string>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const fields = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'date_of_birth', label: 'Date of Birth' },
    { key: 'address', label: 'Address' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Personal Information</h3>
        {!editing ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-[#FFCC00] border border-white/10 rounded-lg hover:border-[#FFCC00]/30 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white border border-white/10 rounded-lg transition-colors"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-black bg-[#FFCC00] rounded-lg hover:bg-[#FFCC00]/90 transition-colors"
            >
              <Check className="h-3 w-3" />
              Save
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {f.label}
            </label>
            {editing ? (
              <input
                type={f.key === 'date_of_birth' ? 'date' : 'text'}
                value={editData[f.key] ?? ''}
                onChange={(e) => onFieldChange(f.key, e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              />
            ) : (
              <p className="text-sm text-white mt-1">{employee[f.key] ?? '-'}</p>
            )}
          </div>
        ))}
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">TFN</label>
          <p className="text-sm text-white mt-1 font-mono">
            {employee.tfn_masked ?? '***-***-***'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Bank Details Tab ─────────────────────────────────────── */

function BankTab({
  bankDetails,
  employeeId,
  onRefresh,
}: {
  bankDetails: BankDetailRecord[];
  employeeId: string;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    bsb: '',
    account_number: '',
    account_name: '',
    split_percentage: '100',
  });

  const handleAdd = async () => {
    try {
      await addBankDetails(employeeId, {
        ...form,
        split_percentage: parseFloat(form.split_percentage),
      });
      setAdding(false);
      setForm({ bsb: '', account_number: '', account_name: '', split_percentage: '100' });
      onRefresh();
    } catch (e) {
      console.error('Failed to add bank details', e);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Bank Details</h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-[#FFCC00] border border-white/10 rounded-lg hover:border-[#FFCC00]/30 transition-colors"
        >
          + Add Account
        </button>
      </div>

      {bankDetails.length === 0 && !adding && (
        <p className="text-sm text-zinc-500 text-center py-8">No bank details on file</p>
      )}

      {bankDetails.map((bd, i) => (
        <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-zinc-500">BSB</p>
              <p className="text-sm text-white font-mono mt-0.5">{bd.bsb_masked ?? bd.bsb}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Account Number</p>
              <p className="text-sm text-white font-mono mt-0.5">
                {bd.account_number_masked ?? '****' + (bd.account_number?.slice(-4) ?? '****')}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Account Name</p>
              <p className="text-sm text-white mt-0.5">{bd.account_name}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Split %</p>
              <p className="text-sm text-white mt-0.5">{bd.split_percentage}%</p>
            </div>
          </div>
        </div>
      ))}

      {adding && (
        <div className="p-4 rounded-xl border border-[#FFCC00]/20 bg-[#FFCC00]/[0.02] space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              placeholder="BSB (6 digits)"
              value={form.bsb}
              onChange={(e) => setForm({ ...form, bsb: e.target.value })}
              maxLength={6}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
            <input
              placeholder="Account Number"
              value={form.account_number}
              onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
            <input
              placeholder="Account Name"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
            <input
              placeholder="Split %"
              type="number"
              value={form.split_percentage}
              onChange={(e) => setForm({ ...form, split_percentage: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs font-medium text-black bg-[#FFCC00] rounded-lg hover:bg-[#FFCC00]/90 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Super Fund Tab ───────────────────────────────────────── */

function SuperTab({
  superFund,
  employeeId,
  onRefresh,
}: {
  superFund: SuperFundRecord | null;
  employeeId: string;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(!superFund);
  const [form, setForm] = useState({
    fund_name: superFund?.fund_name ?? '',
    fund_abn: superFund?.fund_abn ?? '',
    usi: superFund?.usi ?? '',
    member_number: superFund?.member_number ?? '',
    contribution_rate: superFund?.contribution_rate ?? '11.5',
  });

  const handleSave = async () => {
    try {
      await addSuperFund(employeeId, {
        ...form,
        contribution_rate: parseFloat(form.contribution_rate),
      });
      setEditing(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to save super', e);
    }
  };

  const rate = parseFloat(form.contribution_rate) || 0;
  const isCompliant = rate >= SUPER_MIN_RATE;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Superannuation</h3>
        {!editing && superFund && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-[#FFCC00] border border-white/10 rounded-lg hover:border-[#FFCC00]/30 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {!superFund && !editing ? (
        <p className="text-sm text-zinc-500 text-center py-8">No super fund on file</p>
      ) : editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'fund_name', label: 'Fund Name', placeholder: 'e.g. Australian Super' },
              { key: 'fund_abn', label: 'Fund ABN (11 digits)', placeholder: '12345678901' },
              { key: 'usi', label: 'USI', placeholder: 'Unique Superannuation Identifier' },
              { key: 'member_number', label: 'Member Number', placeholder: 'Member #' },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {f.label}
                </label>
                <input
                  type="text"
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Contribution Rate (%)
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  step="0.5"
                  value={form.contribution_rate}
                  onChange={(e) => setForm({ ...form, contribution_rate: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isCompliant
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {isCompliant ? 'Compliant' : `Below ${SUPER_MIN_RATE}%`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {superFund && (
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium text-black bg-[#FFCC00] rounded-lg hover:bg-[#FFCC00]/90 transition-colors"
            >
              Save Super Fund
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-500">Fund Name</p>
            <p className="text-sm text-white mt-0.5">{superFund.fund_name}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Fund ABN</p>
            <p className="text-sm text-white font-mono mt-0.5">{superFund.fund_abn}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">USI</p>
            <p className="text-sm text-white mt-0.5">{superFund.usi ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Member Number</p>
            <p className="text-sm text-white mt-0.5">{superFund.member_number}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Contribution Rate</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-white">{superFund.contribution_rate}%</p>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  (superFund.contribution_rate ?? 0) >= SUPER_MIN_RATE
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {(superFund.contribution_rate ?? 0) >= SUPER_MIN_RATE
                  ? 'Compliant'
                  : `Below ${SUPER_MIN_RATE}%`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tax Declaration Tab ──────────────────────────────────── */

function TaxTab({
  taxDeclaration,
  employeeId,
  onRefresh,
}: {
  taxDeclaration: TaxDeclarationRecord | null;
  employeeId: string;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(!taxDeclaration);
  const [form, setForm] = useState({
    tax_free_threshold: taxDeclaration?.tax_free_threshold ?? true,
    has_help_debt: taxDeclaration?.has_help_debt ?? false,
    has_sfss_debt: taxDeclaration?.has_sfss_debt ?? false,
    tax_offset_claimed: taxDeclaration?.tax_offset_claimed ?? false,
    dependants: taxDeclaration?.dependants ?? 0,
  });

  const handleSave = async () => {
    try {
      await submitTaxDeclaration(employeeId, form);
      setEditing(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to save tax declaration', e);
    }
  };

  const checkboxField = (key: string, label: string) => (
    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
      <input
        type="checkbox"
        checked={form[key as keyof typeof form] as boolean}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
        disabled={!editing}
        className="h-4 w-4 rounded border-zinc-600 text-[#FFCC00] focus:ring-[#FFCC00]/40"
      />
      <span className="text-sm text-white">{label}</span>
    </label>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Tax Declaration</h3>
        {!editing && taxDeclaration && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-[#FFCC00] border border-white/10 rounded-lg hover:border-[#FFCC00]/30 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      <div className="space-y-3">
        {checkboxField('tax_free_threshold', 'Claim the tax-free threshold')}
        {checkboxField('has_help_debt', 'Has HELP / HECS debt')}
        {checkboxField('has_sfss_debt', 'Has SFSS debt')}
        {checkboxField('tax_offset_claimed', 'Claiming tax offset')}

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Number of Dependants
          </label>
          <input
            type="number"
            min="0"
            value={form.dependants}
            onChange={(e) => setForm({ ...form, dependants: parseInt(e.target.value) || 0 })}
            disabled={!editing}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40 disabled:opacity-60"
          />
        </div>
      </div>

      {editing && (
        <div className="flex gap-2 justify-end mt-4">
          {taxDeclaration && (
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium text-black bg-[#FFCC00] rounded-lg hover:bg-[#FFCC00]/90 transition-colors"
          >
            Save Declaration
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Pay Structure Tab ────────────────────────────────────── */

function PayTab({
  payStructure,
  employeeId,
  onRefresh,
}: {
  payStructure: PayStructureRecord[];
  employeeId: string;
  onRefresh: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Pay Structure</h3>
      </div>

      {payStructure.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No pay structure assigned</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                  Category
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                  Rate Type
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                  Rate
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                  Hours/Units
                </th>
              </tr>
            </thead>
            <tbody>
              {payStructure.map((ps, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-sm text-white">
                    {ps.category_name ?? ps.pay_category_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 capitalize">
                    {ps.rate_type ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white text-right font-mono">
                    ${((ps.rate_cents ?? 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 text-right">
                    {ps.standard_hours ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
