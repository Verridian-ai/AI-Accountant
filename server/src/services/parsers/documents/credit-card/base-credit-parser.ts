/**
 * Base Credit Card Statement Parser
 *
 * Abstract base class for credit card statement parsers.
 * Provides common parsing utilities specific to credit card statements.
 *
 * Credit card statements differ from bank statements in several ways:
 * - Billing cycle dates (not calendar months)
 * - Minimum payment, credit limit, available credit
 * - Interest charges, cash advances
 * - Foreign transaction conversion
 */

import {
  BankId,
  AccountType,
  AccountInfo,
} from '../../types';
import { BaseBankParser, parseDate, parseAmount } from '../../base-parser';

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

/**
 * Parse a foreign currency amount string
 * Returns amount in minor units (e.g., cents)
 */
export function parseForeignAmount(amountStr: string): { amount: number; currency: string } | null {
  if (!amountStr) return null;

  // Common patterns:
  // USD 123.45
  // 123.45 USD
  // $123.45 USD
  // US$123.45
  // EUR 99,50
  // 99.50 EUR

  const currencySymbols: Record<string, string> = {
    '$': 'USD',
    'US$': 'USD',
    'A$': 'AUD',
    'AU$': 'AUD',
    '\u20AC': 'EUR', // Euro symbol
    '\u00A3': 'GBP', // Pound symbol
    '\u00A5': 'JPY', // Yen symbol
    'NZ$': 'NZD',
    'S$': 'SGD',
    'HK$': 'HKD',
    'C$': 'CAD',
  };

  const cleaned = amountStr.trim();

  // Try pattern: CURRENCY_CODE AMOUNT (e.g., "USD 123.45")
  const codeFirstMatch = cleaned.match(/^([A-Z]{3})\s*(-?[\d,]+\.?\d*)$/);
  if (codeFirstMatch) {
    const [, currency, amount] = codeFirstMatch;
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (!isNaN(parsed)) {
      return { amount: Math.round(parsed * 100), currency };
    }
  }

  // Try pattern: AMOUNT CURRENCY_CODE (e.g., "123.45 USD")
  const codeLastMatch = cleaned.match(/^(-?[\d,]+\.?\d*)\s*([A-Z]{3})$/);
  if (codeLastMatch) {
    const [, amount, currency] = codeLastMatch;
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (!isNaN(parsed)) {
      return { amount: Math.round(parsed * 100), currency };
    }
  }

  // Try pattern with symbol: SYMBOL AMOUNT (e.g., "US$123.45")
  for (const [symbol, currency] of Object.entries(currencySymbols)) {
    if (cleaned.startsWith(symbol)) {
      const amount = cleaned.substring(symbol.length).replace(/,/g, '').trim();
      const parsed = parseFloat(amount);
      if (!isNaN(parsed)) {
        return { amount: Math.round(parsed * 100), currency };
      }
    }
  }

  return null;
}

/**
 * Parse a conversion rate from text
 */
export function parseConversionRate(rateStr: string): number | null {
  if (!rateStr) return null;

  // Common patterns:
  // 0.7523
  // 1 AUD = 0.7523 USD
  // Rate: 0.7523
  // @0.7523

  const cleaned = rateStr.trim();

  // Direct number
  const directMatch = cleaned.match(/^@?(\d+\.?\d*)$/);
  if (directMatch) {
    const rate = parseFloat(directMatch[1]);
    if (!isNaN(rate) && rate > 0) {
      return rate;
    }
  }

  // Pattern: X CURRENCY = Y CURRENCY
  const equationMatch = cleaned.match(/\d+\.?\d*\s*[A-Z]{3}\s*=\s*(\d+\.?\d*)\s*[A-Z]{3}/);
  if (equationMatch) {
    const rate = parseFloat(equationMatch[1]);
    if (!isNaN(rate) && rate > 0) {
      return rate;
    }
  }

  // Pattern: Rate: X.XXXX
  const rateMatch = cleaned.match(/rate[:\s]+(\d+\.?\d*)/i);
  if (rateMatch) {
    const rate = parseFloat(rateMatch[1]);
    if (!isNaN(rate) && rate > 0) {
      return rate;
    }
  }

  return null;
}

/**
 * Abstract base class for credit card parsers
 */
export abstract class BaseCreditCardParser implements CreditCardParser {
  abstract config: CreditCardParserConfig;

  /**
   * Detect if this parser can handle the PDF text
   */
  detect(pdfText: string): CreditCardDetectionResult {
    const matchedPatterns: string[] = [];
    let matchCount = 0;

    // Test each header pattern
    for (const pattern of this.config.headerPatterns) {
      if (pattern.test(pdfText)) {
        matchedPatterns.push(pattern.source);
        matchCount++;
      }
    }

    // Calculate base confidence
    const baseConfidence =
      matchCount >= this.config.minHeaderMatches
        ? Math.min(1, matchCount / this.config.headerPatterns.length + 0.3)
        : matchCount / this.config.headerPatterns.length;

    // Check for credit card indicators
    let creditCardMatches = 0;
    for (const pattern of this.config.creditCardIndicators) {
      if (pattern.test(pdfText)) {
        creditCardMatches++;
      }
    }

    const creditCardConfidence =
      this.config.creditCardIndicators.length > 0
        ? creditCardMatches / this.config.creditCardIndicators.length
        : 0;

    const isCreditCardStatement = creditCardConfidence >= 0.5;

    // Detect card type
    let detectedCardType: string | undefined;
    if (/visa/i.test(pdfText)) {
      detectedCardType = 'Visa';
    } else if (/mastercard|master\s*card/i.test(pdfText)) {
      detectedCardType = 'Mastercard';
    } else if (/american\s*express|amex/i.test(pdfText)) {
      detectedCardType = 'American Express';
    } else if (/diners\s*club/i.test(pdfText)) {
      detectedCardType = 'Diners Club';
    }

    return {
      bankId: this.config.bankId,
      bankName: this.config.bankName,
      confidence: baseConfidence,
      matchedPatterns,
      isCreditCardStatement,
      creditCardConfidence,
      detectedCardType,
      suggestedParser: `${this.config.bankId}-credit`,
    };
  }

  /**
   * Parse transactions - must be implemented by subclass
   */
  abstract parseTransactions(pdfText: string): Promise<CreditCardTransaction[]>;

  /**
   * Extract account info - must be implemented by subclass
   */
  abstract extractAccountInfo(pdfText: string): Promise<CreditCardAccountInfo>;

  /**
   * Full parse combining detection, account info, and transactions
   */
  async parse(pdfText: string): Promise<CreditCardStatementParseResult> {
    const startTime = Date.now();
    const detection = this.detect(pdfText);
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const [accountInfo, transactions] = await Promise.all([
        this.extractAccountInfo(pdfText).catch((err) => {
          errors.push(`Account info extraction failed: ${err.message}`);
          return this.getDefaultAccountInfo();
        }),
        this.parseTransactions(pdfText).catch((err) => {
          errors.push(`Transaction parsing failed: ${err.message}`);
          return [];
        }),
      ]);

      // Validation warnings
      if (transactions.length === 0) {
        warnings.push('No transactions found in statement');
      }

      if (!accountInfo.cardNumber) {
        warnings.push('Could not extract card number');
      }

      // Calculate summary totals
      let totalPurchases = 0;
      let totalCashAdvances = 0;
      let totalInterestCharges = 0;
      let totalFees = 0;
      let totalPayments = 0;
      let totalCredits = 0;
      let foreignTransactionCount = 0;
      let foreignTransactionTotal = 0;

      for (const tx of transactions) {
        switch (tx.transactionType) {
          case 'purchase':
            totalPurchases += Math.abs(tx.amount);
            break;
          case 'cash_advance':
            totalCashAdvances += Math.abs(tx.amount);
            break;
          case 'interest':
            totalInterestCharges += Math.abs(tx.amount);
            break;
          case 'fee':
            totalFees += Math.abs(tx.amount);
            break;
          case 'payment':
          case 'refund':
            totalPayments += Math.abs(tx.amount);
            totalCredits += Math.abs(tx.amount);
            break;
        }

        if (tx.foreignAmount) {
          foreignTransactionCount++;
          foreignTransactionTotal += Math.abs(tx.foreignAmount);
        }
      }

      return {
        success: errors.length === 0,
        bankId: this.config.bankId,
        bankName: this.config.bankName,
        accountInfo,
        transactions,
        parseWarnings: warnings,
        parseErrors: errors,
        totalPurchases,
        totalCashAdvances,
        totalInterestCharges,
        totalFees,
        totalPayments,
        totalCredits,
        foreignTransactionCount: foreignTransactionCount > 0 ? foreignTransactionCount : undefined,
        foreignTransactionTotal: foreignTransactionTotal > 0 ? foreignTransactionTotal : undefined,
        detectionConfidence: detection.confidence,
        parserUsed: `${this.config.bankId}-credit`,
        processingTimeMs: Date.now() - startTime,
        isCreditCardStatement: true,
      };
    } catch (err) {
      return {
        success: false,
        bankId: this.config.bankId,
        bankName: this.config.bankName,
        accountInfo: this.getDefaultAccountInfo(),
        transactions: [],
        parseWarnings: warnings,
        parseErrors: [
          `Parse failed: ${err instanceof Error ? err.message : String(err)}`,
        ],
        detectionConfidence: detection.confidence,
        parserUsed: `${this.config.bankId}-credit`,
        processingTimeMs: Date.now() - startTime,
        isCreditCardStatement: true,
      };
    }
  }

  /**
   * Get default account info when extraction fails
   */
  protected getDefaultAccountInfo(): CreditCardAccountInfo {
    return {
      accountNumber: 'UNKNOWN',
      accountType: 'credit',
    };
  }

  /**
   * Determine transaction type from description
   */
  protected detectTransactionType(description: string, amount: number): CreditCardTransactionType {
    const desc = description.toLowerCase();

    // Check configured patterns first
    for (const [type, patterns] of Object.entries(this.config.transactionTypePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(description)) {
          return type as CreditCardTransactionType;
        }
      }
    }

    // Fallback detection based on common keywords
    if (/interest\s*(charge|fee)?/i.test(desc) || /finance\s*charge/i.test(desc)) {
      return 'interest';
    }

    if (/cash\s*advance/i.test(desc) || /atm\s*withdrawal/i.test(desc)) {
      return 'cash_advance';
    }

    if (/\b(fee|charge)\b/i.test(desc) && !/purchase/i.test(desc)) {
      if (/annual|membership|late|over.?limit|foreign/i.test(desc)) {
        return 'fee';
      }
    }

    if (/payment\s*(received|thank|credited)?/i.test(desc) || /^payment\s*-/i.test(desc)) {
      return 'payment';
    }

    if (/refund|credit|reversal|chargeback/i.test(desc)) {
      return 'refund';
    }

    if (/balance\s*transfer/i.test(desc)) {
      return 'balance_transfer';
    }

    if (/reward|points|cashback|bonus/i.test(desc)) {
      return 'reward';
    }

    if (/adjustment|correction/i.test(desc)) {
      return 'adjustment';
    }

    // Payments are typically negative (credits to the account)
    if (amount < 0) {
      return 'payment';
    }

    // Default to purchase for positive amounts
    return 'purchase';
  }

  /**
   * Check if a transaction is a foreign transaction
   */
  protected isForeignTransaction(line: string): boolean {
    for (const pattern of this.config.foreignTransactionPatterns) {
      if (pattern.test(line)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract text between two patterns
   */
  protected extractBetween(
    text: string,
    startPattern: RegExp,
    endPattern: RegExp
  ): string | null {
    const startMatch = text.match(startPattern);
    if (!startMatch) return null;

    const startIdx = startMatch.index! + startMatch[0].length;
    const remaining = text.substring(startIdx);

    const endMatch = remaining.match(endPattern);
    if (!endMatch) return remaining;

    return remaining.substring(0, endMatch.index);
  }

  /**
   * Split PDF text into lines, handling various line endings
   */
  protected splitLines(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /**
   * Clean description text
   */
  protected cleanDescription(desc: string): string {
    return desc
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-*]+/, '')
      .trim();
  }

  /**
   * Check if a line looks like a credit card transaction
   */
  protected isTransactionLine(line: string): boolean {
    // Must contain a date-like pattern and an amount-like pattern
    const hasDate = /\d{1,2}[\/\-\s]\w{2,3}[\/\-\s]?\d{2,4}/.test(line);
    const hasAmount = /\$?\d+[,.]?\d*\.?\d{2}/.test(line);
    return hasDate && hasAmount;
  }

  /**
   * Parse date using configured formats
   */
  protected parseDate(dateStr: string): string | null {
    return parseDate(dateStr, this.config.dateFormats);
  }

  /**
   * Parse amount to cents
   */
  protected parseAmount(amountStr: string): number | null {
    return parseAmount(amountStr);
  }
}

// Re-export utility functions
export { parseDate, parseAmount };
