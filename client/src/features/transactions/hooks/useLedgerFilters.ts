import { useState, useMemo, useCallback } from 'react';
import type { Transaction } from '../types/ledger';
import type { FilterState } from '../types/ledger';
import type { SortingState } from '@tanstack/react-table';
import { CATEGORY_NAMES } from '../constants/categories';

interface UseLedgerFiltersOptions {
  transactions: Transaction[];
}

interface UseLedgerFiltersReturn {
  // Filter state
  filters: FilterState;
  setFilters: {
    setStartDate: (date: string) => void;
    setEndDate: (date: string) => void;
    setSelectedCategory: (category: string) => void;
    setGlobalFilter: (filter: string) => void;
    setSelectedAccount: (account: string) => void;
  };

  // UI state
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;

  // Sorting
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;

  // Derived data
  filteredTransactions: Transaction[];
  categories: string[];
  hasActiveFilters: boolean;

  // Actions
  resetFilters: () => void;
}

export function useLedgerFilters({
  transactions,
}: UseLedgerFiltersOptions): UseLedgerFiltersReturn {
  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAccount, setSelectedAccount] = useState('All');
  const [globalFilter, setGlobalFilter] = useState('');

  // UI state
  const [showFilters, setShowFilters] = useState(false);

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([]);

  const categories = useMemo(() => {
    const transactionCategories = new Set(
      transactions.map((t) => t.category || 'Uncategorized')
    );

    const allCategories = new Set([
      ...CATEGORY_NAMES,
      ...transactionCategories,
    ]);

    const sorted = Array.from(allCategories)
      .filter((c) => c !== 'Uncategorized')
      .sort((a, b) => a.localeCompare(b));

    return ['All', ...sorted, 'Uncategorized'];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        (t.category || 'Uncategorized') === selectedCategory;

      const matchesStart = !startDate || t.date >= startDate;
      const matchesEnd = !endDate || t.date <= endDate;

      const matchesAccount =
        selectedAccount === 'All' || t.accountId === selectedAccount;

      return matchesCategory && matchesStart && matchesEnd && matchesAccount;
    });
  }, [transactions, selectedCategory, startDate, endDate, selectedAccount]);

  const hasActiveFilters = Boolean(
    startDate || endDate || selectedCategory !== 'All' || globalFilter || selectedAccount !== 'All'
  );

  const resetFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('All');
    setSelectedAccount('All');
    setGlobalFilter('');
    setShowFilters(false);
  }, []);

  const filters: FilterState = {
    startDate,
    endDate,
    selectedCategory,
    globalFilter,
    selectedAccount,
  };

  const setFilters = {
    setStartDate,
    setEndDate,
    setSelectedCategory,
    setGlobalFilter,
    setSelectedAccount,
  };

  return {
    filters,
    setFilters,
    showFilters,
    setShowFilters,
    sorting,
    setSorting,
    filteredTransactions,
    categories,
    hasActiveFilters,
    resetFilters,
  };
}
