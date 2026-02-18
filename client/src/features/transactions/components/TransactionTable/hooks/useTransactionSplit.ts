import { useState, useCallback } from 'react';
import type { Transaction } from '@/api';
import { api } from '@/api';

export interface SplitItem {
  category: string;
  amount: number;
  description: string;
  gst: boolean;
}

interface UseTransactionSplitParams {
  onDataChange?: () => void;
}

export function useTransactionSplit({ onDataChange }: UseTransactionSplitParams) {
  const [splittingTx, setSplittingTx] = useState<Transaction | null>(null);
  const [splits, setSplits] = useState<SplitItem[]>([]);

  const handleSplitStart = useCallback((tx: Transaction) => {
    setSplittingTx(tx);
    setSplits([
      {
        category: tx.category || 'Uncategorized',
        amount: Math.floor(tx.amount / 2),
        description: tx.description,
        gst: tx.gstApplicable,
      },
      {
        category: 'Uncategorized',
        amount: tx.amount - Math.floor(tx.amount / 2),
        description: tx.description,
        gst: tx.gstApplicable,
      },
    ]);
  }, []);

  const handleSplitSave = useCallback(async () => {
    if (!splittingTx) return;
    const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
    if (totalSplit !== splittingTx.amount) {
      alert(
        `Total split amount (${totalSplit / 100}) must equal original amount (${splittingTx.amount / 100})`,
      );
      return;
    }
    try {
      await api.splitTransaction(splittingTx.id, splits);
      setSplittingTx(null);
      onDataChange?.();
    } catch (err) {
      console.error(err);
      alert('Failed to split transaction');
    }
  }, [splittingTx, splits, onDataChange]);

  return { splittingTx, setSplittingTx, splits, setSplits, handleSplitStart, handleSplitSave };
}
