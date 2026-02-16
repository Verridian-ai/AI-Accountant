import {
  db,
  accounts,
  accountBalanceHistory,
  pendingCategorization,
  transactions,
  merchantMemory,
  transferLinks,
  reconciliationAlerts,
  chartOfAccounts,
  statementAccounts,
} from '../schema.js';
import { eq, and, desc, aliasedTable, like } from 'drizzle-orm';
import crypto from 'crypto';

interface CreateAccountInput {
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

interface UpdateMerchantMemoryInput {
  userId: string;
  merchantPattern: string;
  merchantDisplayName?: string;
  category: string;
  gstApplicable: boolean;
  isUserConfirmed: boolean;
}

interface ResolveCategorizationInput {
  userId: string;
  pendingId: string;
  action: 'approve' | 'modify' | 'reject'; // Added reject for completeness
  category?: string;
  gstApplicable?: boolean;
}

interface CreateTransferInput {
  userId: string;
  sourceTransactionId: string;
  destinationTransactionId: string;
}

export class AccountService {
  public hashAccountNumber(accountNumber: string): string {
    return crypto.createHash('sha256').update(accountNumber.trim()).digest('hex');
  }

  async findAccountByHash(userId: string, accountHash: string) {
    return db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.accountNumberHash, accountHash)))
      .get();
  }

  async getUserAccounts(
    userId: string,
    filters?: { ownershipTag?: string; type?: string; search?: string },
  ) {
    const conditions = [eq(accounts.userId, userId)];

    if (filters?.ownershipTag) {
      conditions.push(eq(accounts.ownershipTag, filters.ownershipTag));
    }
    if (filters?.type) {
      conditions.push(eq(accounts.accountType, filters.type));
    }
    if (filters?.search) {
      conditions.push(like(accounts.accountName, `%${filters.search}%`));
    }

    return db
      .select()
      .from(accounts)
      .where(and(...conditions))
      .all();
  }

  async getAccount(userId: string, accountId: string) {
    return db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .get();
  }

  async getChartOfAccounts(userId: string) {
    return db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.userId, userId))
      .orderBy(chartOfAccounts.accountCode)
      .all();
  }

  async createAccount(input: CreateAccountInput) {
    const accountHash = this.hashAccountNumber(input.accountNumber);
    const existing = await this.findAccountByHash(input.userId, accountHash);

    if (existing) {
      throw new Error('Account already exists');
    }

    const id = crypto.randomUUID();
    await db.insert(accounts).values({
      id,
      userId: input.userId,
      accountNumber: input.accountNumber,
      accountNumberHash: accountHash,
      accountName: input.accountName,
      accountType: input.accountType,
      bankName: input.bankName,
      interestRate: input.interestRate,
      creditLimit: input.creditLimit,
      minimumPayment: input.minimumPayment,
      paymentDueDay: input.paymentDueDay,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const maskedAccountNumber =
      input.accountNumber.length > 4
        ? `XXXX-${input.accountNumber.slice(-4)}`
        : input.accountNumber;

    return { id, accountNumber: maskedAccountNumber, success: true };
  }

  async updateAccount(
    userId: string,
    accountId: string,
    data: Partial<CreateAccountInput> & { linkedPaymentAccountId?: string; ownershipTag?: string },
  ) {
    const existing = await this.getAccount(userId, accountId);
    if (!existing) return null;

    await db
      .update(accounts)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
    return { success: true };
  }

  async deleteAccount(userId: string, accountId: string) {
    const existing = await this.getAccount(userId, accountId);
    if (!existing) return null;
    await db.delete(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
    return { success: true };
  }

  async getAccountBalance(userId: string, accountId: string) {
    const account = await this.getAccount(userId, accountId);
    if (!account) return null;
    return account.currentBalance;
  }

  async updateAccountBalance(accountId: string, newBalance: number) {
    await db.update(accounts).set({ currentBalance: newBalance }).where(eq(accounts.id, accountId));
  }

  async linkStatementToAccount(statementId: string, accountId: string) {
    await db.insert(statementAccounts).values({ statementId, accountId }).onConflictDoNothing();
  }

  // --- Merchant Memory ---

  async getMerchantMemory(userId: string) {
    return db.select().from(merchantMemory).where(eq(merchantMemory.userId, userId)).all();
  }

  async updateMerchantMemory(input: UpdateMerchantMemoryInput) {
    const existing = await db
      .select()
      .from(merchantMemory)
      .where(
        and(
          eq(merchantMemory.userId, input.userId),
          eq(merchantMemory.merchantPattern, input.merchantPattern),
        ),
      )
      .get();

    if (existing) {
      await db
        .update(merchantMemory)
        .set({
          category: input.category,
          gstApplicable: input.gstApplicable,
          merchantDisplayName: input.merchantDisplayName,
          isUserConfirmed: input.isUserConfirmed,
          timesUsed: (existing.timesUsed || 0) + 1,
          lastUsed: new Date().toISOString(),
        })
        .where(eq(merchantMemory.id, existing.id));
    } else {
      await db.insert(merchantMemory).values({
        id: crypto.randomUUID(),
        userId: input.userId,
        merchantPattern: input.merchantPattern,
        merchantDisplayName: input.merchantDisplayName,
        category: input.category,
        gstApplicable: input.gstApplicable,
        isUserConfirmed: input.isUserConfirmed,
        timesUsed: 1,
        lastUsed: new Date().toISOString(),
      });
    }
  }

  async batchUpdateMerchantMemory(
    userId: string,
    updates: Omit<UpdateMerchantMemoryInput, 'userId'>[],
  ) {
    for (const update of updates) {
      await this.updateMerchantMemory({ ...update, userId });
    }
  }

  async updateMerchantMemoryById(
    userId: string,
    id: string,
    data: Partial<UpdateMerchantMemoryInput>,
  ) {
    const existing = await db
      .select()
      .from(merchantMemory)
      .where(and(eq(merchantMemory.id, id), eq(merchantMemory.userId, userId)))
      .get();
    if (!existing) return null;

    await db
      .update(merchantMemory)
      .set({
        category: data.category ?? existing.category,
        gstApplicable: data.gstApplicable ?? existing.gstApplicable,
        merchantDisplayName: data.merchantDisplayName ?? existing.merchantDisplayName,
        isUserConfirmed: true,
      })
      .where(eq(merchantMemory.id, id));

    return { success: true };
  }

  async deleteMerchantMemory(userId: string, id: string) {
    const existing = await db
      .select()
      .from(merchantMemory)
      .where(and(eq(merchantMemory.id, id), eq(merchantMemory.userId, userId)))
      .get();
    if (!existing) return null;
    await db.delete(merchantMemory).where(eq(merchantMemory.id, id));
    return { success: true };
  }

  // --- Pending Categorization ---

  async getPendingCategorizations(userId: string) {
    const rows = await db
      .select()
      .from(pendingCategorization)
      .leftJoin(transactions, eq(pendingCategorization.transactionId, transactions.id))
      .where(
        and(eq(pendingCategorization.userId, userId), eq(pendingCategorization.status, 'pending')),
      )
      .all();

    return rows.map((row) => ({
      ...row.pending_categorization,
      transaction: row.transactions,
    }));
  }

  async resolveCategorization(input: ResolveCategorizationInput) {
    const pending = await db
      .select()
      .from(pendingCategorization)
      .where(
        and(
          eq(pendingCategorization.id, input.pendingId),
          eq(pendingCategorization.userId, input.userId),
        ),
      )
      .get();

    if (!pending) return null;

    if (input.action === 'approve') {
      await db
        .update(transactions)
        .set({ category: pending.suggestedCategory, confidenceScore: 1.0 })
        .where(eq(transactions.id, pending.transactionId));
    } else if (input.action === 'modify' && input.category) {
      await db
        .update(transactions)
        .set({
          category: input.category,
          gstApplicable: input.gstApplicable ?? false,
          confidenceScore: 1.0,
        })
        .where(eq(transactions.id, pending.transactionId));

      const tx = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, pending.transactionId))
        .get();
      if (tx?.merchantNormalized) {
        await this.updateMerchantMemory({
          userId: input.userId,
          merchantPattern: tx.merchantNormalized,
          merchantDisplayName: tx.description,
          category: input.category,
          gstApplicable: input.gstApplicable ?? false,
          isUserConfirmed: true,
        });
      }
    }

    await db
      .update(pendingCategorization)
      .set({
        status: input.action,
        userSelectedCategory:
          input.action === 'modify' ? input.category : pending.suggestedCategory,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(pendingCategorization.id, input.pendingId));

    return { success: true };
  }

  // --- Transfers ---

  async getTransfers(userId: string) {
    const sourceTx = aliasedTable(transactions, 'source_tx');
    const destTx = aliasedTable(transactions, 'dest_tx');

    const rows = await db
      .select()
      .from(transferLinks)
      .leftJoin(sourceTx, eq(transferLinks.sourceTransactionId, sourceTx.id))
      .leftJoin(destTx, eq(transferLinks.destinationTransactionId, destTx.id))
      .where(eq(transferLinks.userId, userId))
      .all();

    return rows.map((row) => ({
      ...row.transfer_links,
      sourceTransaction: row.source_tx,
      destinationTransaction: row.dest_tx,
    }));
  }

  async createTransfer(input: CreateTransferInput) {
    const sourceTx = await db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.id, input.sourceTransactionId), eq(transactions.userId, input.userId)),
      )
      .get();
    const destTx = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, input.destinationTransactionId),
          eq(transactions.userId, input.userId),
        ),
      )
      .get();

    if (!sourceTx || !destTx) return null;

    const linkId = crypto.randomUUID();
    await db.insert(transferLinks).values({
      id: linkId,
      userId: input.userId,
      sourceTransactionId: input.sourceTransactionId,
      destinationTransactionId: input.destinationTransactionId,
      sourceAccountId: sourceTx.accountId,
      destinationAccountId: destTx.accountId,
      amount: Math.abs(sourceTx.amount),
      transferDate: sourceTx.date,
      confidence: 1.0,
      isUserConfirmed: true,
      createdAt: new Date().toISOString(),
    });

    await db
      .update(transactions)
      .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
      .where(eq(transactions.id, input.sourceTransactionId));
    await db
      .update(transactions)
      .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
      .where(eq(transactions.id, input.destinationTransactionId));

    return { id: linkId, success: true };
  }

  async deleteTransfer(userId: string, transferId: string) {
    const link = await db
      .select()
      .from(transferLinks)
      .where(and(eq(transferLinks.id, transferId), eq(transferLinks.userId, userId)))
      .get();
    if (!link) return null;

    await db
      .update(transactions)
      .set({ isTransfer: false, transferLinkId: null })
      .where(eq(transactions.id, link.sourceTransactionId));
    await db
      .update(transactions)
      .set({ isTransfer: false, transferLinkId: null })
      .where(eq(transactions.id, link.destinationTransactionId));
    await db.delete(transferLinks).where(eq(transferLinks.id, transferId));

    return { success: true };
  }

  // --- Balance History & Alerts ---

  async getBalanceHistory(userId: string, accountId: string) {
    const account = await this.getAccount(userId, accountId);
    if (!account) return null;
    return db
      .select()
      .from(accountBalanceHistory)
      .where(eq(accountBalanceHistory.accountId, accountId))
      .orderBy(desc(accountBalanceHistory.balanceDate))
      .all();
  }

  async getReconciliationAlerts(userId: string, showResolved: boolean) {
    return db
      .select()
      .from(reconciliationAlerts)
      .where(
        and(
          eq(reconciliationAlerts.userId, userId),
          showResolved ? undefined : eq(reconciliationAlerts.isResolved, false),
        ),
      )
      .orderBy(desc(reconciliationAlerts.createdAt))
      .all();
  }

  async resolveReconciliationAlert(userId: string, alertId: string, notes?: string) {
    const alert = await db
      .select()
      .from(reconciliationAlerts)
      .where(and(eq(reconciliationAlerts.id, alertId), eq(reconciliationAlerts.userId, userId)))
      .get();
    if (!alert) return null;

    await db
      .update(reconciliationAlerts)
      .set({
        isResolved: true,
        resolvedAt: new Date().toISOString(),
        resolutionNotes: notes || null,
      })
      .where(eq(reconciliationAlerts.id, alertId));
    return { success: true };
  }

  // --- Analytics ---

  async getCreditAnalytics(userId: string, accountId: string) {
    const account = await this.getAccount(userId, accountId);
    if (!account) return null;
    if (account.accountType !== 'credit_card') throw new Error('Not a credit card');

    const txs = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), eq(transactions.userId, userId)))
      .orderBy(desc(transactions.date))
      .all();

    const interestTransactions = txs.filter(
      (t) =>
        t.category === 'Interest & Fees' ||
        t.description.toLowerCase().includes('interest') ||
        t.description.toLowerCase().includes('fee'),
    );

    const totalInterestPaid = interestTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalPayments = txs
      .filter((t) => t.amount > 0 && !t.isTransfer)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSpending = txs
      .filter((t) => t.amount < 0 && !t.isTransfer)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const months = new Set(txs.map((t) => t.date.substring(0, 7)));
    const avgMonthlySpending = months.size > 0 ? totalSpending / months.size : 0;
    const utilization =
      account.creditLimit && account.currentBalance
        ? (Math.abs(account.currentBalance) / account.creditLimit) * 100
        : null;

    return {
      accountId,
      accountName: account.accountName,
      creditLimit: account.creditLimit,
      currentBalance: account.currentBalance,
      interestRate: account.interestRate,
      minimumPayment: account.minimumPayment,
      totalInterestPaid,
      totalPayments,
      totalSpending,
      avgMonthlySpending: Math.round(avgMonthlySpending),
      utilization: utilization ? Math.round(utilization * 10) / 10 : null,
      transactionCount: txs.length,
      interestTransactionCount: interestTransactions.length,
      recentInterestCharges: interestTransactions
        .slice(0, 5)
        .map((t) => ({ date: t.date, amount: t.amount, description: t.description })),
    };
  }

  async getConsolidatedSummary(userId: string) {
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId)).all();
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .all();

    const accountSummaries = userAccounts.map((account) => {
      const accountTxs = userTransactions.filter((t) => t.accountId === account.id);
      const totalIncome = accountTxs
        .filter((t) => t.amount > 0 && !t.isTransfer)
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = accountTxs
        .filter((t) => t.amount < 0 && !t.isTransfer)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const totalTransfersIn = accountTxs
        .filter((t) => t.amount > 0 && t.isTransfer)
        .reduce((sum, t) => sum + t.amount, 0);
      const totalTransfersOut = accountTxs
        .filter((t) => t.amount < 0 && t.isTransfer)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        id: account.id,
        name: account.accountName,
        type: account.accountType,
        balance: account.currentBalance,
        totalIncome,
        totalExpenses,
        totalTransfersIn,
        totalTransfersOut,
        transactionCount: accountTxs.length,
      };
    });

    return {
      totalAccounts: userAccounts.length,
      totalTransactions: userTransactions.filter((t) => !t.isTransfer).length,
      accounts: accountSummaries,
    };
  }
}

export const accountService = new AccountService();
