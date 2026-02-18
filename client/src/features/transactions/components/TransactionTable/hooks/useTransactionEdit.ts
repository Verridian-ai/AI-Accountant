import { useState, useCallback } from 'react';
import type { Transaction } from '@/api';
import { api } from '@/api';

interface UseTransactionEditParams {
  transactions: Transaction[];
  onDataChange?: () => void;
}

export function useTransactionEdit({ transactions, onDataChange }: UseTransactionEditParams) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  const handleEditStart = useCallback((tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm({
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
      gstApplicable: tx.gstApplicable,
    });
  }, []);

  const handleSave = useCallback(
    async (id: string) => {
      const originalTx = transactions.find((t) => t.id === id);
      if (!originalTx) {
        alert('Transaction not found');
        return;
      }
      try {
        await api.updateTransaction(id, editForm);
        setEditingId(null);
        onDataChange?.();
      } catch (err) {
        console.error(err);
        alert('Failed to save changes');
      }
    },
    [editForm, transactions, onDataChange],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (confirm('Delete this transaction?')) {
        try {
          await api.deleteTransaction(id);
          onDataChange?.();
        } catch (err) {
          console.error(err);
          alert('Failed to delete transaction');
        }
      }
    },
    [onDataChange],
  );

  return {
    editingId,
    setEditingId,
    editForm,
    setEditForm,
    handleEditStart,
    handleSave,
    handleDelete,
  };
}
