import { useState, useMemo } from 'react';
import type { SortingState } from '@tanstack/react-table';
import type { Transaction } from '@/api';

interface UseTransactionFiltersParams {
  transactions: Transaction[];
}

export function useTransactionFilters({ transactions }: UseTransactionFiltersParams) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const categories = useMemo(
    () =>
      [
        'All',
        'Office Supplies',
        'Travel',
        'Meals',
        'Utilities',
        'Professional Fees',
        'Rent',
        'Software',
        'Uncategorized',
        ...new Set(transactions.map((t) => t.category || 'Uncategorized')),
      ]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort(),
    [transactions],
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const matchesCategory =
          selectedCategory === 'All' || (t.category || 'Uncategorized') === selectedCategory;
        const matchesStart = !startDate || t.date >= startDate;
        const matchesEnd = !endDate || t.date <= endDate;
        return matchesCategory && matchesStart && matchesEnd;
      }),
    [transactions, selectedCategory, startDate, endDate],
  );

  const hasActiveFilters = !!(startDate || endDate || selectedCategory !== 'All' || globalFilter);

  return {
    sorting,
    setSorting,
    globalFilter,
    setGlobalFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedCategory,
    setSelectedCategory,
    showFilters,
    setShowFilters,
    categories,
    filteredTransactions,
    hasActiveFilters,
  };
}
