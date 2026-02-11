/**
 * Base Bank Parser
 *
 * Abstract base class for all bank-specific parsers.
 * Provides common parsing utilities and structure.
 */

import {
  BankParser,
  BankParserConfig,
  BankDetectionResult,
  ParsedTransaction,
  AccountInfo,
  StatementParseResult,
  AccountType,
} from './types';

/**
 * Parse a date string using multiple formats
 */
export function parseDate(dateStr: string, formats: string[]): string | null {
  const cleanDate = dateStr.trim();

  for (const format of formats) {
    const parsed = parseDateWithFormat(cleanDate, format);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

/**
 * Parse date with a specific format
 */
function parseDateWithFormat(dateStr: string, format: string): string | null {
  const monthNames: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };

  try {
    if (format === 'DD/MM/YYYY') {
      const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const [, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    if (format === 'DD/MM/YY') {
      const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/);
      if (match) {
        const [, day, month, yearShort] = match;
        const year = parseInt(yearShort) > 50 ? `19${yearShort}` : `20${yearShort}`;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    if (format === 'DD MMM YYYY') {
      const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/i);
      if (match) {
        const [, day, monthStr, year] = match;
        const month = monthNames[monthStr.toLowerCase()];
        if (month) {
          return `${year}-${month}-${day.padStart(2, '0')}`;
        }
      }
    }

    if (format === 'DD MMM YY') {
      const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{2})/i);
      if (match) {
        const [, day, monthStr, yearShort] = match;
        const month = monthNames[monthStr.toLowerCase()];
        if (month) {
          const year = parseInt(yearShort) > 50 ? `19${yearShort}` : `20${yearShort}`;
          return `${year}-${month}-${day.padStart(2, '0')}`;
        }
      }
    }

    if (format === 'YYYY-MM-DD') {
      const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return dateStr;
      }
    }

    if (format === 'DD-MM-YYYY') {
      const match = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
      if (match) {
        const [, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Parse an amount string to cents
 */
export function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;

  // Remove currency symbols, commas, spaces
  let cleaned = amountStr.replace(/[$,\s]/g, '').trim();

  // Handle CR/DR suffixes
  let multiplier = 1;
  if (/CR$/i.test(cleaned)) {
    cleaned = cleaned.replace(/CR$/i, '');
    multiplier = 1; // Credit is positive
  } else if (/DR$/i.test(cleaned)) {
    cleaned = cleaned.replace(/DR$/i, '');
    multiplier = -1; // Debit is negative
  }

  // Handle parentheses for negative
  if (/^\(.*\)$/.test(cleaned)) {
    cleaned = cleaned.replace(/[()]/g, '');
    multiplier = -1;
  }

  // Handle leading minus
  if (cleaned.startsWith('-')) {
    cleaned = cleaned.substring(1);
    multiplier = -1;
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  // Convert to cents
  return Math.round(parsed * 100) * multiplier;
}

/**
 * Abstract base class for bank parsers
 */
export abstract class BaseBankParser implements BankParser {
  abstract config: BankParserConfig;

  /**
   * Detect if this parser can handle the PDF text
   */
  detect(pdfText: string): BankDetectionResult {
    const matchedPatterns: string[] = [];
    let matchCount = 0;

    // Test each header pattern
    for (const pattern of this.config.headerPatterns) {
      if (pattern.test(pdfText)) {
        matchedPatterns.push(pattern.source);
        matchCount++;
      }
    }

    // Calculate confidence based on matches
    const confidence =
      matchCount >= this.config.minHeaderMatches
        ? Math.min(1, matchCount / this.config.headerPatterns.length + 0.3)
        : matchCount / this.config.headerPatterns.length;

    // Try to detect account type
    let detectedAccountType: AccountType | undefined;
    for (const [keyword, type] of Object.entries(this.config.accountTypes)) {
      if (new RegExp(keyword, 'i').test(pdfText)) {
        detectedAccountType = type;
        break;
      }
    }

    return {
      bankId: this.config.bankId,
      bankName: this.config.bankName,
      confidence,
      matchedPatterns,
      detectedAccountType,
      suggestedParser: this.config.bankId,
    };
  }

  /**
   * Parse transactions - must be implemented by subclass
   */
  abstract parseTransactions(pdfText: string): Promise<ParsedTransaction[]>;

  /**
   * Extract account info - must be implemented by subclass
   */
  abstract extractAccountInfo(pdfText: string): Promise<AccountInfo>;

  /**
   * Full parse combining detection, account info, and transactions
   */
  async parse(pdfText: string): Promise<StatementParseResult> {
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

      if (!accountInfo.accountNumber) {
        warnings.push('Could not extract account number');
      }

      // Check for duplicate dates
      const dateCount = new Map<string, number>();
      for (const tx of transactions) {
        dateCount.set(tx.date, (dateCount.get(tx.date) || 0) + 1);
      }

      return {
        success: errors.length === 0,
        bankId: this.config.bankId,
        bankName: this.config.bankName,
        accountInfo,
        transactions,
        parseWarnings: warnings,
        parseErrors: errors,
        detectionConfidence: detection.confidence,
        parserUsed: this.config.bankId,
        processingTimeMs: Date.now() - startTime,
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
        parserUsed: this.config.bankId,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get default account info when extraction fails
   */
  protected getDefaultAccountInfo(): AccountInfo {
    return {
      accountNumber: 'UNKNOWN',
      accountType: 'unknown',
    };
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
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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
   * Check if a line looks like a transaction
   */
  protected isTransactionLine(line: string): boolean {
    // Must contain a date-like pattern and an amount-like pattern
    const hasDate = /\d{1,2}[\/\-\s]\w{2,3}[\/\-\s]?\d{2,4}/.test(line);
    const hasAmount = /\$?\d+[,.]?\d*\.?\d{2}/.test(line);
    return hasDate && hasAmount;
  }
}
