/**
 * QIF Parser Type Definitions
 *
 * Types and interfaces for QIF (Quicken Interchange Format) parsing.
 */

import { ParsedTransaction, AccountType } from '../types.js';

/**
 * QIF section types
 */
export type QIFType =
  | 'Bank'
  | 'Cash'
  | 'CCard'
  | 'Invst'
  | 'Oth A'
  | 'Oth L'
  | 'Cat'
  | 'Class'
  | 'Memorized';

/**
 * Raw QIF transaction data
 */
export interface QIFTransaction {
  /** Date (D field) */
  date: string;
  /** Amount (T field) */
  amount: string;
  /** Payee (P field) */
  payee?: string;
  /** Memo (M field) */
  memo?: string;
  /** Category (L field) */
  category?: string;
  /** Check number (N field) */
  number?: string;
  /** Cleared status (C field): *, c, X, x, R, r */
  clearedStatus?: string;
  /** Address lines (A field) - can be multiple */
  address?: string[];
  /** Split category (S field) */
  splitCategory?: string[];
  /** Split memo (E field) */
  splitMemo?: string[];
  /** Split amount ($ field) */
  splitAmount?: string[];
  /** Reimbursable expense flag (F field) */
  reimbursableExpense?: boolean;
}

/**
 * QIF account header information
 */
export interface QIFAccountInfo {
  /** Account name (N field in account header) */
  name?: string;
  /** Account type */
  type: QIFType;
  /** Description (D field in account header) */
  description?: string;
  /** Credit limit (L field in account header) */
  creditLimit?: string;
  /** Statement balance (B field) */
  statementBalance?: string;
}

export interface QIFParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  accountType: AccountType;
  accountName: string | null;
  qifType: QIFType | null;
  errors: string[];
  warnings: string[];
  metadata: {
    rowCount: number;
    parsedCount: number;
    skippedCount: number;
    dateRange?: {
      start: string;
      end: string;
    };
  };
}
