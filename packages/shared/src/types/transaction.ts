export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  category?: string;
  gstApplicable: boolean;
  confidenceScore: number;
  aiReasoningNotes?: string;
  isEdited?: boolean;
  isTransfer?: boolean;
  transferLinkId?: string;
  isOwnerContribution?: boolean;
  merchantNormalized?: string;
  accountId?: string;
  parentTransactionId?: string;
  statementId?: string;
  userId?: string;
}

export interface CreateTransactionInput {
  statementId: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
}

export interface UpdateTransactionInput {
  description?: string;
  amount?: number;
  category?: string;
  gstCode?: string;
}

export interface TransactionStats {
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  transactionCount: number;
  categoryBreakdown: Record<string, number>;
}

export interface PendingCategorization {
  id: string;
  userId: string;
  transactionId: string;
  suggestedCategory: string | null;
  suggestedConfidence: number | null;
  aiReasoning: string | null;
  status: string;
  transaction?: Transaction;
}

export interface MerchantMemory {
  id: string;
  userId: string;
  merchantPattern: string;
  merchantDisplayName: string | null;
  category: string;
  gstApplicable: boolean;
  timesUsed: number;
  lastUsed: string;
  isUserConfirmed: boolean;
}

export interface TransferLink {
  id: string;
  userId: string;
  sourceTransactionId: string;
  destinationTransactionId: string;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  amount: number;
  transferDate: string;
  confidence: number;
  isUserConfirmed: boolean;
  createdAt: string;
  sourceTransaction?: Transaction;
  destinationTransaction?: Transaction;
}

