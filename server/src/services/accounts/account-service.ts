/**
 * Account Service — Core account operations, merchant memory,
 * categorization, transfers, balance history, and analytics.
 */

import { accountRepository } from '../../repositories/account-repository.js';
import { transactionRepository } from '../../repositories/transaction-repository.js';
import crypto from 'crypto';
import type {
  CreateAccountInput,
  UpdateMerchantMemoryInput,
  ResolveCategorizationInput,
  CreateTransferInput,
} from './types.js';
import {
  getCreditAnalytics as _getCreditAnalytics,
  getConsolidatedSummary as _getConsolidatedSummary,
} from './analytics.js';
import {
  getTransfers as _getTransfers,
  createTransfer as _createTransfer,
  deleteTransfer as _deleteTransfer,
  getBalanceHistory as _getBalanceHistory,
  getReconciliationAlerts as _getReconciliationAlerts,
  resolveReconciliationAlert as _resolveReconciliationAlert,
} from './transfers-alerts.js';

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
    const pendingItems = await accountRepository.findPendingCategorizations(userId);

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

  // --- Transfers (delegated to transfers-alerts.ts) ---

  async getTransfers(userId: string) {
    return _getTransfers(userId);
  }

  async createTransfer(input: CreateTransferInput) {
    return _createTransfer(input);
  }

  async deleteTransfer(userId: string, transferId: string) {
    return _deleteTransfer(userId, transferId);
  }

  // --- Balance History & Alerts (delegated to transfers-alerts.ts) ---

  async getBalanceHistory(userId: string, accountId: string) {
    return _getBalanceHistory(this, userId, accountId);
  }

  async getReconciliationAlerts(userId: string, showResolved: boolean) {
    return _getReconciliationAlerts(userId, showResolved);
  }

  async resolveReconciliationAlert(userId: string, alertId: string, notes?: string) {
    return _resolveReconciliationAlert(userId, alertId, notes);
  }

  // --- Analytics (delegated to analytics.ts) ---

  async getCreditAnalytics(userId: string, accountId: string) {
    return _getCreditAnalytics(this, userId, accountId);
  }

  async getConsolidatedSummary(userId: string) {
    return _getConsolidatedSummary(userId);
  }
}
