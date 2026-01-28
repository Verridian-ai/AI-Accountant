/**
 * CSV Statement Parser
 *
 * Parses bank statement CSV exports from multiple Australian banks.
 * Supports various date formats, column layouts, and encoding.
 */

import { parse as csvParse } from 'csv-parse/sync';
import { ParsedTransaction } from '../types.js';

// ============================================================================
// BANK CSV CONFIGURATIONS
// ============================================================================

interface BankCSVConfig {
  bankId: string;
  bankName: string;
  /** Column mappings (0-indexed) or header names */
  columns: {
    date: string | number;
    description: string | number;
    debit?: string | number;
    credit?: string | number;
    amount?: string | number; // Combined debit/credit
    balance?: string | number;
  };
  /** Date formats to try (in order of preference) */
  dateFormats: string[];
  /** Whether the file has a header row */
  hasHeader: boolean;
  /** Number of rows to skip before data */
  skipRows: number;
  /** Delimiter character */
  delimiter: string;
  /** String patterns to identify this bank's CSV */
  identifyPatterns: string[];
  /** Positive amount indicates credit (true) or debit (false) */
  positiveIsCredit: boolean;
  /** Multiply amounts by this factor (e.g., 100 for cents) */
  amountMultiplier: number;
}

export const BANK_CSV_CONFIGS: Record<string, BankCSVConfig> = {
  cba: {
    bankId: 'cba',
    bankName: 'Commonwealth Bank',
    columns: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY', 'D/M/YYYY', 'YYYY-MM-DD'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['commonwealth', 'netbank', 'cba'],
    positiveIsCredit: false, // CBA uses negative for debits
    amountMultiplier: 100,
  },
  anz: {
    bankId: 'anz',
    bankName: 'ANZ',
    columns: {
      date: 0,
      description: 1,
      amount: 2,
      balance: 3,
    },
    dateFormats: ['DD/MM/YYYY', 'D/M/YYYY'],
    hasHeader: false,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['anz'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  westpac: {
    bankId: 'westpac',
    bankName: 'Westpac',
    columns: {
      date: 'Date',
      description: 'Narrative',
      debit: 'Debit Amount',
      credit: 'Credit Amount',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY', 'D/M/YYYY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['westpac', 'narrative'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  nab: {
    bankId: 'nab',
    bankName: 'NAB',
    columns: {
      date: 'Date',
      description: 'Transaction Details',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormats: ['DD-MMM-YY', 'DD/MM/YYYY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['nab', 'national australia'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  stgeorge: {
    bankId: 'stgeorge',
    bankName: 'St.George',
    columns: {
      date: 'Date',
      description: 'Description',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['st george', 'stgeorge'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  bendigo: {
    bankId: 'bendigo',
    bankName: 'Bendigo Bank',
    columns: {
      date: 'Date',
      description: 'Description',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY', 'DD/MM/YY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['bendigo'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  ing: {
    bankId: 'ing',
    bankName: 'ING',
    columns: {
      date: 'Date',
      description: 'Description',
      credit: 'Credit',
      debit: 'Debit',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['ing'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  macquarie: {
    bankId: 'macquarie',
    bankName: 'Macquarie',
    columns: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY', 'YYYY-MM-DD'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['macquarie'],
    positiveIsCredit: false,
    amountMultiplier: 100,
  },
};

// ============================================================================
// CSV PARSER CLASS
// ============================================================================

export interface CSVParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  bankId: string | null;
  bankName: string | null;
  accountNumber?: string;
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

// Maximum file size for CSV parsing (10MB)
const MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024;
// Maximum content length for bank detection (first 10KB)
const MAX_DETECTION_LENGTH = 10 * 1024;

export class CSVStatementParser {
  private configs: Record<string, BankCSVConfig>;

  constructor(customConfigs?: Record<string, BankCSVConfig>) {
    this.configs = { ...BANK_CSV_CONFIGS, ...customConfigs };
  }

  /**
   * Parse a CSV file content
   */
  async parse(
    content: string,
    bankId?: string,
    options?: { encoding?: string }
  ): Promise<CSVParseResult> {
    const result: CSVParseResult = {
      success: false,
      transactions: [],
      bankId: null,
      bankName: null,
      errors: [],
      warnings: [],
      metadata: {
        rowCount: 0,
        parsedCount: 0,
        skippedCount: 0,
      },
    };

    try {
      // Input validation: Check file size to prevent memory exhaustion
      const contentSizeBytes = Buffer.byteLength(content, 'utf8');
      if (contentSizeBytes > MAX_CSV_SIZE_BYTES) {
        result.errors.push(`File size (${Math.round(contentSizeBytes / 1024 / 1024)}MB) exceeds maximum allowed size (${MAX_CSV_SIZE_BYTES / 1024 / 1024}MB)`);
        return result;
      }

      // Detect or use provided bank config
      const config = bankId
        ? this.configs[bankId]
        : this.detectBankConfig(content);

      if (!config) {
        result.errors.push('Unable to detect bank format. Please specify the bank.');
        return result;
      }

      result.bankId = config.bankId;
      result.bankName = config.bankName;

      // Parse CSV
      const records = this.parseCSVContent(content, config);
      result.metadata.rowCount = records.length;

      // Convert to transactions
      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        try {
          const transaction = this.recordToTransaction(record, config, i);
          if (transaction) {
            result.transactions.push(transaction);
            result.metadata.parsedCount++;
          } else {
            result.metadata.skippedCount++;
          }
        } catch (error) {
          result.warnings.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
          result.metadata.skippedCount++;
        }
      }

      // Calculate date range
      if (result.transactions.length > 0) {
        const dates = result.transactions
          .map(t => t.date)
          .filter(d => d)
          .sort();

        result.metadata.dateRange = {
          start: dates[0],
          end: dates[dates.length - 1],
        };
      }

      result.success = result.transactions.length > 0;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Detect which bank format the CSV matches
   * Limits content searched to prevent ReDoS attacks
   */
  detectBankConfig(content: string): BankCSVConfig | null {
    // Limit content searched to prevent ReDoS on large files
    const detectionContent = content.slice(0, MAX_DETECTION_LENGTH);
    const lowerContent = detectionContent.toLowerCase();
    const firstLines = detectionContent.split('\n').slice(0, 5).join('\n').toLowerCase();

    for (const [, config] of Object.entries(this.configs)) {
      const matches = config.identifyPatterns.some(pattern =>
        lowerContent.includes(pattern.toLowerCase()) ||
        firstLines.includes(pattern.toLowerCase())
      );

      if (matches) {
        return config;
      }
    }

    // Try to match by column headers
    return this.detectByHeaders(detectionContent);
  }

  /**
   * Detect bank by analyzing column headers
   */
  private detectByHeaders(content: string): BankCSVConfig | null {
    const firstLine = content.split('\n')[0].toLowerCase();

    for (const [, config] of Object.entries(this.configs)) {
      if (!config.hasHeader) continue;

      const expectedHeaders = Object.values(config.columns)
        .filter(col => typeof col === 'string')
        .map(col => (col as string).toLowerCase());

      const matchCount = expectedHeaders.filter(header =>
        firstLine.includes(header)
      ).length;

      // Require at least half of expected headers to match
      if (matchCount >= expectedHeaders.length / 2) {
        return config;
      }
    }

    return null;
  }

  /**
   * Parse CSV content into records
   */
  private parseCSVContent(
    content: string,
    config: BankCSVConfig
  ): Record<string, string>[] {
    const options: Parameters<typeof csvParse>[1] = {
      delimiter: config.delimiter,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    };

    if (config.hasHeader) {
      options.columns = true;
      options.from_line = config.skipRows + 1;
    } else {
      options.from_line = config.skipRows + 1;
    }

    return csvParse(content, options);
  }

  /**
   * Convert a CSV record to a transaction
   */
  private recordToTransaction(
    record: Record<string, string> | string[],
    config: BankCSVConfig,
    rowIndex: number
  ): ParsedTransaction | null {
    // Get field values
    const getValue = (field: string | number): string => {
      if (typeof field === 'number') {
        return (record as string[])[field] || '';
      }
      return (record as Record<string, string>)[field] || '';
    };

    const dateStr = getValue(config.columns.date);
    const description = getValue(config.columns.description);

    if (!dateStr || !description) {
      return null;
    }

    // Parse amount
    let amountCents: number;

    if (config.columns.amount !== undefined) {
      // Single amount column
      const amountStr = getValue(config.columns.amount);
      amountCents = this.parseAmount(amountStr, config);

      // Handle sign based on bank convention
      if (!config.positiveIsCredit) {
        // Positive = debit (expense), negative = credit (income)
        // We want positive = credit, so flip the sign
        amountCents = -amountCents;
      }
    } else {
      // Separate debit/credit columns
      const debitStr = config.columns.debit !== undefined
        ? getValue(config.columns.debit)
        : '';
      const creditStr = config.columns.credit !== undefined
        ? getValue(config.columns.credit)
        : '';

      const debit = this.parseAmount(debitStr, config);
      const credit = this.parseAmount(creditStr, config);

      // Credits are positive, debits are negative
      amountCents = credit - debit;
    }

    // Parse balance
    let balanceCents: number | undefined;
    if (config.columns.balance !== undefined) {
      const balanceStr = getValue(config.columns.balance);
      if (balanceStr) {
        balanceCents = this.parseAmount(balanceStr, config);
      }
    }

    // Parse date
    const parsedDate = this.parseDate(dateStr, config.dateFormats);
    if (!parsedDate) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }

    return {
      date: parsedDate,
      description: this.cleanDescription(description),
      amount: amountCents, // Amount in cents as per ParsedTransaction interface
      balance: balanceCents, // Balance in cents as per ParsedTransaction interface
      lineNumber: rowIndex,
    };
  }

  /**
   * Parse amount string to cents
   */
  private parseAmount(amountStr: string, config: BankCSVConfig): number {
    if (!amountStr || amountStr.trim() === '') {
      return 0;
    }

    // Remove currency symbols and thousands separators
    let cleaned = amountStr
      .replace(/[$ ]/g, '')
      .replace(/,/g, '')
      .trim();

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

    // Parse as float and convert to cents
    const value = parseFloat(cleaned);
    if (isNaN(value)) {
      return 0;
    }

    let cents = Math.round(value * config.amountMultiplier);

    if (isNegative || hasNegativeSign) {
      cents = -cents;
    }

    return cents;
  }

  /**
   * Parse date string using multiple formats
   */
  private parseDate(dateStr: string, formats: string[]): string | null {
    const cleaned = dateStr.trim();

    for (const format of formats) {
      const parsed = this.parseDateWithFormat(cleaned, format);
      if (parsed) {
        return parsed;
      }
    }

    // Try native Date parsing as fallback
    const nativeDate = new Date(cleaned);
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate.toISOString().split('T')[0];
    }

    return null;
  }

  /**
   * Parse date with a specific format
   */
  private parseDateWithFormat(dateStr: string, format: string): string | null {
    // Simple format parser for common Australian date formats
    const formatParts = format.split(/[\/\-]/);
    const dateParts = dateStr.split(/[\/\-]/);

    if (formatParts.length !== dateParts.length) {
      return null;
    }

    let day: number | null = null;
    let month: number | null = null;
    let year: number | null = null;

    for (let i = 0; i < formatParts.length; i++) {
      const formatPart = formatParts[i].toUpperCase();
      const datePart = dateParts[i];

      if (formatPart.includes('D')) {
        day = parseInt(datePart, 10);
      } else if (formatPart === 'MMM') {
        // Month abbreviation
        month = this.parseMonthAbbreviation(datePart);
      } else if (formatPart.includes('M')) {
        month = parseInt(datePart, 10);
      } else if (formatPart.includes('Y')) {
        year = parseInt(datePart, 10);
        // Handle 2-digit years
        if (year < 100) {
          year += year > 50 ? 1900 : 2000;
        }
      }
    }

    if (day === null || month === null || year === null) {
      return null;
    }

    // Validate date
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    // Return ISO format
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Parse month abbreviation (Jan, Feb, etc.)
   */
  private parseMonthAbbreviation(abbrev: string): number | null {
    const months: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };
    return months[abbrev.toLowerCase().slice(0, 3)] || null;
  }

  /**
   * Clean up transaction description
   */
  private cleanDescription(description: string): string {
    return description
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/^\d{2}\/\d{2}\s*/, '')  // Remove leading date
      .replace(/Card xx\d{4}/i, '')  // Remove card numbers
      .replace(/Value Date:.*$/i, '')  // Remove value date suffix
      .trim();
  }

  /**
   * Get list of supported banks
   */
  getSupportedBanks(): Array<{ id: string; name: string }> {
    return Object.entries(this.configs).map(([id, config]) => ({
      id,
      name: config.bankName,
    }));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const csvParser = new CSVStatementParser();
