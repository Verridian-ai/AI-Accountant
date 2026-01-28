import { useState, useMemo, useCallback } from 'react';
import type { Transaction } from '../types/ledger';
import type { FilterState } from '../types/ledger';
import type { SortingState } from '@tanstack/react-table';

/**
 * Default categories that are always available in the filter dropdown.
 * These are displayed even if no transactions have these categories.
 */
const DEFAULT_CATEGORIES = [
  'Office Supplies',
  'Travel',
  'Meals',
  'Utilities',
  'Professional Fees',
  'Rent',
  'Software',
  'Uncategorized',
] as const;

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

/**
 * Custom hook for managing ledger filter state and logic.
 *
 * Extracts all filter-related functionality from TransactionTable including:
 * - Date range filtering (startDate, endDate)
 * - Category filtering
 * - Global text search
 * - Table sorting state
 * - Filter visibility toggle
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   setFilters,
 *   filteredTransactions,
 *   categories,
 *   hasActiveFilters,
 *   resetFilters,
 * } = useLedgerFilters({ transactions });
 * ```
 */
export function useLedgerFilters({
  transactions,
}: UseLedgerFiltersOptions): UseLedgerFiltersReturn {
  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [globalFilter, setGlobalFilter] = useState('');

  // UI state
  const [showFilters, setShowFilters] = useState(false);

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([]);

  /**
   * Memoized list of available categories.
   * Combines default categories with any unique categories from transactions.
   * Always has 'All' as the first option, followed by alphabetically sorted categories.
   */
  const categories = useMemo(() => {
    // Collect unique categories from transactions
    const transactionCategories = new Set(
      transactions.map((t) => t.category || 'Uncategorized')
    );

    // Combine with default categories
    const allCategories = new Set([
      ...DEFAULT_CATEGORIES,
      ...transactionCategories,
    ]);

    // Sort alphabetically and prepend 'All'
    const sortedCategories = Array.from(allCategories).sort();

    return ['All', ...sortedCategories];
  }, [transactions]);

  /**
   * Memoized filtered transactions based on current filter state.
   * Applies category, start date, and end date filters.
   * Note: Global filter is handled separately by react-table.
   */
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Category filter
      const matchesCategory =
        selectedCategory === 'All' ||
        (t.category || 'Uncategorized') === selectedCategory;

      // Date range filters
      const matchesStart = !startDate || t.date >= startDate;
      const matchesEnd = !endDate || t.date <= endDate;

      return matchesCategory && matchesStart && matchesEnd;
    });
  }, [transactions, selectedCategory, startDate, endDate]);

  /**
   * Computed property indicating whether any filters are currently active.
   * Used to show filter badge indicators and determine filter panel visibility.
   */
  const hasActiveFilters = Boolean(
    startDate || endDate || selectedCategory !== 'All' || globalFilter
  );

  /**
   * Reset all filters to their default state.
   * Clears date range, category selection, and global search.
   * Also hides the filter panel.
   */
  const resetFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('All');
    setGlobalFilter('');
    setShowFilters(false);
  }, []);

  // Bundle filter state for cleaner API
  const filters: FilterState = {
    startDate,
    endDate,
    selectedCategory,
    globalFilter,
  };

  // Bundle setters for cleaner API
  const setFilters = {
    setStartDate,
    setEndDate,
    setSelectedCategory,
    setGlobalFilter,
  };

  return {
    // Filter state
    filters,
    setFilters,

    // UI state
    showFilters,
    setShowFilters,

    // Sorting
    sorting,
    setSorting,

    // Derived data
    filteredTransactions,
    categories,
    hasActiveFilters,

    // Actions
    resetFilters,
  };
}
