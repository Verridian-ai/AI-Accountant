import { useState, useCallback } from 'react';
import type { Transaction } from '../types/ledger';
import { api } from '@/api';

/**
 * Options for configuring the useInlineEdit hook.
 */
export interface UseInlineEditOptions {
  /** Array of transactions to reference when editing */
  transactions: Transaction[];
  /** Callback invoked when data changes (after save/delete) */
  onDataChange?: () => void;
}

/**
 * Return type for the useInlineEdit hook.
 */
export interface UseInlineEditReturn {
  /** ID of the transaction currently being edited, or null if none */
  editingId: string | null;
  /** Partial transaction data representing current edit form values */
  editForm: Partial<Transaction>;
  /** Update the edit form state */
  setEditForm: (form: Partial<Transaction>) => void;
  /** Directly set the editing ID (use handleEditStart for full setup) */
  setEditingId: (id: string | null) => void;
  /** Start editing a transaction */
  handleEditStart: (tx: Transaction) => void;
  /** Save changes to a transaction */
  handleSave: (id: string) => Promise<void>;
  /** Cancel the current edit operation */
  handleCancel: () => void;
  /** Delete a transaction (with confirmation) */
  handleDelete: (id: string) => Promise<void>;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Whether a delete operation is in progress */
  isDeleting: boolean;
}

/**
 * Hook for managing inline editing of transactions.
 *
 * Extracts the inline edit functionality from TransactionTable, providing:
 * - Edit state management (editingId, editForm)
 * - Start/save/cancel edit operations
 * - Delete with confirmation
 * - Loading states for async operations
 *
 * @example
 * ```tsx
 * const {
 *   editingId,
 *   editForm,
 *   setEditForm,
 *   handleEditStart,
 *   handleSave,
 *   handleCancel,
 *   handleDelete,
 * } = useInlineEdit({ transactions, onDataChange });
 * ```
 */
export function useInlineEdit({
  transactions,
  onDataChange,
}: UseInlineEditOptions): UseInlineEditReturn {
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Start editing a transaction by populating the edit form
   * with the transaction's current values.
   */
  const handleEditStart = useCallback((tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm({
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
      gstApplicable: tx.gstApplicable,
    });
  }, []);

  /**
   * Save changes to the transaction being edited.
   * Validates that the transaction exists before saving.
   */
  const handleSave = useCallback(async (id: string) => {
    // Find original transaction data for validation
    const originalTx = transactions.find((t) => t.id === id);
    if (!originalTx) {
      console.error('[useInlineEdit] Transaction not found:', id);
      return;
    }

    setIsSaving(true);
    try {
      await api.updateTransaction(id, editForm);
      setEditingId(null);
      setEditForm({});
      onDataChange?.();
    } catch (err) {
      console.error('[useInlineEdit] Failed to save changes:', err);
      // TODO: Replace with toast notification when available
      // toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [editForm, transactions, onDataChange]);

  /**
   * Cancel the current edit operation and clear the form.
   */
  const handleCancel = useCallback(() => {
    setEditingId(null);
    setEditForm({});
  }, []);

  /**
   * Delete a transaction after user confirmation.
   */
  const handleDelete = useCallback(async (id: string) => {
    // Using native confirm for now - can be replaced with a modal
    if (!confirm('Delete this transaction?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteTransaction(id);
      onDataChange?.();
    } catch (err) {
      console.error('[useInlineEdit] Failed to delete transaction:', err);
      // TODO: Replace with toast notification when available
      // toast.error('Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  }, [onDataChange]);

  return {
    editingId,
    editForm,
    setEditForm,
    setEditingId,
    handleEditStart,
    handleSave,
    handleCancel,
    handleDelete,
    isSaving,
    isDeleting,
  };
}
