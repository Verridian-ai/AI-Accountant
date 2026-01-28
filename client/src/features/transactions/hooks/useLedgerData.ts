import { useCallback } from 'react';
import { BASE_URL } from '@/api';
import type { FilterState } from '../types/ledger';

interface UseLedgerDataOptions {
  filters: FilterState;
}

export function useLedgerData({ filters }: UseLedgerDataOptions) {
  const handleExport = useCallback((format: 'csv' | 'xlsx') => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.selectedCategory && filters.selectedCategory !== 'All') {
      params.append('category', filters.selectedCategory);
    }
    if (filters.globalFilter) params.append('search', filters.globalFilter);

    // FIX: Use BASE_URL instead of hardcoded localhost:3000
    window.open(`${BASE_URL}/api/transactions/export?${params.toString()}`, '_blank');
  }, [filters]);

  return {
    handleExport,
  };
}
