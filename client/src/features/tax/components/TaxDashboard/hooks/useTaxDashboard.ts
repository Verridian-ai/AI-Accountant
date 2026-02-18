import { useState, useEffect } from 'react';
import { taxApi } from '@/api';
import type {
  TaxCalculationResult,
  TaxSummary,
  Deduction,
  CGTAsset,
  CGTEvent,
  DepreciableAsset,
} from '@/api';
import { getCurrentTaxYear } from '../helpers.js';

export function useTaxDashboard() {
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(getCurrentTaxYear());
  const [grossIncome, setGrossIncome] = useState('');
  const [entityType, setEntityType] = useState<'individual' | 'company' | 'trust' | 'super_fund'>(
    'individual',
  );
  const [hasPrivateHealth, setHasPrivateHealth] = useState(false);
  const [taxResult, setTaxResult] = useState<TaxCalculationResult | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [cgtAssets, setCgtAssets] = useState<CGTAsset[]>([]);
  const [cgtEvents, setCgtEvents] = useState<CGTEvent[]>([]);
  const [depreciableAssets, setDepreciableAssets] = useState<DepreciableAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTaxData();
  }, [selectedYear]);

  const loadTaxData = async () => {
    setLoading(true);
    try {
      const [summary, deductionsList, assets, events, depreciation] = await Promise.all([
        taxApi.fetchTaxSummary(selectedYear),
        taxApi.fetchDeductions(selectedYear),
        taxApi.fetchCGTAssets(),
        taxApi.fetchCGTEvents(selectedYear),
        taxApi.fetchDepreciableAssets(),
      ]);
      setTaxSummary(summary);
      setDeductions(deductionsList);
      setCgtAssets(assets);
      setCgtEvents(events);
      setDepreciableAssets(depreciation);

      if (summary && summary.grossIncomeCents > 0) {
        const incomeDollars = (summary.grossIncomeCents / 100).toFixed(0);
        setGrossIncome(incomeDollars);
        try {
          const result = await taxApi.calculateTax(
            selectedYear,
            summary.grossIncomeCents,
            entityType,
            hasPrivateHealth,
          );
          setTaxResult(result);
        } catch (calcErr) {
          console.error('Auto tax calc failed:', calcErr);
        }
      }
    } catch (err) {
      console.error('Failed to load tax data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTax = async () => {
    if (!grossIncome) return;
    setLoading(true);
    setError(null);
    try {
      const incomeInCents = Math.round(parseFloat(grossIncome) * 100);
      const result = await taxApi.calculateTax(
        selectedYear,
        incomeInCents,
        entityType,
        hasPrivateHealth,
      );
      setTaxResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate tax');
    } finally {
      setLoading(false);
    }
  };

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amountCents, 0);
  const totalCGT = cgtEvents.reduce(
    (sum, e) => sum + e.capitalGainNetCents - e.capitalLossCents,
    0,
  );

  return {
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
  };
}
