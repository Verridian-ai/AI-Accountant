/**
 * Account Service — Type definitions.
 */

/** Minimal transaction shape used by analytics methods (Drizzle proxy loses type info) */
export interface TransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  category: string | null;
  isTransfer: boolean | null;
  accountId: string | null;
}

/** Minimal account shape returned by accountRepository.findAll */
export interface AccountRow {
  id: string;
  accountName: string;
  accountType: string;
  currentBalance: number | null;
  creditLimit: number | null;
  interestRate: number | null;
  minimumPayment: number | null;
}

export interface CreateAccountInput {
  userId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  bankName?: string;
  interestRate?: number;
  creditLimit?: number;
  minimumPayment?: number;
  paymentDueDay?: number;
}

export interface UpdateMerchantMemoryInput {
  userId: string;
  merchantPattern: string;
  merchantDisplayName?: string;
  category: string;
  gstApplicable: boolean;
  isUserConfirmed: boolean;
}

export interface ResolveCategorizationInput {
  userId: string;
  pendingId: string;
  action: 'approve' | 'modify' | 'reject'; // Added reject for completeness
  category?: string;
  gstApplicable?: boolean;
}

export interface CreateTransferInput {
  userId: string;
  sourceTransactionId: string;
  destinationTransactionId: string;
}
