/**
 * Account Service — Analytics methods (credit analytics, consolidated summary).
 */

import { accountRepository } from '../../repositories/account-repository.js';
import { transactionRepository } from '../../repositories/transaction-repository.js';
import type { TransactionRow, AccountRow } from './types.js';
import { AccountService } from './account-service.js';

/**
 * Extends AccountService with analytics capabilities.
 * This mixin-style approach keeps the analytics logic separate
 * while maintaining a single service class.
 */

export async function getCreditAnalytics(
  service: AccountService,
  userId: string,
  accountId: string,
) {
  const account = await service.getAccount(userId, accountId);
  if (!account) return null;
  if (account.accountType !== 'credit_card') throw new Error('Not a credit card');

  // Fetch all transactions for this account — no artificial cap
  const txs = (await transactionRepository.findAll({ userId, accountId })) as TransactionRow[];

  const interestTransactions = txs.filter(
    (t: TransactionRow) =>
      t.category === 'Interest & Fees' ||
      t.description.toLowerCase().includes('interest') ||
      t.description.toLowerCase().includes('fee'),
  );

  const totalInterestPaid = interestTransactions.reduce(
    (sum: number, t: TransactionRow) => sum + Math.abs(t.amount),
    0,
  );
  const totalPayments = txs
    .filter((t: TransactionRow) => t.amount > 0 && !t.isTransfer)
    .reduce((sum: number, t: TransactionRow) => sum + t.amount, 0);
  const totalSpending = txs
    .filter((t: TransactionRow) => t.amount < 0 && !t.isTransfer)
    .reduce((sum: number, t: TransactionRow) => sum + Math.abs(t.amount), 0);

  const months = new Set(txs.map((t: TransactionRow) => t.date.substring(0, 7)));
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
    recentInterestCharges: interestTransactions.slice(0, 5).map((t: TransactionRow) => ({
      date: t.date,
      amount: t.amount,
      description: t.description,
    })),
  };
}

export async function getConsolidatedSummary(userId: string) {
  const userAccounts = (await accountRepository.findAll(userId)) as AccountRow[];
  // Fetch all user transactions — no artificial cap
  const userTransactions = (await transactionRepository.findAll({ userId })) as TransactionRow[];

  const accountSummaries = userAccounts.map((account: AccountRow) => {
    const accountTxs = userTransactions.filter((t: TransactionRow) => t.accountId === account.id);
    const totalIncome = accountTxs
      .filter((t: TransactionRow) => t.amount > 0 && !t.isTransfer)
      .reduce((sum: number, t: TransactionRow) => sum + t.amount, 0);
    const totalExpenses = accountTxs
      .filter((t: TransactionRow) => t.amount < 0 && !t.isTransfer)
      .reduce((sum: number, t: TransactionRow) => sum + Math.abs(t.amount), 0);
    const totalTransfersIn = accountTxs
      .filter((t: TransactionRow) => t.amount > 0 && t.isTransfer)
      .reduce((sum: number, t: TransactionRow) => sum + t.amount, 0);
    const totalTransfersOut = accountTxs
      .filter((t: TransactionRow) => t.amount < 0 && t.isTransfer)
      .reduce((sum: number, t: TransactionRow) => sum + Math.abs(t.amount), 0);

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
    totalTransactions: userTransactions.filter((t: TransactionRow) => !t.isTransfer).length,
    accounts: accountSummaries,
  };
}
