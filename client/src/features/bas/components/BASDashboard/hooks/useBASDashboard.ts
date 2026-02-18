import { useState, useEffect, useMemo } from 'react';
import { basApi } from '@/api';
import type { BASCalculation, BASQuarter } from '@/types/tax';
import { getCurrentQuarter } from '../utils.js';

export function useBASDashboard() {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [method, setMethod] = useState<'accrual' | 'cash'>('accrual');
  const [basData, setBASData] = useState<BASCalculation | null>(null);
  const [history, setHistory] = useState<BASQuarter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calculate' | 'breakdown' | 'history'>('calculate');

  useEffect(() => {
    loadHistory();
    const { year, quarter } = getCurrentQuarter();
    setSelectedQuarter(`${year}-Q${quarter}`);
  }, []);

  // Auto-calculate when quarter or method changes
  useEffect(() => {
    if (selectedQuarter) {
      autoCalculate();
    }
  }, [selectedQuarter, method]);

  const autoCalculate = async () => {
    if (!selectedQuarter) return;
    setCalculating(true);
    setError(null);
    try {
      const data = await basApi.calculateBAS(selectedQuarter, method);
      setBASData(data);
    } catch (err) {
      console.error('Auto-calculate BAS failed:', err);
    } finally {
      setCalculating(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await basApi.fetchHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load BAS history:', err);
    }
  };

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
  };
}
