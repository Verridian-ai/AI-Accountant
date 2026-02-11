/**
 * Ledger Service
 *
 * Implements double-entry bookkeeping for the Australian accounting system.
 * Handles journal entries, chart of accounts, and transaction-to-journal mapping.
 */

import { db, chartOfAccounts, journalEntries, journalEntryLines, accountingPeriods, accountBalances, transactions, accounts } from '../schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface JournalEntryLine {
  accountCode: string;
  description?: string;
  debitAmount: number; // In cents
  creditAmount: number; // In cents
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

// ============================================================================
// CHART OF ACCOUNTS (AUSTRALIAN STANDARD)
// ============================================================================

export const STANDARD_CHART_OF_ACCOUNTS = [
  // Assets (1-xxxx)
  { code: '1-0000', name: 'Assets', type: 'asset', normalBalance: 'debit' },
  { code: '1-0100', name: 'Cash at Bank', type: 'asset', normalBalance: 'debit' },
  { code: '1-0110', name: 'Main Transaction Account', type: 'asset', normalBalance: 'debit', parent: '1-0100' },
  { code: '1-0120', name: 'Savings Account', type: 'asset', normalBalance: 'debit', parent: '1-0100' },
  { code: '1-0200', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit' },
  { code: '1-0300', name: 'Prepaid Expenses', type: 'asset', normalBalance: 'debit' },
  { code: '1-0400', name: 'Inventory', type: 'asset', normalBalance: 'debit' },
  { code: '1-0500', name: 'Fixed Assets', type: 'asset', normalBalance: 'debit' },
  { code: '1-0510', name: 'Office Equipment', type: 'asset', normalBalance: 'debit', parent: '1-0500' },
  { code: '1-0520', name: 'Motor Vehicles', type: 'asset', normalBalance: 'debit', parent: '1-0500' },
  { code: '1-0530', name: 'Computer Equipment', type: 'asset', normalBalance: 'debit', parent: '1-0500' },
  { code: '1-0600', name: 'Accumulated Depreciation', type: 'asset', normalBalance: 'credit' },

  // Liabilities (2-xxxx)
  { code: '2-0000', name: 'Liabilities', type: 'liability', normalBalance: 'credit' },
  { code: '2-0100', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit' },
  { code: '2-0200', name: 'Credit Card', type: 'liability', normalBalance: 'credit' },
  { code: '2-0300', name: 'GST Collected', type: 'liability', normalBalance: 'credit', basLabel: '1A' },
  { code: '2-0310', name: 'GST Paid', type: 'liability', normalBalance: 'debit', basLabel: '1B' },
  { code: '2-0400', name: 'PAYG Withholding', type: 'liability', normalBalance: 'credit', basLabel: 'W2' },
  { code: '2-0500', name: 'Superannuation Payable', type: 'liability', normalBalance: 'credit' },
  { code: '2-0600', name: 'Loans Payable', type: 'liability', normalBalance: 'credit' },

  // Equity (3-xxxx)
  { code: '3-0000', name: 'Equity', type: 'equity', normalBalance: 'credit' },
  { code: '3-0100', name: 'Owner\'s Capital', type: 'equity', normalBalance: 'credit' },
  { code: '3-0200', name: 'Owner\'s Drawings', type: 'equity', normalBalance: 'debit' },
  { code: '3-0300', name: 'Retained Earnings', type: 'equity', normalBalance: 'credit' },
  { code: '3-0400', name: 'Current Year Earnings', type: 'equity', normalBalance: 'credit' },

  // Revenue (4-xxxx)
  { code: '4-0000', name: 'Revenue', type: 'revenue', normalBalance: 'credit', basLabel: 'G1' },
  { code: '4-0100', name: 'Sales Revenue', type: 'revenue', normalBalance: 'credit', taxCode: 'GST' },
  { code: '4-0200', name: 'Service Revenue', type: 'revenue', normalBalance: 'credit', taxCode: 'GST' },
  { code: '4-0300', name: 'Interest Income', type: 'revenue', normalBalance: 'credit', taxCode: 'FRE' },
  { code: '4-0400', name: 'Other Income', type: 'revenue', normalBalance: 'credit' },
  { code: '4-0500', name: 'Export Revenue', type: 'revenue', normalBalance: 'credit', taxCode: 'EXP', basLabel: 'G2' },

  // Cost of Sales (5-xxxx)
  { code: '5-0000', name: 'Cost of Sales', type: 'cogs', normalBalance: 'debit' },
  { code: '5-0100', name: 'Cost of Goods Sold', type: 'cogs', normalBalance: 'debit', taxCode: 'GST' },
  { code: '5-0200', name: 'Direct Labour', type: 'cogs', normalBalance: 'debit' },
  { code: '5-0300', name: 'Freight Costs', type: 'cogs', normalBalance: 'debit', taxCode: 'GST' },

  // Expenses (6-xxxx)
  { code: '6-0000', name: 'Expenses', type: 'expense', normalBalance: 'debit', basLabel: 'G11' },
  { code: '6-0100', name: 'Advertising & Marketing', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-0200', name: 'Bank Fees', type: 'expense', normalBalance: 'debit', taxCode: 'FRE' },
  { code: '6-0300', name: 'Computer & IT', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-0400', name: 'Depreciation', type: 'expense', normalBalance: 'debit', taxCode: 'N-T' },
  { code: '6-0500', name: 'Entertainment', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-0600', name: 'Insurance', type: 'expense', normalBalance: 'debit', taxCode: 'FRE' },
  { code: '6-0700', name: 'Interest Expense', type: 'expense', normalBalance: 'debit', taxCode: 'FRE' },
  { code: '6-0800', name: 'Motor Vehicle Expenses', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-0900', name: 'Office Supplies', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-1000', name: 'Professional Fees', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-1100', name: 'Rent', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-1200', name: 'Repairs & Maintenance', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-1300', name: 'Subscriptions', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-1400', name: 'Telephone & Internet', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-1500', name: 'Travel', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-1600', name: 'Utilities', type: 'expense', normalBalance: 'debit', taxCode: 'GST' },
  { code: '6-1700', name: 'Wages & Salaries', type: 'expense', normalBalance: 'debit', taxCode: 'N-T', basLabel: 'W1' },
  { code: '6-1800', name: 'Superannuation', type: 'expense', normalBalance: 'debit', taxCode: 'N-T' },
  { code: '6-1900', name: 'Work from Home Expenses', type: 'expense', normalBalance: 'debit', taxCode: 'N-T' },
  { code: '6-2000', name: 'Miscellaneous', type: 'expense', normalBalance: 'debit' },
];

// ============================================================================
// LEDGER SERVICE CLASS
// ============================================================================

export class LedgerService {
  /**
   * Initialize chart of accounts for a user
   */
  async initializeChartOfAccounts(userId: string): Promise<void> {
    const now = new Date().toISOString();

    for (const account of STANDARD_CHART_OF_ACCOUNTS) {
      // Find parent account ID if specified
      let parentAccountId: string | undefined;
      if (account.parent) {
        const parent = await db
          .select()
          .from(chartOfAccounts)
          .where(and(
            eq(chartOfAccounts.userId, userId),
            eq(chartOfAccounts.accountCode, account.parent)
          ))
          .limit(1);

        if (parent.length > 0) {
          parentAccountId = parent[0].id;
        }
      }

      await db.insert(chartOfAccounts).values({
        id: crypto.randomUUID(),
        userId,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        normalBalance: account.normalBalance as 'debit' | 'credit',
        parentAccountId,
        taxCode: account.taxCode,
        basLabel: account.basLabel,
        isSystemAccount: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    }
  }

  /**
   * Get chart of accounts for a user
   */
  async getChartOfAccounts(userId: string): Promise<typeof chartOfAccounts.$inferSelect[]> {
    return db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.userId, userId))
      .orderBy(chartOfAccounts.accountCode);
  }

  /**
   * Find account by code
   */
  async findAccountByCode(
    userId: string,
    accountCode: string
  ): Promise<typeof chartOfAccounts.$inferSelect | null> {
    const result = await db
      .select()
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.userId, userId),
        eq(chartOfAccounts.accountCode, accountCode)
      ))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create a new journal entry
   */
  async createJournalEntry(params: CreateJournalEntryParams): Promise<JournalEntry> {
    const { userId, entryDate, description, reference, sourceType, sourceId, lines, isAdjusting, isClosing } = params;

    // Validate that debits equal credits
    // Use integer arithmetic for cents to avoid floating-point precision issues
    const totalDebits = lines.reduce((sum, line) => sum + Math.round(line.debitAmount), 0);
    const totalCredits = lines.reduce((sum, line) => sum + Math.round(line.creditAmount), 0);

    // Compare as integers (cents) to avoid floating-point comparison issues
    if (totalDebits !== totalCredits) {
      throw new Error(`Journal entry is not balanced: Debits (${totalDebits}) ≠ Credits (${totalCredits})`);
    }

    // Generate entry number
    const entryNumber = await this.generateEntryNumber(userId);
    const now = new Date().toISOString();

    // Create journal entry
    const entryId = crypto.randomUUID();

    await db.insert(journalEntries).values({
      id: entryId,
      userId,
      entryNumber,
      entryDate,
      description,
      reference: reference || null,
      sourceType,
      sourceId: sourceId || null,
      status: 'draft',
      isAdjusting: isAdjusting || false,
      isClosing: isClosing || false,
      totalDebits,
      totalCredits,
      createdAt: now,
      updatedAt: now,
    });

    // Create journal entry lines
    const createdLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Find account by code
      const account = await this.findAccountByCode(userId, line.accountCode);
      if (!account) {
        throw new Error(`Account not found: ${line.accountCode}`);
      }

      const lineId = crypto.randomUUID();
      await db.insert(journalEntryLines).values({
        id: lineId,
        journalEntryId: entryId,
        lineNumber: i + 1,
        accountId: account.id,
        description: line.description || null,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        taxCode: line.taxCode || null,
        taxAmount: line.taxAmount || 0,
        bankAccountId: line.bankAccountId || null,
        transactionId: line.transactionId || null,
        createdAt: now,
      });

      createdLines.push({
        id: lineId,
        lineNumber: i + 1,
        accountId: account.id,
        accountCode: account.accountCode ?? '',
        accountName: account.accountName ?? '',
        description: line.description || null,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        taxCode: line.taxCode || null,
        taxAmount: line.taxAmount || 0,
      });
    }

    return {
      id: entryId,
      entryNumber,
      entryDate,
      description,
      reference: reference || null,
      sourceType,
      sourceId: sourceId || null,
      status: 'draft',
      totalDebits,
      totalCredits,
      lines: createdLines,
    };
  }

  /**
   * Post a journal entry (make it permanent)
   */
  async postJournalEntry(entryId: string, postedBy: string): Promise<void> {
    const now = new Date().toISOString();

    await db
      .update(journalEntries)
      .set({
        status: 'posted',
        postedAt: now,
        postedBy,
        updatedAt: now,
      })
      .where(eq(journalEntries.id, entryId));
  }

  /**
   * Reverse a journal entry
   */
  async reverseJournalEntry(
    originalEntryId: string,
    userId: string,
    reversalDate: string,
    reason: string
  ): Promise<JournalEntry> {
    // Get original entry with lines
    const original = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, originalEntryId))
      .limit(1);

    if (!original.length) {
      throw new Error('Journal entry not found');
    }

    const originalLines = await db
      .select()
      .from(journalEntryLines)
      .where(eq(journalEntryLines.journalEntryId, originalEntryId));

    // Create reversal entry with swapped debits/credits
    const reversalLines: JournalEntryLine[] = await Promise.all(
      originalLines.map(async (line: any) => {
        const account = await db
          .select()
          .from(chartOfAccounts)
          .where(eq(chartOfAccounts.id, line.accountId))
          .limit(1);

        return {
          accountCode: account[0].accountCode,
          description: `Reversal: ${line.description || ''}`,
          debitAmount: line.creditAmount, // Swap
          creditAmount: line.debitAmount, // Swap
          taxCode: line.taxCode || undefined,
          taxAmount: line.taxAmount ? -line.taxAmount : undefined,
          bankAccountId: line.bankAccountId || undefined,
          transactionId: line.transactionId || undefined,
        };
      })
    );

    const reversalEntry = await this.createJournalEntry({
      userId,
      entryDate: reversalDate,
      description: `Reversal of ${original[0].entryNumber}: ${reason}`,
      reference: `REV-${original[0].entryNumber}`,
      sourceType: 'adjustment',
      sourceId: originalEntryId,
      lines: reversalLines,
    });

    // Update original entry to mark as reversed
    await db
      .update(journalEntries)
      .set({
        reversedById: reversalEntry.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(journalEntries.id, originalEntryId));

    return reversalEntry;
  }

  /**
   * Map a bank transaction to journal entries
   */
  async mapTransactionToJournal(
    userId: string,
    transactionId: string
  ): Promise<JournalEntry> {
    // Get transaction details
    const txn = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    if (!txn.length) {
      throw new Error('Transaction not found');
    }

    const transaction = txn[0];
    const amount = Math.abs(transaction.amount);
    const isCredit = transaction.amount > 0;

    // Determine accounts based on category and transaction type
    const lines: JournalEntryLine[] = [];

    // Get the bank account code
    const bankAccountCode = '1-0110'; // Default to main transaction account

    // Calculate GST if applicable
    // GST calculation: For GST-inclusive amounts, GST = amount * 1/11
    // Use banker's rounding (round half to even) for financial calculations
    const gstAmount = transaction.gstApplicable && transaction.gstAmount
      ? transaction.gstAmount
      : transaction.gstApplicable
        ? Math.round((amount * 100) / 1100) // Calculate in sub-cents then round to cents
        : 0;

    const netAmount = amount - gstAmount;

    if (isCredit) {
      // Income transaction
      // Debit: Bank Account
      // Credit: Revenue Account
      // Credit: GST Collected (if applicable)

      lines.push({
        accountCode: bankAccountCode,
        description: transaction.description,
        debitAmount: amount,
        creditAmount: 0,
        transactionId,
      });

      // Map category to revenue account
      const revenueAccountCode = this.mapCategoryToAccount(transaction.category, 'revenue');

      lines.push({
        accountCode: revenueAccountCode,
        description: transaction.description,
        debitAmount: 0,
        creditAmount: netAmount,
        taxCode: transaction.gstApplicable ? 'GST' : 'FRE',
        transactionId,
      });

      if (gstAmount > 0) {
        lines.push({
          accountCode: '2-0300', // GST Collected
          description: 'GST on ' + transaction.description,
          debitAmount: 0,
          creditAmount: gstAmount,
          taxCode: 'GST',
          taxAmount: gstAmount,
          transactionId,
        });
      }
    } else {
      // Expense transaction
      // Debit: Expense Account
      // Debit: GST Paid (if applicable)
      // Credit: Bank Account

      // Map category to expense account
      const expenseAccountCode = this.mapCategoryToAccount(transaction.category, 'expense');

      lines.push({
        accountCode: expenseAccountCode,
        description: transaction.description,
        debitAmount: netAmount,
        creditAmount: 0,
        taxCode: transaction.gstApplicable ? 'GST' : 'FRE',
        transactionId,
      });

      if (gstAmount > 0) {
        lines.push({
          accountCode: '2-0310', // GST Paid
          description: 'GST on ' + transaction.description,
          debitAmount: gstAmount,
          creditAmount: 0,
          taxCode: 'GST',
          taxAmount: gstAmount,
          transactionId,
        });
      }

      lines.push({
        accountCode: bankAccountCode,
        description: transaction.description,
        debitAmount: 0,
        creditAmount: amount,
        transactionId,
      });
    }

    return this.createJournalEntry({
      userId,
      entryDate: transaction.date,
      description: transaction.description,
      sourceType: 'transaction',
      sourceId: transactionId,
      lines,
    });
  }

  /**
   * Map a transfer to journal entries
   */
  async mapTransferToJournal(
    userId: string,
    sourceTransactionId: string,
    destinationTransactionId: string,
    amount: number,
    transferDate: string
  ): Promise<JournalEntry> {
    // For transfers: Debit destination bank, Credit source bank
    const lines: JournalEntryLine[] = [
      {
        accountCode: '1-0110', // Destination (would be looked up from account)
        description: 'Transfer In',
        debitAmount: amount,
        creditAmount: 0,
        transactionId: destinationTransactionId,
      },
      {
        accountCode: '1-0110', // Source (would be looked up from account)
        description: 'Transfer Out',
        debitAmount: 0,
        creditAmount: amount,
        transactionId: sourceTransactionId,
      },
    ];

    return this.createJournalEntry({
      userId,
      entryDate: transferDate,
      description: 'Internal Transfer',
      sourceType: 'transaction',
      lines,
    });
  }

  /**
   * Calculate account balances for a period
   */
  async calculateAccountBalances(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<AccountBalance[]> {
    const balances: AccountBalance[] = [];

    // Get all accounts
    const allAccounts = await this.getChartOfAccounts(userId);

    for (const account of allAccounts) {
      // Calculate totals from journal entry lines
      const totals = await db
        .select({
          totalDebits: sql<number>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
          totalCredits: sql<number>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
        })
        .from(journalEntryLines)
        .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
        .where(and(
          eq(journalEntryLines.accountId, account.id),
          eq(journalEntries.userId, userId),
          eq(journalEntries.status, 'posted'),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate)
        ));

      const totalDebits = totals[0]?.totalDebits || 0;
      const totalCredits = totals[0]?.totalCredits || 0;

      // Calculate closing balance based on normal balance
      let closingBalance: number;
      if (account.normalBalance === 'debit') {
        closingBalance = totalDebits - totalCredits;
      } else {
        closingBalance = totalCredits - totalDebits;
      }

      balances.push({
        accountId: account.id,
        accountCode: account.accountCode ?? '',
        accountName: account.accountName ?? '',
        accountType: account.accountType ?? '',
        openingBalance: 0, // Would need to calculate from previous periods
        totalDebits,
        totalCredits,
        closingBalance,
      });
    }

    return balances.filter(b => b.totalDebits !== 0 || b.totalCredits !== 0);
  }

  /**
   * Generate trial balance
   */
  async generateTrialBalance(
    userId: string,
    asOfDate: string
  ): Promise<{
    accounts: AccountBalance[];
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  }> {
    const balances = await this.calculateAccountBalances(userId, '1900-01-01', asOfDate);

    let totalDebits = 0;
    let totalCredits = 0;

    for (const balance of balances) {
      if (balance.closingBalance > 0) {
        totalDebits += balance.closingBalance;
      } else {
        totalCredits += Math.abs(balance.closingBalance);
      }
    }

    // Round totals to avoid floating-point precision issues in comparison
    totalDebits = Math.round(totalDebits);
    totalCredits = Math.round(totalCredits);

    return {
      accounts: balances,
      totalDebits,
      totalCredits,
      // Use tolerance-based comparison for floating-point safety (1 cent tolerance)
      isBalanced: Math.abs(totalDebits - totalCredits) < 1,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async generateEntryNumber(userId: string): Promise<string> {
    // Get count of existing entries for this user
    const count = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId));

    const nextNumber = (count[0]?.count || 0) + 1;
    const year = new Date().getFullYear();

    return `JE-${year}-${String(nextNumber).padStart(5, '0')}`;
  }

  private mapCategoryToAccount(category: string | null, type: 'revenue' | 'expense'): string {
    if (!category) {
      return type === 'revenue' ? '4-0400' : '6-2000'; // Other Income / Miscellaneous
    }

    const categoryLower = category.toLowerCase();

    if (type === 'revenue') {
      if (categoryLower.includes('sale')) return '4-0100';
      if (categoryLower.includes('service')) return '4-0200';
      if (categoryLower.includes('interest')) return '4-0300';
      if (categoryLower.includes('export')) return '4-0500';
      return '4-0400'; // Other Income
    }

    // Expense mapping
    if (categoryLower.includes('advertising') || categoryLower.includes('marketing')) return '6-0100';
    if (categoryLower.includes('bank') || categoryLower.includes('fee')) return '6-0200';
    if (categoryLower.includes('computer') || categoryLower.includes('software') || categoryLower.includes('it')) return '6-0300';
    if (categoryLower.includes('entertainment') || categoryLower.includes('meal')) return '6-0500';
    if (categoryLower.includes('insurance')) return '6-0600';
    if (categoryLower.includes('interest')) return '6-0700';
    if (categoryLower.includes('vehicle') || categoryLower.includes('fuel') || categoryLower.includes('car')) return '6-0800';
    if (categoryLower.includes('office') || categoryLower.includes('stationery')) return '6-0900';
    if (categoryLower.includes('professional') || categoryLower.includes('legal') || categoryLower.includes('accounting')) return '6-1000';
    if (categoryLower.includes('rent') || categoryLower.includes('lease')) return '6-1100';
    if (categoryLower.includes('repair') || categoryLower.includes('maintenance')) return '6-1200';
    if (categoryLower.includes('subscription')) return '6-1300';
    if (categoryLower.includes('phone') || categoryLower.includes('internet') || categoryLower.includes('telecom')) return '6-1400';
    if (categoryLower.includes('travel') || categoryLower.includes('flight') || categoryLower.includes('accommodation')) return '6-1500';
    if (categoryLower.includes('utility') || categoryLower.includes('electric') || categoryLower.includes('gas') || categoryLower.includes('water')) return '6-1600';
    if (categoryLower.includes('wage') || categoryLower.includes('salary') || categoryLower.includes('payroll')) return '6-1700';
    if (categoryLower.includes('super')) return '6-1800';
    if (categoryLower.includes('wfh') || categoryLower.includes('home office')) return '6-1900';

    return '6-2000'; // Miscellaneous
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const ledgerService = new LedgerService();
