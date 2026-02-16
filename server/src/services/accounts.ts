import { accountRepository } from '../repositories/account-repository.js';
import { transactionRepository } from '../repositories/transaction-repository.js'; // Use the repo for transactions
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
    return accountRepository.findByHash(userId, accountHash);
  }

  async getUserAccounts(
    userId: string,
    filters?: { ownershipTag?: string; type?: string; search?: string },
  ) {
    return accountRepository.findAll(userId, filters);
  }

  async getAccount(userId: string, accountId: string) {
    return accountRepository.findById(userId, accountId);
  }

  async getChartOfAccounts(userId: string) {
    return accountRepository.getChartOfAccounts(userId);
  }

  async createAccount(input: CreateAccountInput) {
    const accountHash = this.hashAccountNumber(input.accountNumber);
    const existing = await this.findAccountByHash(input.userId, accountHash);

    if (existing) {
      throw new Error('Account already exists');
    }

    const id = crypto.randomUUID();
    await accountRepository.create({
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

    await accountRepository.update(userId, accountId, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  }

  async deleteAccount(userId: string, accountId: string) {
    const existing = await this.getAccount(userId, accountId);
    if (!existing) return null;
    await accountRepository.delete(userId, accountId);
    return { success: true };
  }

  async getAccountBalance(userId: string, accountId: string) {
    const account = await this.getAccount(userId, accountId);
    if (!account) return null;
    return account.currentBalance;
  }

  async updateAccountBalance(accountId: string, newBalance: number) {
    await accountRepository.updateBalance(accountId, newBalance);
  }

  async linkStatementToAccount(statementId: string, accountId: string) {
    await accountRepository.linkStatement(statementId, accountId);
  }

  // --- Merchant Memory ---

  async getMerchantMemory(userId: string) {
    return accountRepository.findMerchantMemory(userId);
  }

  async updateMerchantMemory(input: UpdateMerchantMemoryInput) {
    const existing = await accountRepository.findMerchantMemoryByPattern(
      input.userId,
      input.merchantPattern,
    );

    if (existing) {
      await accountRepository.updateMerchantMemory(existing.id, {
        category: input.category,
        gstApplicable: input.gstApplicable,
        merchantDisplayName: input.merchantDisplayName,
        isUserConfirmed: input.isUserConfirmed,
        timesUsed: (existing.timesUsed || 0) + 1,
        lastUsed: new Date().toISOString(),
      });
    } else {
      await accountRepository.createMerchantMemory({
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
    const existing = await accountRepository.findMerchantMemoryById(userId, id);
    if (!existing) return null;

    await accountRepository.updateMerchantMemory(id, {
      category: data.category ?? existing.category,
      gstApplicable: data.gstApplicable ?? existing.gstApplicable,
      merchantDisplayName: data.merchantDisplayName ?? existing.merchantDisplayName,
      isUserConfirmed: true,
    });

    return { success: true };
  }

  async deleteMerchantMemory(userId: string, id: string) {
    const existing = await accountRepository.findMerchantMemoryById(userId, id);
    if (!existing) return null;
    await accountRepository.deleteMerchantMemory(id);
    return { success: true };
  }

  // --- Pending Categorization ---

  async getPendingCategorizations(userId: string) {
    // This is where things get tricky with the repository pattern and joins.
    // Ideally, the repository returns joined data, OR the service fetches separately.
    // The previous implementation did a join.
    // For now, let's fetch pending items, then fetch transactions.
    // This is "N+1" ish but for "pending" items it's usually small.
    // OR we can add `findPendingCategorizationsWithTransactions` to repository.
    // But `AccountRepository` shouldn't know about `transactions` table details ideally?
    // Actually, it's fine if they are in the same schema.
    // But I defined `findPendingCategorizations` to return just the rows.
    // Let's iterate.
    const pendingItems = await accountRepository.findPendingCategorizations(userId);

    // Enrich with transactions
    // We can use transactionRepository.findByIds if we implement it, or loop.
    const results = [];
    for (const item of pendingItems) {
      const transaction = await transactionRepository.findById(userId, item.transactionId);
      results.push({
        ...item,
        transaction,
      });
    }
    return results;
  }

  async resolveCategorization(input: ResolveCategorizationInput) {
    const pending = await accountRepository.findPendingCategorizationById(
      input.userId,
      input.pendingId,
    );

    if (!pending) return null;

    if (input.action === 'approve') {
      await transactionRepository.update(input.userId, pending.transactionId, {
        category: pending.suggestedCategory,
        confidenceScore: 1.0,
      });
    } else if (input.action === 'modify' && input.category) {
      await transactionRepository.update(input.userId, pending.transactionId, {
        category: input.category,
        gstApplicable: input.gstApplicable ?? false,
        confidenceScore: 1.0,
      });

      const tx = await transactionRepository.findById(input.userId, pending.transactionId);
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

    await accountRepository.updatePendingCategorization(input.pendingId, {
      status: input.action,
      userSelectedCategory: input.action === 'modify' ? input.category : pending.suggestedCategory,
      resolvedAt: new Date().toISOString(),
    });

    return { success: true };
  }

  // --- Transfers ---

  async getTransfers(userId: string) {
    // Similar join issue. Fetch links, then fetch transactions.
    const links = await accountRepository.findTransferLinks(userId);
    const results = [];
    for (const link of links) {
      const sourceTransaction = await transactionRepository.findById(
        userId,
        link.sourceTransactionId,
      );
      const destinationTransaction = await transactionRepository.findById(
        userId,
        link.destinationTransactionId,
      );
      results.push({
        ...link,
        sourceTransaction,
        destinationTransaction,
      });
    }
    return results;
  }

  async createTransfer(input: CreateTransferInput) {
    const sourceTx = await transactionRepository.findById(input.userId, input.sourceTransactionId);
    const destTx = await transactionRepository.findById(
      input.userId,
      input.destinationTransactionId,
    );

    if (!sourceTx || !destTx) return null;

    const linkId = crypto.randomUUID();
    await accountRepository.createTransferLink({
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

    await transactionRepository.update(input.userId, input.sourceTransactionId, {
      isTransfer: true,
      transferLinkId: linkId,
      category: 'Transfer',
    });

    await transactionRepository.update(input.userId, input.destinationTransactionId, {
      isTransfer: true,
      transferLinkId: linkId,
      category: 'Transfer',
    });

    return { id: linkId, success: true };
  }

  async deleteTransfer(userId: string, transferId: string) {
    const link = await accountRepository.findTransferLinkById(userId, transferId);
    if (!link) return null;

    await transactionRepository.update(userId, link.sourceTransactionId, {
      isTransfer: false,
      transferLinkId: null,
    });

    await transactionRepository.update(userId, link.destinationTransactionId, {
      isTransfer: false,
      transferLinkId: null,
    });

    await accountRepository.deleteTransferLink(transferId);

    return { success: true };
  }

  // --- Balance History & Alerts ---

  async getBalanceHistory(userId: string, accountId: string) {
    const account = await this.getAccount(userId, accountId);
    if (!account) return null;
    return accountRepository.findBalanceHistory(accountId);
  }

  async getReconciliationAlerts(userId: string, showResolved: boolean) {
    return accountRepository.findReconciliationAlerts(userId, showResolved);
  }

  async resolveReconciliationAlert(userId: string, alertId: string, notes?: string) {
    const alert = await accountRepository.findReconciliationAlertById(userId, alertId);
    if (!alert) return null;

    await accountRepository.updateReconciliationAlert(alertId, {
      isResolved: true,
      resolvedAt: new Date().toISOString(),
      resolutionNotes: notes || null,
    });
    return { success: true };
  }

  // --- Analytics ---

  async getCreditAnalytics(userId: string, accountId: string) {
    const account = await this.getAccount(userId, accountId);
    if (!account) return null;
    if (account.accountType !== 'credit_card') throw new Error('Not a credit card');

    // Fetch all transactions for this account
    // transactionRepository.findMany supports filtering by accountId
    const txsResult = await transactionRepository.findMany({
      userId,
      accountId,
      limit: 10000, // Fetch all reasonably
    });
    const txs = txsResult.data;

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
    const userAccounts = await accountRepository.findAll(userId);
    // Fetch all user transactions
    const txsResult = await transactionRepository.findMany({ userId, limit: 100000 });
    const userTransactions = txsResult.data;

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
