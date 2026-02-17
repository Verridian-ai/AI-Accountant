/**
 * Credit Card Parser Type Definitions
 *
 * Types and interfaces for credit card statement parsing.
 */

import { BankId, AccountInfo } from '../../types';

/**
 * Credit card transaction types
 */
export type CreditCardTransactionType =
  | 'purchase'
  | 'cash_advance'
  | 'interest'
  | 'fee'
  | 'payment'
  | 'refund'
  | 'balance_transfer'
  | 'reward'
  | 'adjustment'
  | 'unknown';

/**
 * A parsed credit card transaction
 */
export interface CreditCardTransaction {
  date: string; // ISO format YYYY-MM-DD
  postDate?: string; // Posting date if different from transaction date
  description: string;
  amount: number; // In cents, positive for charges, negative for payments/credits
  balance?: number; // Running balance in cents

  // Credit card specific fields
  transactionType: CreditCardTransactionType;
  foreignAmount?: number; // Original foreign currency amount in minor units
  foreignCurrency?: string; // ISO currency code (e.g., 'USD', 'EUR')
  conversionRate?: number; // Exchange rate used
  merchantName?: string;
  merchantCategory?: string; // MCC category if available
  cardNumber?: string; // Last 4 digits of card used (for multi-card accounts)

  // Raw data for debugging
  rawDate?: string;
  rawAmount?: string;
  rawDescription?: string;
  rawForeignAmount?: string;
  lineNumber?: number;
}

/**
 * Credit card account information
 */
export interface CreditCardAccountInfo extends AccountInfo {
  accountType: 'credit';

  // Credit card specific fields
  cardNumber?: string; // Masked card number (e.g., "XXXX XXXX XXXX 1234")
  cardHolder?: string;
  cardType?: string; // Visa, Mastercard, Amex, etc.

  // Credit limits
  creditLimit?: number; // In cents
  availableCredit?: number; // In cents
  cashAdvanceLimit?: number; // In cents
  availableCashAdvance?: number; // In cents

  // Balances
  previousBalance?: number; // In cents
  newCharges?: number; // In cents
  paymentsReceived?: number; // In cents
  interestCharged?: number; // In cents
  feesCharged?: number; // In cents
  currentBalance?: number; // In cents

  // Payment information
  minimumPaymentDue?: number; // In cents
  paymentDueDate?: string; // ISO date

  // Interest rates
  purchaseAPR?: number; // Annual percentage rate for purchases (e.g., 19.99)
  cashAdvanceAPR?: number; // Annual percentage rate for cash advances
  balanceTransferAPR?: number; // Annual percentage rate for balance transfers
  penaltyAPR?: number; // Penalty APR for late payments

  // Statement period
  statementDate?: string; // Date statement was generated
  billingCycleStart?: string; // ISO date
  billingCycleEnd?: string; // ISO date
  daysInBillingCycle?: number;

  // Rewards (optional)
  rewardPointsEarned?: number;
  rewardPointsBalance?: number;
}

/**
 * Complete result from parsing a credit card statement
 */
export interface CreditCardStatementParseResult {
  success: boolean;
  bankId: BankId;
  bankName: string;
  accountInfo: CreditCardAccountInfo;
  transactions: CreditCardTransaction[];
  parseWarnings: string[];
  parseErrors: string[];

  // Statement summary
  totalPurchases?: number; // In cents
  totalCashAdvances?: number;
  totalInterestCharges?: number;
  totalFees?: number;
  totalPayments?: number;
  totalCredits?: number;

  // Foreign transaction summary
  foreignTransactionCount?: number;
  foreignTransactionTotal?: number;

  // Metadata
  pageCount?: number;
  detectionConfidence: number;
  parserUsed: string;
  processingTimeMs: number;

  // Is this a credit card statement (vs regular bank statement)?
  isCreditCardStatement: true;
}

/**
 * Configuration for a credit card parser
 */
export interface CreditCardParserConfig {
  bankId: BankId;
  bankName: string;
  displayName: string;

  // Date formats used by this bank (in order of preference)
  dateFormats: string[];

  // Patterns to identify this bank's credit card statements
  headerPatterns: RegExp[];

  // Minimum number of header patterns that must match
  minHeaderMatches: number;

  // Patterns to identify this as a credit card statement (vs bank statement)
  creditCardIndicators: RegExp[];

  // Card number patterns
  cardNumberPatterns: RegExp[];

  // Account patterns
  accountPatterns: RegExp[];

  // Transaction type detection patterns
  transactionTypePatterns: Record<CreditCardTransactionType, RegExp[]>;

  // Foreign transaction patterns
  foreignTransactionPatterns: RegExp[];

  // Balance patterns
  creditLimitPattern?: RegExp;
  availableCreditPattern?: RegExp;
  minimumPaymentPattern?: RegExp;
  paymentDueDatePattern?: RegExp;
  openingBalancePattern?: RegExp;
  closingBalancePattern?: RegExp;

  // Interest rate patterns
  purchaseAPRPattern?: RegExp;
  cashAdvanceAPRPattern?: RegExp;

  // Statement period patterns
  statementPeriodPatterns?: RegExp[];
  billingCyclePatterns?: RegExp[];
}

/**
 * Interface for credit card parsers
 */
export interface CreditCardParser {
  config: CreditCardParserConfig;

  /**
   * Detect if this is a credit card statement and if this parser can handle it
   */
  detect(pdfText: string): CreditCardDetectionResult;

  /**
   * Parse transactions from PDF text
   */
  parseTransactions(pdfText: string): Promise<CreditCardTransaction[]>;

  /**
   * Extract credit card account information from PDF text
   */
  extractAccountInfo(pdfText: string): Promise<CreditCardAccountInfo>;

  /**
   * Full parsing with all information
   */
  parse(pdfText: string): Promise<CreditCardStatementParseResult>;
}

/**
 * Result of credit card statement detection
 */
export interface CreditCardDetectionResult {
  bankId: BankId;
  bankName: string;
  confidence: number; // 0-1 confidence score
  matchedPatterns: string[];
  isCreditCardStatement: boolean;
  creditCardConfidence: number; // Confidence this is a credit card (vs bank) statement
  detectedCardType?: string; // Visa, Mastercard, etc.
  suggestedParser: string;
}
