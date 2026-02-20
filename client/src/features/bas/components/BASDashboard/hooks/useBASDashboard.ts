import { useState, useEffect, useCallback, useMemo } from 'react';
import { basApi } from '@/api';
import type { BASCalculation, BASQuarter } from '@/types/tax';
import { getCurrentQuarter, getQuarterDates } from '../utils.js';

export interface QuarterOption {
  value: string;
  label: string;
  sublabel: string;
}

function apiQuarterToOption(fy: string, q: number): QuarterOption {
  const fyStartYear = parseInt(fy.split('-')[0], 10);
  const value = `${fyStartYear}-Q${q}`;
  const label = `Q${q} ${fy}`;
  const sublabel = getQuarterDates(fyStartYear, q as 1 | 2 | 3 | 4);
  return { value, label, sublabel };
}

export function useBASDashboard() {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [method, setMethod] = useState<'accrual' | 'cash'>('accrual');
  const [basData, setBASData] = useState<BASCalculation | null>(null);
  const [history, setHistory] = useState<BASQuarter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calculate' | 'breakdown' | 'history'>('calculate');
  const [availableQuarters, setAvailableQuarters] = useState<QuarterOption[]>([]);

  const autoCalculate = useCallback(async () => {
    if (!selectedQuarter) return;
    setCalculating(true);
    setError(null);
    try {
      const data = await basApi.calculateBAS(selectedQuarter, method);
      setBASData(data);
    } catch (err) {
      console.error('Auto-calculate BAS failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate BAS');
    } finally {
      setCalculating(false);
    }
  }, [selectedQuarter, method]);

  const loadAvailableQuarters = useCallback(async () => {
    try {
      const apiQuarters = await basApi.fetchQuarters();
      const options = apiQuarters.map((q) => apiQuarterToOption(q.financialYear, q.quarter));
      // Always include current quarter
      const { year, quarter } = getCurrentQuarter();
      const currentFy = `${year}-${(year + 1).toString().slice(2)}`;
      const currentValue = `${year}-Q${quarter}`;
      if (!options.some((o) => o.value === currentValue)) {
        options.push(apiQuarterToOption(currentFy, quarter));
      }
      // Sort descending by value (newest first)
      options.sort((a, b) => b.value.localeCompare(a.value));
      setAvailableQuarters(options);
    } catch (err) {
      console.error('Failed to load available quarters:', err);
      // Fallback: show current quarter only
      const { year, quarter } = getCurrentQuarter();
      const currentFy = `${year}-${(year + 1).toString().slice(2)}`;
      setAvailableQuarters([apiQuarterToOption(currentFy, quarter)]);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await basApi.fetchHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load BAS history:', err);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    void loadAvailableQuarters();
    const { year, quarter } = getCurrentQuarter();
    setSelectedQuarter(`${year}-Q${quarter}`);
  }, [loadHistory, loadAvailableQuarters]);

  // Auto-calculate when quarter or method changes
  useEffect(() => {
    if (selectedQuarter) {
      void autoCalculate();
    }
  }, [selectedQuarter, method, autoCalculate]);

  const calculateBAS = async () => {
    if (!selectedQuarter) return;
    setCalculating(true);
    setError(null);
    try {
      const data = await basApi.calculateBAS(selectedQuarter, method);
      setBASData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate BAS');
    } finally {
      setCalculating(false);
    }
  };

  const saveBAS = async () => {
    if (!selectedQuarter || !basData) return;
    setLoading(true);
    try {
      await basApi.saveBAS(selectedQuarter, basData);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save BAS');
    } finally {
      setLoading(false);
    }
  };

  const barChartData = useMemo(() => {
    if (!basData) return null;
    const sales = basData.g1_total_sales;
    const purchases = basData.g12_g10_plus_g11;
    const max = Math.max(sales, purchases, 1);
    return { sales, purchases, max };
  }, [basData]);

  const isRefund = basData ? basData.net_amount_payable <= 0 : false;
  const netAmount = basData ? Math.abs(basData.net_amount_payable || basData.net_refund) : 0;

  return {
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
  };
}
