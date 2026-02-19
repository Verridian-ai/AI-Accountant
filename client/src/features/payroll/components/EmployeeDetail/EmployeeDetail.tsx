import { ArrowLeft, FolderOpen, AlertCircle } from 'lucide-react';
import { tabs, statusStyles, typeLabels } from './constants.js';
import { useEmployeeData } from './hooks/useEmployeeData.js';
import { PersonalTab } from './tabs/PersonalTab.js';
import { BankTab } from './tabs/BankTab.js';
import { SuperTab } from './tabs/SuperTab.js';
import { TaxTab } from './tabs/TaxTab.js';
import { PayTab } from './tabs/PayTab.js';
import type { EmployeeDetailProps } from './types.js';

export function EmployeeDetail({ employeeId, onBack }: EmployeeDetailProps) {
  const {
    activeTab,
    setActiveTab,
    employee,
    bankDetails,
    superFund,
    taxDeclaration,
    payStructure,
    loading,
    editing,
    setEditing,
    editData,
    setEditData,
    loadData,
    handleSavePersonal,
    handleCancelEdit,
  } = useEmployeeData(employeeId);

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-8 space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-overlay" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-overlay rounded" />
            <div className="h-4 w-32 bg-overlay rounded" />
          </div>
        </div>
        <div className="h-10 w-full bg-overlay rounded" />
        <div className="h-64 w-full bg-overlay rounded" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="neu-raised rounded-2xl p-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-secondary">Employee not found</p>
        <button onClick={onBack} className="mt-4 text-sm text-cba-gold hover:underline">
          Back to list
        </button>
      </div>
    );
  }

  const status = statusStyles[employee.employment_status ?? 'active'] ?? statusStyles.active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-overlay text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-14 w-14 rounded-full bg-cba-gold/10 flex items-center justify-center text-xl font-bold text-cba-gold">
          {employee.first_name?.[0]}
          {employee.last_name?.[0]}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-primary">
            {employee.first_name} {employee.last_name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-secondary">
              {typeLabels[employee.employment_type ?? ''] ?? employee.employment_type}
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
                ? 'bg-cba-gold/10 text-cba-gold'
                : 'text-secondary hover:text-primary'
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
                first_name: String(employee.first_name ?? ''),
                last_name: String(employee.last_name ?? ''),
                email: String(employee.email ?? ''),
                phone: String(employee.phone ?? ''),
                date_of_birth: String(employee.date_of_birth ?? ''),
                address: String(employee.address ?? ''),
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
            <p className="text-secondary font-medium">Documents</p>
            <p className="text-xs text-muted mt-1">
              Document management coming in a future update
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
