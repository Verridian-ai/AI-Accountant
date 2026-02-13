import { useState, useEffect } from 'react';
import { Users, UserPlus, Briefcase, UserX, Clock } from 'lucide-react';
import { fetchEmployees } from '../../../api';
import { EmployeeList } from './EmployeeList';
import { EmployeeDetail } from './EmployeeDetail';
import { EmployeeOnboarding } from './EmployeeOnboarding';

type PayrollTab = 'employees' | 'pay-categories' | 'pay-runs';
type View = 'list' | 'detail' | 'onboarding';

interface EmployeeSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employment_type: string;
  employment_status: string;
  start_date: string;
  position?: string;
}

export function PayrollDashboard() {
  const [activeTab, setActiveTab] = useState<PayrollTab>('employees');
  const [view, setView] = useState<View>('list');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const result = await fetchEmployees('default');
      setEmployees(result.data);
      setTotal(result.total);
    } catch (e) {
      console.error('Failed to fetch employees', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const stats = {
    total: total,
    active: employees.filter((e) => e.employment_status === 'active').length,
    onLeave: employees.filter((e) => e.employment_status === 'on_leave').length,
    terminated: employees.filter((e) => e.employment_status === 'terminated').length,
  };

  const handleSelectEmployee = (id: string) => {
    setSelectedEmployeeId(id);
    setView('detail');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedEmployeeId(null);
    loadEmployees();
  };

  const handleOnboardingComplete = () => {
    setView('list');
    loadEmployees();
  };

  const tabs: { id: PayrollTab; label: string }[] = [
    { id: 'employees', label: 'Employees' },
    { id: 'pay-categories', label: 'Pay Categories' },
    { id: 'pay-runs', label: 'Pay Runs' },
  ];

  const statCards = [
    { label: 'Total Employees', value: stats.total, icon: Users, color: 'text-blue-400' },
    { label: 'Active', value: stats.active, icon: Briefcase, color: 'text-emerald-400' },
    { label: 'On Leave', value: stats.onLeave, icon: Clock, color: 'text-amber-400' },
    { label: 'Terminated', value: stats.terminated, icon: UserX, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage employees, pay categories, and pay runs
          </p>
        </div>
        {activeTab === 'employees' && view === 'list' && (
          <button
            onClick={() => setView('onboarding')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFCC00] text-black font-semibold text-sm hover:bg-[#FFCC00]/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
          >
            <UserPlus className="h-4 w-4" />
            Add Employee
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="neu-raised rounded-2xl p-5 animate-pulse">
                <div className="h-4 w-20 bg-white/5 rounded mb-3" />
                <div className="h-8 w-12 bg-white/5 rounded" />
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

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 neu-inset rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'employees') {
                setView('list');
                setSelectedEmployeeId(null);
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#FFCC00]/10 text-[#FFCC00] shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'employees' && (
        <>
          {view === 'list' && (
            <EmployeeList
              employees={employees}
              loading={loading}
              onSelect={handleSelectEmployee}
              onRefresh={loadEmployees}
            />
          )}
          {view === 'detail' && selectedEmployeeId && (
            <EmployeeDetail employeeId={selectedEmployeeId} onBack={handleBackToList} />
          )}
          {view === 'onboarding' && (
            <EmployeeOnboarding onComplete={handleOnboardingComplete} onCancel={handleBackToList} />
          )}
        </>
      )}

      {activeTab === 'pay-categories' && (
        <div className="neu-raised rounded-2xl p-8 text-center">
          <p className="text-zinc-400">Pay Categories component loads here</p>
          <p className="text-xs text-zinc-500 mt-1">Managed by Agent 9</p>
        </div>
      )}

      {activeTab === 'pay-runs' && (
        <div className="neu-raised rounded-2xl p-8 text-center">
          <Briefcase className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">Pay Runs</p>
          <p className="text-xs text-zinc-500 mt-1">Coming soon in a future wave</p>
        </div>
      )}
    </div>
  );
}
