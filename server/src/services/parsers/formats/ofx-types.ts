/**
 * OFX/QFX Parser Type Definitions
 *
 * Types and interfaces for OFX (Open Financial Exchange) and QFX parsing.
 */

import { ParsedTransaction, AccountType } from '../types.js';

export interface OFXTransaction {
  /** Transaction type: DEBIT, CREDIT, INT, DIV, FEE, SRVCHG, DEP, ATM, POS, XFER, CHECK, PAYMENT, CASH, DIRECTDEP, DIRECTDEBIT, REPEATPMT, OTHER */
  trntype: string;
  /** Date posted (YYYYMMDD or YYYYMMDDHHMMSS format) */
  dtposted: string;
  /** Transaction amount (positive = credit, negative = debit) */
  trnamt: string;
  /** Financial institution transaction ID */
  fitid: string;
  /** Check number (optional) */
  checknum?: string;
  /** Reference number (optional) */
  refnum?: string;
  /** Payee name */
  name?: string;
  /** Memo/description */
  memo?: string;
  /** Standard Industrial Classification code (optional) */
  sic?: string;
  /** Payee ID (optional) */
  payeeid?: string;
}

export interface OFXAccountInfo {
  /** Bank ID (routing number) */
  bankid?: string;
  /** Branch ID (optional) */
  branchid?: string;
  /** Account ID */
  acctid: string;
  /** Account type: CHECKING, SAVINGS, MONEYMRKT, CREDITLINE */
  accttype?: string;
  /** Currency */
  currency?: string;
}

export interface OFXStatement {
  /** Account information */
  account: OFXAccountInfo;
  /** Statement transactions */
  transactions: OFXTransaction[];
  /** Ledger balance */
  ledgerBalance?: {
    amount: string;
    dateAsOf: string;
  };
  /** Available balance */
  availableBalance?: {
    amount: string;
    dateAsOf: string;
  };
  /** Statement period start */
  dtstart?: string;
  /** Statement period end */
  dtend?: string;
}

export interface OFXParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  accountNumber: string | null;
  accountType: AccountType;
  bankId: string | null;
  currency: string | null;
  statementPeriod?: {
    start: string;
    end: string;
  };
  balances?: {
    ledger?: number;
    available?: number;
  };
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
