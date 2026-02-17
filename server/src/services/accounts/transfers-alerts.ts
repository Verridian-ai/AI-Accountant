/**
 * Account Service — Transfer operations, balance history, and reconciliation alerts.
 */

import { accountRepository } from '../../repositories/account-repository.js';
import { transactionRepository } from '../../repositories/transaction-repository.js';
import crypto from 'crypto';
import type { CreateTransferInput } from './types.js';
import type { AccountService } from './account-service.js';

// --- Transfers ---

export async function getTransfers(userId: string) {
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

export async function createTransfer(input: CreateTransferInput) {
  const sourceTx = await transactionRepository.findById(input.userId, input.sourceTransactionId);
  const destTx = await transactionRepository.findById(input.userId, input.destinationTransactionId);

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

export async function deleteTransfer(userId: string, transferId: string) {
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

export async function getBalanceHistory(
  service: AccountService,
  userId: string,
  accountId: string,
) {
  const account = await service.getAccount(userId, accountId);
  if (!account) return null;
  return accountRepository.findBalanceHistory(accountId);
}

export async function getReconciliationAlerts(userId: string, showResolved: boolean) {
  return accountRepository.findReconciliationAlerts(userId, showResolved);
}

export async function resolveReconciliationAlert(userId: string, alertId: string, notes?: string) {
  const alert = await accountRepository.findReconciliationAlertById(userId, alertId);
  if (!alert) return null;

  await accountRepository.updateReconciliationAlert(alertId, {
    isResolved: true,
    resolvedAt: new Date().toISOString(),
    resolutionNotes: notes || null,
  });
  return { success: true };
}
