/**
 * Transaction Service
 * Queries, mutations, and export for transaction data.
 */

import { transactionRepository } from '../../repositories/transaction-repository.js';
import { transactions } from '../../schema.js';
import crypto from 'crypto';
import type { ListTransactionsFilters, UpdateTransactionInput, TransactionSplit } from './types.js';

type Transaction = typeof transactions.$inferSelect;

export class TransactionService {
  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  async listTransactions(userId: string, filters: ListTransactionsFilters) {
    const repoResult = await transactionRepository.findMany({ ...filters, userId });
    return { transactions: repoResult.data, total: repoResult.total };
  }

  async getTransaction(userId: string, transactionId: string) {
    return transactionRepository.findById(userId, transactionId);
  }

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  async updateTransaction(userId: string, transactionId: string, data: UpdateTransactionInput) {
    const oldData = await this.getTransaction(userId, transactionId);
    if (!oldData) return null;

    const updateData = {
      description: data.description ?? oldData.description,
      amount: data.amount ?? oldData.amount,
      category: data.category ?? oldData.category,
      gstApplicable: data.gstApplicable ?? oldData.gstApplicable,
      isEdited: true,
    };

    await transactionRepository.update(userId, transactionId, updateData);

    await transactionRepository.createHistory({
      id: crypto.randomUUID(),
      transactionId,
      changeType: 'EDIT',
      oldData: JSON.stringify(oldData),
      newData: JSON.stringify(updateData),
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  async splitTransaction(userId: string, transactionId: string, splits: TransactionSplit[]) {
    const original = await this.getTransaction(userId, transactionId);
    if (!original) return null;

    const newTransactions = splits.map((split) => ({
      id: crypto.randomUUID(),
      date: original.date,
      description: split.description || original.description,
      amount: split.amount,
      balance: original.balance,
      category: split.category,
      gstApplicable: split.gst,
      parentTransactionId: original.id,
      userId: userId,
      isEdited: true,
    }));

    await transactionRepository.createMany(newTransactions);

    // Zero out the original to effectively "hide" it from totals but keep it for reference
    await transactionRepository.update(userId, transactionId, {
      amount: 0,
      isEdited: true,
      aiReasoningNotes: 'Split into multiple transactions',
    });

    await transactionRepository.createHistory({
      id: crypto.randomUUID(),
      transactionId,
      changeType: 'SPLIT',
      oldData: JSON.stringify(original),
      newData: JSON.stringify(newTransactions),
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  async deleteTransaction(userId: string, transactionId: string) {
    const existing = await this.getTransaction(userId, transactionId);
    if (!existing) return null;

    // Record deletion in history
    await transactionRepository.createHistory({
      id: crypto.randomUUID(),
      transactionId,
      changeType: 'DELETE',
      oldData: JSON.stringify(existing),
      newData: null,
      timestamp: new Date().toISOString(),
    });

    // Delete the transaction
    await transactionRepository.delete(userId, transactionId);

    return { success: true };
  }

  // --------------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------------

  async exportTransactions(
    userId: string,
    filters: ListTransactionsFilters,
    format: 'csv' | 'xlsx' = 'csv',
  ) {
    const exportData = await transactionRepository.findAll({ ...filters, userId });

    const formattedData = exportData.map((t: Transaction) => {
      // Ensure date is in DD/MM/YYYY format for Australia
      const dateParts = t.date.split('-'); // Assuming YYYY-MM-DD
      const formattedDate =
        dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : t.date;

      return {
        Date: formattedDate,
        Description: t.description,
        Amount: (t.amount / 100).toFixed(2),
        Category: t.category || 'Uncategorized',
        'GST Applicable': t.gstApplicable ? 'Yes' : 'No',
        'AI Reasoning': t.aiReasoningNotes || '',
      };
    });

    if (format === 'xlsx') {
      // Dynamic import for optional dependency
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.default.Workbook();
      const worksheet = workbook.addWorksheet('Transactions');

      if (formattedData.length > 0) {
        worksheet.columns = Object.keys(formattedData[0]).map((key) => ({
          header: key,
          key: key,
          width: key === 'Description' ? 40 : 15,
        }));
        worksheet.addRows(formattedData);
      }
      return await workbook.xlsx.writeBuffer();
    } else {
      return this._generateCSV(formattedData);
    }
  }

  private _generateCSV(data: Record<string, unknown>[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const headerRow = headers.map((h) => `"${h}"`).join(',');

    const rows = data.map((row) => {
      return headers
        .map((header) => {
          let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
          if (cell.includes('"') || cell.includes(',') || cell.includes('\n')) {
            cell = `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(',');
    });

    return [headerRow, ...rows].join('\n');
  }
}

export const transactionService = new TransactionService();
