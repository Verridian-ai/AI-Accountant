/**
 * Multi-Bank Statement Parser Types
 *
 * Defines interfaces and types for bank statement parsing across
 * multiple Australian banks.
 */

/**
 * Supported Australian banks
 */
export type BankId =
  | 'cba'
  | 'anz'
  | 'westpac'
  | 'nab'
  | 'stgeorge'
  | 'bendigo'
  | 'ing'
  | 'macquarie'
  | 'bankwest'
  | 'suncorp'
  | 'unknown';

/**
 * Account types that can be detected from statements
 */
export type AccountType =
  | 'transaction'
  | 'savings'
  | 'credit'
  | 'business'
  | 'offset'
  | 'loan'
  | 'term_deposit'
  | 'unknown';

/**
 * Transaction type indicators
 */
export type TransactionDirection = 'debit' | 'credit';

/**
 * Result of bank detection on a statement
 */
export interface BankDetectionResult {
  bankId: BankId;
  bankName: string;
  confidence: number; // 0-1 confidence score
  matchedPatterns: string[]; // Which patterns matched
  detectedAccountType?: AccountType;
  suggestedParser: string;
}

/**
 * Configuration for parsing transactions from a specific bank
 */
export interface TransactionPatternConfig {
  // Column positions or patterns for extracting data
  datePattern: RegExp;
  descriptionPattern?: RegExp;
  amountPattern: RegExp;
  balancePattern?: RegExp;

  // How to identify debit vs credit
  debitIndicators?: string[];
  creditIndicators?: string[];
  separateDebitCreditColumns?: boolean;

  // Line-level pattern for full transaction row
  transactionLinePattern?: RegExp;
}

/**
 * Configuration for a bank parser
 */
export interface BankParserConfig {
  bankId: BankId;
  bankName: string;
  displayName: string;

  // Date formats used by this bank (in order of preference)
  dateFormats: string[];

  // Patterns to identify this bank's statements
  headerPatterns: RegExp[];

  // Minimum number of header patterns that must match
  minHeaderMatches: number;

  // Account number patterns
  accountPatterns: RegExp[];

  // Transaction parsing configuration
  transactionPatterns: TransactionPatternConfig;

  // Account type detection
  accountTypes: Record<string, AccountType>;

  // Statement period detection
  periodPatterns?: RegExp[];

  // Opening/closing balance patterns
  openingBalancePattern?: RegExp;
  closingBalancePattern?: RegExp;
}

/**
 * A parsed transaction from a bank statement
 */
export interface ParsedTransaction {
  date: string; // ISO format YYYY-MM-DD
  description: string;
  amount: number; // In cents, negative for debits
  balance?: number; // Running balance in cents
  reference?: string;
  category?: string;
  merchantName?: string;

  // Raw data for debugging
  rawDate?: string;
  rawAmount?: string;
  rawDescription?: string;
  lineNumber?: number;
}

/**
 * Account information extracted from statement
 */
export interface AccountInfo {
  accountNumber: string;
  accountName?: string;
  accountType: AccountType;
  bsb?: string;
  openingBalance?: number; // In cents
  closingBalance?: number; // In cents
  statementPeriod?: {
    start: string; // ISO date
    end: string; // ISO date
  };
}

/**
 * Credit card specific fields extracted from statements
 */
export interface CreditCardFields {
  creditLimit?: number; // In cents
  minimumPayment?: number; // In cents
  interestCharges?: number; // In cents
  closingBalance?: number; // In cents
  paymentDueDate?: string; // ISO date
  cardNumberMasked?: string; // e.g. "****1234"
  statementType: 'credit_card';
}

/**
 * Complete result from parsing a bank statement
 */
export interface StatementParseResult {
  success: boolean;
  bankId: BankId;
  bankName: string;
  accountInfo: AccountInfo;
  transactions: ParsedTransaction[];
  parseWarnings: string[];
  parseErrors: string[];

  // Metadata
  pageCount?: number;
  detectionConfidence: number;
  parserUsed: string;
  processingTimeMs: number;

  // Statement type detection
  statementType?: 'transaction' | 'credit_card' | 'loan' | 'savings';

  // Credit card specific fields (populated when statementType === 'credit_card')
  creditCardFields?: CreditCardFields;
}

/**
 * Interface that all bank parsers must implement
 */
export interface BankParser {
  config: BankParserConfig;

  /**
   * Detect if this parser can handle the given PDF text
   */
  detect(pdfText: string): BankDetectionResult;

  /**
   * Parse transactions from PDF text
   */
  parseTransactions(pdfText: string): Promise<ParsedTransaction[]>;

  /**
   * Extract account information from PDF text
   */
  extractAccountInfo(pdfText: string): Promise<AccountInfo>;

  /**
   * Full parsing with all information
   */
  parse(pdfText: string): Promise<StatementParseResult>;
}

/**
 * Options for the parsing process
 */
export interface ParseOptions {
  // Force a specific bank parser instead of auto-detect
  forceBankId?: BankId;

  // Minimum confidence for auto-detection
  minConfidence?: number;

  // Whether to fall back to AI parsing on low confidence
  fallbackToAI?: boolean;

  // Include raw text in results for debugging
  includeRawText?: boolean;

  // Strict mode - fail on any parsing warnings
  strictMode?: boolean;
}

/**
 * Result of comparing two transactions for transfer detection
 */
export interface TransactionMatchResult {
  isMatch: boolean;
  confidence: number;
  matchReasons: string[];
}

/**
 * Parser registration entry
 */
export interface ParserRegistryEntry {
  bankId: BankId;
  parser: BankParser;
  priority: number; // Higher = checked first
}
