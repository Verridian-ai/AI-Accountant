/**
 * Transaction Service Types
 */

export interface ListTransactionsFilters {
  limit?: number;
  offset?: number;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  search?: string;
}

export interface UpdateTransactionInput {
  description?: string;
  amount?: number;
  category?: string;
  gstApplicable?: boolean;
}

export interface TransactionSplit {
  description?: string;
  amount: number;
  category?: string;
  gst?: boolean;
}
