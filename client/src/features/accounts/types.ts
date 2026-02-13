export interface AccountManaged {
  id: number;
  bankId: string;
  accountNumber: string;
  accountName: string;
  nickname?: string;
  accountType: 'transaction' | 'savings' | 'credit';
  color?: string;
  statementCount: number;
  transactionCount: number;
  lastBalance?: number;
}
