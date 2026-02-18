import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Building2, TrendingUp, Receipt, PiggyBank } from 'lucide-react';
import { useTaxDashboard } from './hooks/useTaxDashboard.js';
import { generateTaxYears } from './helpers.js';
import { TaxCalculatorTab } from './tabs/TaxCalculatorTab.js';
import { DeductionsTab } from './tabs/DeductionsTab.js';
import { CGTTab } from './tabs/CGTTab.js';
import { DepreciationTab } from './tabs/DepreciationTab.js';
import { TaxSummaryTab } from './tabs/TaxSummaryTab.js';

export function TaxDashboard() {
  const {
    loading,
    selectedYear,
    setSelectedYear,
    grossIncome,
    setGrossIncome,
    entityType,
    setEntityType,
    hasPrivateHealth,
    setHasPrivateHealth,
    taxResult,
    taxSummary,
    deductions,
    cgtAssets,
    cgtEvents,
    depreciableAssets,
    error,
    calculateTax,
    totalDeductions,
    totalCGT,
  } = useTaxDashboard();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight">Tax Return</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Calculate and manage your annual tax return
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
            <SelectValue placeholder="Tax Year" />
          </SelectTrigger>
          <SelectContent>
            {generateTaxYears().map((year) => (
              <SelectItem key={year} value={year} className="min-h-[44px]">
                FY {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="calculator" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 overflow-x-auto">
          <TabsTrigger value="calculator" className="min-h-[44px]">
            <Calculator className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Calculator</span>
            <span className="sm:hidden">Calc</span>
          </TabsTrigger>
          <TabsTrigger value="deductions" className="min-h-[44px]">
            <Receipt className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Deductions</span>
            <span className="sm:hidden">Ded.</span>
          </TabsTrigger>
          <TabsTrigger value="cgt" className="min-h-[44px]">
            <TrendingUp className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Capital Gains</span>
            <span className="sm:hidden">CGT</span>
          </TabsTrigger>
          <TabsTrigger value="depreciation" className="min-h-[44px]">
            <Building2 className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Depreciation</span>
            <span className="sm:hidden">Dep.</span>
          </TabsTrigger>
          <TabsTrigger value="summary" className="min-h-[44px]">
            <PiggyBank className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Summary</span>
            <span className="sm:hidden">Sum.</span>
          </TabsTrigger>
        </TabsList>

        <TaxCalculatorTab
          loading={loading}
          grossIncome={grossIncome}
          setGrossIncome={setGrossIncome}
          entityType={entityType}
          setEntityType={setEntityType}
          hasPrivateHealth={hasPrivateHealth}
          setHasPrivateHealth={setHasPrivateHealth}
          taxResult={taxResult}
          error={error}
          selectedYear={selectedYear}
          onCalculate={calculateTax}
        />

        <DeductionsTab
          deductions={deductions}
          totalDeductions={totalDeductions}
          selectedYear={selectedYear}
        />

        <CGTTab
          cgtAssets={cgtAssets}
          cgtEvents={cgtEvents}
          totalCGT={totalCGT}
          selectedYear={selectedYear}
        />

        <DepreciationTab depreciableAssets={depreciableAssets} />

        <TaxSummaryTab taxSummary={taxSummary} selectedYear={selectedYear} />
      </Tabs>
    </div>
  );
}
