/**
 * QIF Statement Parser
 *
 * Parses QIF (Quicken Interchange Format) bank statement files.
 * QIF is a plain-text format for exchanging financial data.
 *
 * QIF format reference: https://en.wikipedia.org/wiki/Quicken_Interchange_Format
 */

import { ParsedTransaction, AccountType } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// DATE FORMAT CONFIGURATIONS
// ============================================================================

interface DateFormatConfig {
  pattern: RegExp;
  parse: (match: RegExpMatchArray) => { day: number; month: number; year: number } | null;
}

/**
 * Supported date formats in QIF files
 * QIF spec allows for various formats depending on locale and software
 *
 * NOTE: US (MM/DD) and AU (DD/MM) formats use the same regex pattern.
 * The parser determines which to use based on:
 * 1. Explicit preference set via setDateFormatPreference()
 * 2. Heuristic analysis of sample transactions (values > 12 indicate day position)
 *
 * The DATE_FORMATS_US and DATE_FORMATS_AU arrays are used based on detected preference.
 */
const DATE_FORMATS_US: DateFormatConfig[] = [
  // MM/DD/YY or M/D/YY (US format - most common in QIF)
  {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    parse: (match) => ({
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10),
      year: expandYear(parseInt(match[3], 10)),
    }),
  },
  // MM/DD/YYYY or M/D/YYYY
  {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (match) => ({
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10),
      year: parseInt(match[3], 10),
    }),
  },
];

const DATE_FORMATS_AU: DateFormatConfig[] = [
  // DD/MM/YY or D/M/YY (Australian/European format)
  {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    parse: (match) => ({
      day: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      year: expandYear(parseInt(match[3], 10)),
    }),
  },
  // DD/MM/YYYY or D/M/YYYY
  {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (match) => ({
      day: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      year: parseInt(match[3], 10),
    }),
  },
];

// Common formats that work for both US and AU
const DATE_FORMATS_COMMON: DateFormatConfig[] = [
  // YYYY-MM-DD (ISO format) - unambiguous
  {
    pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    parse: (match) => ({
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      day: parseInt(match[3], 10),
    }),
  },
  // DD MMM YY or DD MMM YYYY (e.g., "15 Jan 23" or "15 Jan 2023") - unambiguous due to month name
  {
    pattern: /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})$/,
    parse: (match) => {
      const month = parseMonthName(match[2]);
      if (month === null) return null;
      return {
        day: parseInt(match[1], 10),
        month,
        year: match[3].length === 2 ? expandYear(parseInt(match[3], 10)) : parseInt(match[3], 10),
      };
    },
  },
  // MMM DD, YYYY (e.g., "Jan 15, 2023") - unambiguous due to month name
  {
    pattern: /^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/,
    parse: (match) => {
      const month = parseMonthName(match[1]);
      if (month === null) return null;
      return {
        month,
        day: parseInt(match[2], 10),
        year: parseInt(match[3], 10),
      };
    },
  },
  // Quicken special format: M/D'YY (apostrophe before year) - US format
  {
    pattern: /^(\d{1,2})\/(\d{1,2})'(\d{2})$/,
    parse: (match) => ({
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10),
      year: expandYear(parseInt(match[3], 10)),
    }),
  },
  // Another Quicken variant: M/D' Y (space before single digit year) - US format
  {
    pattern: /^(\d{1,2})\/(\d{1,2})'\s*(\d{1,2})$/,
    parse: (match) => ({
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10),
      year: expandYear(parseInt(match[3], 10)),
    }),
  },
];

/**
 * Get date formats array based on locale preference
 * US formats are tried first for 'US' preference, AU formats first for 'AU'
 */
function getDateFormatsForLocale(locale: 'US' | 'AU'): DateFormatConfig[] {
  if (locale === 'US') {
    return [...DATE_FORMATS_US, ...DATE_FORMATS_COMMON];
  } else {
    return [...DATE_FORMATS_AU, ...DATE_FORMATS_COMMON];
  }
}

// Keep DATE_FORMATS for backward compatibility - defaults to AU for Australian banks
const DATE_FORMATS = getDateFormatsForLocale('AU');

/**
 * Expand 2-digit year to 4-digit year
 * Uses 50 as the cutoff: 00-49 = 2000-2049, 50-99 = 1950-1999
 */
function expandYear(shortYear: number): number {
  if (shortYear >= 100) return shortYear;
  return shortYear > 50 ? 1900 + shortYear : 2000 + shortYear;
}

/**
 * Parse month name to number (1-12)
 */
function parseMonthName(name: string): number | null {
  const months: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };
  return months[name.toLowerCase()] || null;
}

// ============================================================================
// QIF PARSER CLASS
// ============================================================================

export class QIFStatementParser {
  private dateFormatPreference: 'US' | 'AU' | 'auto' = 'auto';

  /**
   * Set date format preference
   * US: MM/DD/YY, AU/EU: DD/MM/YY
   */
  setDateFormatPreference(preference: 'US' | 'AU' | 'auto'): void {
    this.dateFormatPreference = preference;
  }

  /**
   * Parse QIF file content
   */
  async parse(content: string): Promise<QIFParseResult> {
    const result: QIFParseResult = {
      success: false,
      transactions: [],
      accountType: 'unknown',
      accountName: null,
      qifType: null,
      errors: [],
      warnings: [],
      metadata: {
        rowCount: 0,
        parsedCount: 0,
        skippedCount: 0,
      },
    };

    try {
      // Normalize content
      const normalizedContent = this.normalizeContent(content);

      // Check if valid QIF
      if (!this.isValidQIF(normalizedContent)) {
        result.errors.push('Invalid QIF file format');
        return result;
      }

      // Extract account type from header
      const typeMatch = normalizedContent.match(/^!Type:(\S+)/im);
      if (typeMatch) {
        result.qifType = this.normalizeQIFType(typeMatch[1]);
        result.accountType = this.mapQIFTypeToAccountType(result.qifType);
      }

      // Extract account header if present
      const accountInfo = this.extractAccountInfo(normalizedContent);
      if (accountInfo) {
        result.accountName = accountInfo.name || null;
        if (accountInfo.type) {
          result.qifType = accountInfo.type;
          result.accountType = this.mapQIFTypeToAccountType(accountInfo.type);
        }
      }

      // Parse transactions
      const rawTransactions = this.extractTransactions(normalizedContent);
      result.metadata.rowCount = rawTransactions.length;

      // Detect date format from sample of transactions
      const dateFormat = this.detectDateFormat(rawTransactions);

      for (let i = 0; i < rawTransactions.length; i++) {
        const rawTx = rawTransactions[i];

        try {
          const transaction = this.convertTransaction(rawTx, i, dateFormat);
          if (transaction) {
            result.transactions.push(transaction);
            result.metadata.parsedCount++;
          } else {
            result.metadata.skippedCount++;
            result.warnings.push(`Transaction ${i + 1}: Skipped - missing required fields`);
          }
        } catch (error) {
          result.warnings.push(
            `Transaction ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`
          );
          result.metadata.skippedCount++;
        }
      }

      // Calculate date range
      if (result.transactions.length > 0) {
        const dates = result.transactions
          .map((t) => t.date)
          .filter((d) => d)
          .sort();

        result.metadata.dateRange = {
          start: dates[0],
          end: dates[dates.length - 1],
        };
      }

      result.success = result.transactions.length > 0 || result.errors.length === 0;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Check if content is a valid QIF file
   */
  isValidQIF(content: string): boolean {
    // QIF files start with !Type: or !Account or !Option
    const hasTypeHeader = /^!Type:/im.test(content);
    const hasAccountHeader = /^!Account/im.test(content);
    const hasOptionHeader = /^!Option:/im.test(content);

    // Also check for transaction markers
    const hasTransactionMarkers = /^\^/m.test(content);

    return hasTypeHeader || hasAccountHeader || (hasOptionHeader && hasTransactionMarkers);
  }

  /**
   * Normalize QIF content
   */
  private normalizeContent(content: string): string {
    // Remove UTF-8 BOM
    let normalized = content.replace(/^\uFEFF/, '');

    // Normalize line endings
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return normalized;
  }

  /**
   * Normalize QIF type string
   */
  private normalizeQIFType(typeStr: string): QIFType {
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
  private mapQIFTypeToAccountType(qifType: QIFType): AccountType {
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
  private extractAccountInfo(content: string): QIFAccountInfo | null {
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
          info.type = this.normalizeQIFType(value);
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
   * Extract all transactions from QIF content
   */
  private extractTransactions(content: string): QIFTransaction[] {
    const transactions: QIFTransaction[] = [];

    // Find all transaction blocks (between !Type: and ^)
    // Split by ^ which marks end of each transaction
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

      const transaction = this.parseTransactionBlock(trimmedBlock);
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  /**
   * Parse a single transaction block
   */
  private parseTransactionBlock(block: string): QIFTransaction | null {
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
        case 'U': // U is amount in QIF, sometimes used instead of T
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
   * Detect the date format used in the QIF file
   */
  private detectDateFormat(transactions: QIFTransaction[]): 'US' | 'AU' {
    if (this.dateFormatPreference !== 'auto') {
      return this.dateFormatPreference;
    }

    // Sample up to 10 transactions
    const sample = transactions.slice(0, 10);

    let usScore = 0;
    let auScore = 0;

    for (const tx of sample) {
      const parts = tx.date.split(/[\/\-\.]/);
      if (parts.length >= 2) {
        const first = parseInt(parts[0], 10);
        const second = parseInt(parts[1], 10);

        // If first part > 12, it must be a day (AU format)
        if (first > 12) {
          auScore += 2;
        }
        // If second part > 12, it must be a day (US format)
        else if (second > 12) {
          usScore += 2;
        }
        // If both are <= 12, check for common patterns
        else if (first > second) {
          // Higher number first suggests day-first (AU)
          auScore += 1;
        } else if (second > first) {
          // Higher number second suggests month-first (US)
          usScore += 1;
        }
      }
    }

    // Default to AU format for Australian banks
    return usScore > auScore ? 'US' : 'AU';
  }

  /**
   * Convert QIF transaction to standard format
   */
  private convertTransaction(
    tx: QIFTransaction,
    index: number,
    dateFormat: 'US' | 'AU'
  ): ParsedTransaction | null {
    // Parse date
    const date = this.parseQIFDate(tx.date, dateFormat);
    if (!date) {
      throw new Error(`Invalid date format: ${tx.date}`);
    }

    // Parse amount
    const amountCents = this.parseAmount(tx.amount);

    // Build description from payee and memo
    let description = tx.payee || '';
    if (tx.memo && tx.memo !== tx.payee) {
      description = description ? `${description} - ${tx.memo}` : tx.memo;
    }
    if (!description) {
      description = 'Transaction';
    }

    // Build reference from check number
    let reference: string | undefined;
    if (tx.number) {
      reference = tx.number.match(/^\d+$/) ? `Check #${tx.number}` : tx.number;
    }

    return {
      date,
      description: this.cleanDescription(description),
      amount: amountCents,
      reference,
      category: tx.category,
      rawDate: tx.date,
      rawAmount: tx.amount,
      rawDescription: `${tx.payee || ''} ${tx.memo || ''}`.trim(),
      lineNumber: index + 1,
    };
  }

  /**
   * Parse QIF date string to ISO format
   */
  private parseQIFDate(dateStr: string, preferredFormat: 'US' | 'AU'): string | null {
    if (!dateStr) return null;

    const cleanDate = dateStr.trim();

    // Get appropriate format list based on locale preference
    const formats = getDateFormatsForLocale(preferredFormat);

    for (const format of formats) {
      const match = cleanDate.match(format.pattern);
      if (match) {
        const parsed = format.parse(match);
        if (parsed && this.isValidDate(parsed.year, parsed.month, parsed.day)) {
          return this.formatISODate(parsed.year, parsed.month, parsed.day);
        }
      }
    }

    return null;
  }

  /**
   * Validate date components
   */
  private isValidDate(year: number, month: number, day: number): boolean {
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > 2100) return false;

    // Check days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
  }

  /**
   * Format date components to ISO string
   */
  private formatISODate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Parse amount string to cents
   */
  private parseAmount(amountStr: string): number {
    if (!amountStr || amountStr.trim() === '') {
      return 0;
    }

    // Remove currency symbols, commas, spaces
    let cleaned = amountStr.replace(/[$,\s]/g, '').trim();

    // Handle parentheses for negative (accounting format)
    const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
    if (isNegative) {
      cleaned = cleaned.slice(1, -1);
    }

    // Handle explicit negative sign
    const hasNegativeSign = cleaned.startsWith('-');
    if (hasNegativeSign) {
      cleaned = cleaned.slice(1);
    }

    const value = parseFloat(cleaned);
    if (isNaN(value)) {
      return 0;
    }

    // Convert to cents
    let cents = Math.round(value * 100);

    if (isNegative || hasNegativeSign) {
      cents = -cents;
    }

    return cents;
  }

  /**
   * Clean up transaction description
   */
  private cleanDescription(description: string): string {
    return description
      .replace(/\s+/g, ' ')
      .replace(/^\s*-\s*/, '')
      .trim();
  }

  /**
   * Get file extensions supported by this parser
   */
  static getSupportedExtensions(): string[] {
    return ['.qif'];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const qifParser = new QIFStatementParser();
