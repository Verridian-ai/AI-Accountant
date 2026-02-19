import { useState, useCallback, useMemo } from 'react';
import type { Transaction, SplitEntry } from '../types/ledger';
import { api } from '@/api';

interface UseTransactionSplitOptions {
  onDataChange?: () => void;
}

interface UseTransactionSplitReturn {
  /** The transaction currently being split, or null if none */
  splittingTx: Transaction | null;
  /** Current split entries */
  splits: SplitEntry[];
  /** Update the splits array directly */
  setSplits: (splits: SplitEntry[]) => void;
  /** Start splitting a transaction - initializes with two equal splits */
  handleSplitStart: (tx: Transaction) => void;
  /** Save the split to the server */
  handleSplitSave: () => Promise<void>;
  /** Cancel the split operation */
  handleSplitCancel: () => void;
  /** Add a new empty split entry */
  addSplit: () => void;
  /** Remove a split entry by index */
  removeSplit: (index: number) => void;
  /** Update a specific split entry */
  updateSplit: (index: number, updates: Partial<SplitEntry>) => void;
  /** Total amount across all splits (in cents) */
  totalSplitAmount: number;
  /** Remaining amount to allocate (in cents) - can be negative if over-allocated */
  remainingAmount: number;
  /** Whether the splits are balanced (total equals original amount) */
  isBalanced: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Error message from the last operation, if any */
  error: string | null;
  /** Clear the current error */
  clearError: () => void;
}

/**
 * Hook for managing transaction split operations.
 *
 * Handles the state and logic for splitting a single transaction
 * into multiple entries with different categories/amounts.
 *
 * @example
 * ```tsx
 * const {
 *   splittingTx,
 *   splits,
 *   handleSplitStart,
 *   handleSplitSave,
 *   addSplit,
 *   updateSplit,
 *   isBalanced
 * } = useTransactionSplit({ onDataChange: refetch });
 *
 * // Start splitting
 * handleSplitStart(transaction);
 *
 * // Update a split amount
 * updateSplit(0, { amount: 5000 }); // $50.00 in cents
 *
 * // Add another split
 * addSplit();
 *
 * // Save when balanced
 * if (isBalanced) await handleSplitSave();
 * ```
 */
export function useTransactionSplit({
  onDataChange,
}: UseTransactionSplitOptions = {}): UseTransactionSplitReturn {
  const [splittingTx, setSplittingTx] = useState<Transaction | null>(null);
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Start splitting a transaction.
   * Initializes with two splits, each getting half the amount.
   */
  const handleSplitStart = useCallback((tx: Transaction) => {
    setSplittingTx(tx);
    setError(null);
    // Initialize with two splits, each getting half (first gets floor, second gets remainder)
    const halfAmount = Math.floor(tx.amount / 2);
    setSplits([
      {
        id: crypto.randomUUID(),
        category: tx.category || 'Uncategorized',
        amount: halfAmount,
        description: tx.description,
        gst: tx.gstApplicable,
      },
      {
        id: crypto.randomUUID(),
        category: 'Uncategorized',
        amount: tx.amount - halfAmount,
        description: tx.description,
        gst: tx.gstApplicable,
      },
    ]);
  }, []);

  /**
   * Cancel the split operation and reset state.
   */
  const handleSplitCancel = useCallback(() => {
    setSplittingTx(null);
    setSplits([]);
    setError(null);
  }, []);

  /**
   * Save the split to the server.
   * Validates that the total split amount equals the original transaction amount.
   */
  const handleSplitSave = useCallback(async () => {
    if (!splittingTx) return;

    const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
    if (totalSplit !== splittingTx.amount) {
      const errorMsg = `Total split amount ($${(totalSplit / 100).toFixed(2)}) must equal original amount ($${(splittingTx.amount / 100).toFixed(2)})`;
      setError(errorMsg);
      console.error(errorMsg);
      return;
    }

    // Validate no empty or zero amounts
    const hasInvalidSplit = splits.some((s) => s.amount <= 0);
    if (hasInvalidSplit) {
      const errorMsg = 'All split amounts must be greater than zero';
      setError(errorMsg);
      console.error(errorMsg);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await api.splitTransaction(splittingTx.id, splits);
      setSplittingTx(null);
      setSplits([]);
      onDataChange?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to split transaction';
      setError(errorMsg);
      console.error('Failed to split transaction', err);
    } finally {
      setIsSaving(false);
    }
  }, [splittingTx, splits, onDataChange]);

  /**
   * Add a new split entry with zero amount.
   */
  const addSplit = useCallback(() => {
    if (!splittingTx) return;

    setSplits((prev) => [
      ...prev,
      {
        category: 'Uncategorized',
        amount: 0,
        description: splittingTx.description,
        gst: splittingTx.gstApplicable,
      },
    ]);
  }, [splittingTx]);

  /**
   * Remove a split entry by index.
   * Prevents removal if only 2 splits remain (minimum for a split operation).
   */
  const removeSplit = useCallback((index: number) => {
    setSplits((prev) => {
      // Don't allow removing if only 2 splits remain
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  /**
   * Update a specific split entry with partial updates.
   */
  const updateSplit = useCallback((index: number, updates: Partial<SplitEntry>) => {
    setSplits((prev) => {
      const newSplits = [...prev];
      if (newSplits[index]) {
        newSplits[index] = { ...newSplits[index], ...updates };
      }
      return newSplits;
    });
  }, []);

  /**
   * Clear the current error.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Computed values
  const totalSplitAmount = useMemo(() => {
    return splits.reduce((sum, s) => sum + s.amount, 0);
  }, [splits]);

  const remainingAmount = useMemo(() => {
    if (!splittingTx) return 0;
    return splittingTx.amount - totalSplitAmount;
  }, [splittingTx, totalSplitAmount]);

  const isBalanced = useMemo(() => {
    return remainingAmount === 0 && splits.length >= 2;
  }, [remainingAmount, splits.length]);

  return {
    splittingTx,
    splits,
    setSplits,
    handleSplitStart,
    handleSplitSave,
    handleSplitCancel,
    addSplit,
    removeSplit,
    updateSplit,
    totalSplitAmount,
    remainingAmount,
    isBalanced,
    isSaving,
    error,
    clearError,
  };
}
