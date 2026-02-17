/**
 * QIF Parser Helpers
 *
 * Extraction and conversion utilities for QIF transaction parsing.
 */

import { ParsedTransaction, AccountType } from '../types.js';
import { QIFType, QIFTransaction, QIFAccountInfo } from './qif-types.js';
import { getDateFormatsForLocale, isValidDate, formatISODate } from './qif-date-formats.js';

/**
 * Normalize QIF type string
 */
export function normalizeQIFType(typeStr: string): QIFType {
  const typeMap: Record<string, QIFType> = {
    bank: 'Bank',
    cash: 'Cash',
    ccard: 'CCard',
    creditcard: 'CCard',
    'credit card': 'CCard',
    invst: 'Invst',
    investment: 'Invst',
    'oth a': 'Oth A',
    'oth l': 'Oth L',
    cat: 'Cat',
    category: 'Cat',
    class: 'Class',
    memorized: 'Memorized',
  };

  return typeMap[typeStr.toLowerCase()] || 'Bank';
}

/**
 * Map QIF type to internal account type
 */
export function mapQIFTypeToAccountType(qifType: QIFType): AccountType {
  const typeMap: Record<QIFType, AccountType> = {
    Bank: 'transaction',
    Cash: 'transaction',
    CCard: 'credit',
    Invst: 'unknown',
    'Oth A': 'unknown',
    'Oth L': 'loan',
    Cat: 'unknown',
    Class: 'unknown',
    Memorized: 'unknown',
  };

  return typeMap[qifType] || 'unknown';
}

/**
 * Extract account information from header
 */
export function extractAccountInfo(content: string): QIFAccountInfo | null {
  const accountMatch = content.match(/^!Account([\s\S]*?)(?=^!Type:|^!Account|$)/im);
  if (!accountMatch) {
    return null;
  }

  const block = accountMatch[1];
  const lines = block.split('\n');

  const info: QIFAccountInfo = {
    type: 'Bank',
  };

  for (const line of lines) {
    if (line.length < 2) continue;

    const field = line[0];
    const value = line.substring(1).trim();

    switch (field) {
      case 'N':
        info.name = value;
        break;
      case 'T':
        info.type = normalizeQIFType(value);
        break;
      case 'D':
        info.description = value;
        break;
      case 'L':
        info.creditLimit = value;
        break;
      case 'B':
        info.statementBalance = value;
        break;
    }
  }

  return info;
}

/**
 * Parse a single transaction block
 */
export function parseTransactionBlock(block: string): QIFTransaction | null {
  const lines = block.split('\n');
  const tx: QIFTransaction = {
    date: '',
    amount: '',
    address: [],
    splitCategory: [],
    splitMemo: [],
    splitAmount: [],
  };

  for (const line of lines) {
    if (line.length < 2) continue;

    const field = line[0];
    const value = line.substring(1).trim();

    switch (field) {
      case 'D':
        tx.date = value;
        break;
      case 'T':
      case 'U':
        tx.amount = value;
        break;
      case 'P':
        tx.payee = value;
        break;
      case 'M':
        tx.memo = value;
        break;
      case 'L':
        tx.category = value;
        break;
      case 'N':
        tx.number = value;
        break;
      case 'C':
        tx.clearedStatus = value;
        break;
      case 'A':
        tx.address!.push(value);
        break;
      case 'S':
        tx.splitCategory!.push(value);
        break;
      case 'E':
        tx.splitMemo!.push(value);
        break;
      case '$':
        tx.splitAmount!.push(value);
        break;
      case 'F':
        tx.reimbursableExpense = value === '1' || value.toLowerCase() === 'true';
        break;
    }
  }

  // Must have at least date and amount
  if (!tx.date || !tx.amount) {
    return null;
  }

  return tx;
}

/**
 * Extract all transactions from QIF content
 */
export function extractTransactions(content: string): QIFTransaction[] {
  const transactions: QIFTransaction[] = [];

  const typeMatch = content.match(/^!Type:\S+/im);
  if (!typeMatch || typeMatch.index === undefined) {
    return transactions;
  }

  const transactionSection = content.substring(typeMatch.index + typeMatch[0].length);
  const blocks = transactionSection.split(/^\^/m);

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    // Skip if this is another header
    if (trimmedBlock.startsWith('!')) continue;

    const transaction = parseTransactionBlock(trimmedBlock);
    if (transaction) {
      transactions.push(transaction);
    }
  }

  return transactions;
}

/**
 * Parse QIF date string to ISO format
 */
export function parseQIFDate(dateStr: string, preferredFormat: 'US' | 'AU'): string | null {
  if (!dateStr) return null;

  const cleanDate = dateStr.trim();
  const formats = getDateFormatsForLocale(preferredFormat);

  for (const format of formats) {
    const match = cleanDate.match(format.pattern);
    if (match) {
      const parsed = format.parse(match);
      if (parsed && isValidDate(parsed.year, parsed.month, parsed.day)) {
        return formatISODate(parsed.year, parsed.month, parsed.day);
      }
    }
  }

  return null;
}

/**
 * Parse amount string to cents
 */
export function parseQIFAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === '') {
    return 0;
  }

  let cleaned = amountStr.replace(/[$,\s]/g, '').trim();

  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) {
    cleaned = cleaned.slice(1, -1);
  }

  const hasNegativeSign = cleaned.startsWith('-');
  if (hasNegativeSign) {
    cleaned = cleaned.slice(1);
  }

  const value = parseFloat(cleaned);
  if (isNaN(value)) {
    return 0;
  }

  let cents = Math.round(value * 100);

  if (isNegative || hasNegativeSign) {
    cents = -cents;
  }

  return cents;
}

/**
 * Convert QIF transaction to standard format
 */
export function convertTransaction(
  tx: QIFTransaction,
  index: number,
  dateFormat: 'US' | 'AU',
): ParsedTransaction | null {
  const date = parseQIFDate(tx.date, dateFormat);
  if (!date) {
    throw new Error(`Invalid date format: ${tx.date}`);
  }

  const amountCents = parseQIFAmount(tx.amount);

  let description = tx.payee || '';
  if (tx.memo && tx.memo !== tx.payee) {
    description = description ? `${description} - ${tx.memo}` : tx.memo;
  }
  if (!description) {
    description = 'Transaction';
  }

  let reference: string | undefined;
  if (tx.number) {
    reference = tx.number.match(/^\d+$/) ? `Check #${tx.number}` : tx.number;
  }

  return {
    date,
    description: description
      .replace(/\s+/g, ' ')
      .replace(/^\s*-\s*/, '')
      .trim(),
    amount: amountCents,
    reference,
    category: tx.category,
    rawDate: tx.date,
    rawAmount: tx.amount,
    rawDescription: `${tx.payee || ''} ${tx.memo || ''}`.trim(),
    lineNumber: index + 1,
  };
}
