/**
 * Ledger Module — Type Definitions
 */

export interface JournalEntryLine {
  accountCode: string;
  description?: string;
  debitAmount: number;
  creditAmount: number;
  taxCode?: string;
  taxAmount?: number;
  bankAccountId?: string;
  transactionId?: string;
}

export interface CreateJournalEntryParams {
  userId: string;
  entryDate: string;
  description: string;
  reference?: string;
  sourceType: 'transaction' | 'manual' | 'adjustment' | 'closing';
  sourceId?: string;
  lines: JournalEntryLine[];
  isAdjusting?: boolean;
  isClosing?: boolean;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  reference: string | null;
  sourceType: string;
  sourceId: string | null;
  status: string;
  totalDebits: number;
  totalCredits: number;
  lines: Array<{
    id: string;
    lineNumber: number;
    accountId: string;
    accountCode: string;
    accountName: string;
    description: string | null;
    debitAmount: number;
    creditAmount: number;
    taxCode: string | null;
    taxAmount: number;
  }>;
}

export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}
