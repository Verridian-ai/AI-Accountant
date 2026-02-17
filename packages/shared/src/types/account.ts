export interface Account {
  id: string;
  userId: string;
  accountNumber: string;
  accountNumberHash: string;
  accountName: string;
  accountType: string;
  bankName: string | null;
  currentBalance: number | null;
  interestRate: number | null;
  creditLimit: number | null;
  minimumPayment: number | null;
  paymentDueDay: number | null;
  linkedPaymentAccountId: string | null;
  isActive: boolean;
  ownershipTag?: 'personal' | 'business';
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  accountNumber: string;
  accountName: string;
  accountType: string;
  bankName?: string;
  interestRate?: number;
  creditLimit?: number;
  minimumPayment?: number;
  paymentDueDay?: number;
}

export interface BalanceHistoryEntry {
  id: string;
  accountId: string;
  balance: number;
  balanceDate: string;
  source: 'statement' | 'calculated' | 'manual';
  statementId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ReconciliationAlert {
  id: string;
  userId: string;
  accountId: string;
  alertType: 'balance_mismatch' | 'missing_transaction' | 'duplicate';
  expectedValue: number | null;
  actualValue: number | null;
  difference: number | null;
  description: string;
  statementId: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

export interface CreditCardAnalytics {
  accountId: string;
  accountName: string;
  creditLimit: number | null;
  currentBalance: number | null;
  interestRate: number | null;
  minimumPayment: number | null;
  totalInterestPaid: number;
  totalPayments: number;
  totalSpending: number;
  avgMonthlySpending: number;
  utilization: number | null;
  transactionCount: number;
  interestTransactionCount: number;
  recentInterestCharges: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
}

export interface DebtStrategy {
  name: string;
  description: string;
  totalMonths: number;
  totalInterestPaid: number;
  monthlyPayment: number;
  payoffOrder: Array<{
    accountId: string;
    accountName: string;
    monthsToPayoff: number;
    interestPaid: number;
  }>;
  projections: Array<{
    month: number;
    totalDebt: number;
    interestPaid: number;
  }>;
}

export interface DebtRecommendations {
  message?: string;
  aggressive: DebtStrategy | null;
  moderate: DebtStrategy | null;
  minimum: DebtStrategy | null;
}

