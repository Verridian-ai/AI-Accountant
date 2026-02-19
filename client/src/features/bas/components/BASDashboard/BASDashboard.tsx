import { Calculator, BarChart3, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBASDashboard } from './hooks/useBASDashboard.js';
import { CalculateTab } from './tabs/CalculateTab.js';
import { GSTBreakdownTab } from './tabs/GSTBreakdownTab.js';
import { HistoryTab } from './tabs/HistoryTab.js';

export function BASDashboard() {
  const {
    loading,
    calculating,
    selectedQuarter,
    setSelectedQuarter,
    method,
    setMethod,
    basData,
    setBASData,
    history,
    error,
    activeTab,
    setActiveTab,
    calculateBAS,
    saveBAS,
    barChartData,
    isRefund,
    netAmount,
    availableQuarters,
  } = useBASDashboard();

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg sm:text-xl font-black text-gradient-gold tracking-tight">
          Business Activity Statement
        </h2>
        <p className="text-[10px] sm:text-[11px] text-muted">
          Calculate and manage your quarterly BAS returns for the ATO
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 neu-inset rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
        {(
          [
            { id: 'calculate' as const, label: 'Calculate', icon: Calculator },
            { id: 'breakdown' as const, label: 'GST', labelFull: 'GST Breakdown', icon: BarChart3 },
            { id: 'history' as const, label: 'History', icon: History },
          ] as const
        ).map(({ id, label, labelFull, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap',
              activeTab === id
                ? 'bg-cba-gold text-base'
                : 'text-muted hover:text-primary',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {labelFull ? (
              <>
                <span className="hidden sm:inline">{labelFull}</span>
                <span className="sm:hidden">{label}</span>
              </>
            ) : (
              label
            )}
          </button>
        ))}
      </div>

      {activeTab === 'calculate' && (
        <CalculateTab
          calculating={calculating}
          loading={loading}
          selectedQuarter={selectedQuarter}
          setSelectedQuarter={setSelectedQuarter}
          method={method}
          setMethod={setMethod}
          basData={basData}
          setBASData={setBASData}
          error={error}
          barChartData={barChartData}
          isRefund={isRefund}
          netAmount={netAmount}
          onCalculate={calculateBAS}
          onSave={saveBAS}
          availableQuarters={availableQuarters}
        />
      )}

      {activeTab === 'breakdown' && (
        <GSTBreakdownTab basData={basData} isRefund={isRefund} netAmount={netAmount} />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          history={history}
          availableQuarters={availableQuarters}
          setSelectedQuarter={setSelectedQuarter}
          setActiveTab={setActiveTab}
          onCalculate={calculateBAS}
        />
      )}
    </div>
  );
}
