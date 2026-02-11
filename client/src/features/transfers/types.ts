export interface TransferMatch {
  id: string;
  sourceAccountId: number;
  sourceAccountName: string;
  sourceTransactionId: number;
  sourceDescription: string;
  sourceAmount: number;
  sourceDate: string;
  targetAccountId: number;
  targetAccountName: string;
  targetTransactionId: number;
  targetDescription: string;
  targetAmount: number;
  targetDate: string;
  confidence: number;
  matchReasons: string[];
  isConfirmed: boolean;
}

export interface MoneyFlow {
  fromAccountId: number;
  fromAccountName: string;
  toAccountId: number;
  toAccountName: string;
  totalAmount: number;
  transactionCount: number;
}

export interface NetPosition {
  accountAId: number;
  accountBId: number;
  totalAtoB: number;
  totalBtoA: number;
  net: number;
  direction: 'A_to_B' | 'B_to_A' | 'balanced';
}
