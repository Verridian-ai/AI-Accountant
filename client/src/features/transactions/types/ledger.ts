/**
 * Shared types for the Ledger component refactor.
 * These types are used across the ledger feature for filtering,
 * editing, and displaying transaction data.
 */

import type { Transaction, Account } from '@/api';

// Re-export Transaction and Account types for convenience
export type { Transaction, Account };

/**
 * Represents the current state of filters applied to the ledger view.
 * Used to filter transactions by date range, category, and search term.
 */
export interface FilterState {
  /** Start date for filtering transactions (ISO date string) */
  startDate: string;
  /** End date for filtering transactions (ISO date string) */
  endDate: string;
  /** Selected category to filter by, or empty string for all categories */
  selectedCategory: string;
  /** Global search term to filter across all transaction fields */
  globalFilter: string;
  /** Selected account ID to filter by, or 'All' for all accounts */
  selectedAccount: string;
}

/**
 * Represents a single entry in a split transaction.
 * Used when a transaction needs to be divided across multiple categories.
 */
export interface SplitEntry {
  /** The category assigned to this portion of the transaction */
  category: string;
  /** The amount for this split entry in cents */
  amount: number;
  /** Description for this split entry */
  description: string;
  /** Whether GST applies to this split entry */
  gst: boolean;
}

/**
 * Represents the state of inline editing within the ledger.
 * Tracks which transaction is being edited and the current form values.
 */
export interface EditState {
  /** ID of the transaction currently being edited, or null if none */
  editingId: string | null;
  /** Partial transaction data representing the current edit form values */
  editForm: Partial<Transaction>;
}

/**
 * Props interface for the LedgerTable component.
 * Defines the required and optional properties for rendering the ledger table.
 */
export interface LedgerTableProps {
  /** Array of transactions to display in the table */
  transactions: Transaction[];
  /** Array of accounts for account-related display and filtering */
  accounts: Account[];
  /** Whether the table is in a loading state */
  loading: boolean;
  /** Optional callback invoked when data changes (e.g., after edit/delete) */
  onDataChange?: () => void;
}
