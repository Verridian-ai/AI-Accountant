/**
 * Westpac Bank Statement Parser
 *
 * Handles Westpac transaction account, savings, and credit card statements.
 */

import {
  BankParserConfig,
  ParsedTransaction,
  AccountInfo,
  AccountType,
} from '../types';
import { BaseBankParser, parseDate, parseAmount } from '../base-parser';

/**
 * Westpac Parser Configuration
 */
const WESTPAC_CONFIG: BankParserConfig = {
  bankId: 'westpac',
  bankName: 'Westpac',
  displayName: 'Westpac Banking Corporation',

  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'DD MMM YYYY'],

  headerPatterns: [
    /Westpac/i,
    /Westpac\s+Banking/i,
    /BSB:\s*03\d{4}/i, // Westpac BSBs start with 03
    /westpac\.com/i,
    /Westpac\s+Statement/i,
  ],

  minHeaderMatches: 2,

  accountPatterns: [
    /Account\s*(?:Number|No\.?)[\s:]*(\d{6}\s*\d{6})/i,
    /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*Account[\s:]*(\d+)/i,
  ],

  transactionPatterns: {
    datePattern: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    amountPattern: /\$?([\d,]+\.\d{2})/,
    transactionLinePattern:
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})/,
    debitIndicators: ['-', 'DR'],
    creditIndicators: ['+', 'CR'],
    separateDebitCreditColumns: true,
  },

  accountTypes: {
    'Choice': 'transaction',
    'Everyday': 'transaction',
    'Life': 'savings',
    'eSaver': 'savings',
    'Bump': 'savings',
    'Altitude': 'credit',
    'Low Rate': 'credit',
    'Mastercard': 'credit',
    'Business One': 'business',
    'Offset': 'offset',
  },

  periodPatterns: [
    /Statement\s+Period[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ],

  openingBalancePattern:
    /(?:Opening|Beginning)\s*Balance[\s:]*\$?([\d,]+\.\d{2})/i,
  closingBalancePattern:
    /(?:Closing|Ending)\s*Balance[\s:]*\$?([\d,]+\.\d{2})/i,
};

/**
 * Westpac Bank Parser Implementation
 */
export class WestpacParser extends BaseBankParser {
  config = WESTPAC_CONFIG;

  /**
   * Parse transactions from Westpac statement
   */
  async parseTransactions(pdfText: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    const lines = this.splitLines(pdfText);

    let inTransactionSection = false;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      // Detect transaction section
      if (/^\s*Date\s+(?:Transaction|Particulars)/i.test(line)) {
        inTransactionSection = true;
        continue;
      }

      if (
        inTransactionSection &&
        /^\s*(?:Closing|Total)\s+/i.test(line)
      ) {
        inTransactionSection = false;
        continue;
      }

      if (!inTransactionSection && !this.isTransactionLine(line)) {
        continue;
      }

      const tx = this.parseTransactionLine(line, lineNumber);
      if (tx) {
        transactions.push(tx);
      }
    }

    return transactions;
  }

  /**
   * Parse a single transaction line
   */
  private parseTransactionLine(
    line: string,
    lineNumber: number
  ): ParsedTransaction | null {
    // Westpac may have separate debit/credit columns
    // Format: DD/MM/YYYY Description Debit Credit Balance
    const match = line.match(
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})?\s*(-?\$?[\d,]+\.\d{2})?\s*(-?\$?[\d,]+\.\d{2})?$/
    );

    if (!match) {
      return null;
    }

    const [, rawDate, rawDesc, val1, val2, val3] = match;

    const date = parseDate(rawDate, this.config.dateFormats);
    if (!date) return null;

    let amount: number | null = null;
    let balance: number | undefined;

    // Parse based on number of values present
    const values = [val1, val2, val3].filter(Boolean);

    if (values.length === 3) {
      // Debit, Credit, Balance
      const debit = parseAmount(values[0]);
      const credit = parseAmount(values[1]);
      balance = parseAmount(values[2]) ?? undefined;
      amount = debit && debit !== 0 ? -Math.abs(debit) : credit ?? 0;
    } else if (values.length === 2) {
      // Amount, Balance
      amount = parseAmount(values[0]);
      balance = parseAmount(values[1]) ?? undefined;
    } else if (values.length === 1) {
      amount = parseAmount(values[0]);
    }

    if (amount === null) return null;

    return {
      date,
      description: this.cleanDescription(rawDesc),
      amount,
      balance,
      rawDate,
      rawAmount: val1,
      rawDescription: rawDesc,
      lineNumber,
    };
  }

  /**
   * Extract account information
   */
  async extractAccountInfo(pdfText: string): Promise<AccountInfo> {
    let accountNumber = '';
    let bsb = '';
    let accountName = '';
    let accountType: AccountType = 'unknown';
    let openingBalance: number | undefined;
    let closingBalance: number | undefined;
    let periodStart: string | undefined;
    let periodEnd: string | undefined;

    // Extract BSB and account number
    const bsbMatch = pdfText.match(
      /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*Account[\s#:]*(\d+)/i
    );
    if (bsbMatch) {
      bsb = bsbMatch[1].replace(/\s|-/g, '');
      accountNumber = bsbMatch[2];
    }

    // Westpac account number format
    if (!accountNumber) {
      const accMatch = pdfText.match(
        /Account\s*(?:Number|No\.?)[\s:]*(\d{6}\s*\d{6})/i
      );
      if (accMatch) {
        accountNumber = accMatch[1].replace(/\s/g, '');
      }
    }

    // Extract account type
    for (const [keyword, type] of Object.entries(this.config.accountTypes)) {
      if (new RegExp(keyword, 'i').test(pdfText)) {
        accountName = keyword;
        accountType = type;
        break;
      }
    }

    // Extract statement period
    for (const pattern of this.config.periodPatterns || []) {
      const match = pdfText.match(pattern);
      if (match) {
        periodStart = parseDate(match[1], this.config.dateFormats) || undefined;
        periodEnd = parseDate(match[2], this.config.dateFormats) || undefined;
        break;
      }
    }

    // Extract balances
    if (this.config.openingBalancePattern) {
      const openMatch = pdfText.match(this.config.openingBalancePattern);
      if (openMatch) {
        openingBalance = parseAmount(openMatch[1]) ?? undefined;
      }
    }

    if (this.config.closingBalancePattern) {
      const closeMatch = pdfText.match(this.config.closingBalancePattern);
      if (closeMatch) {
        closingBalance = parseAmount(closeMatch[1]) ?? undefined;
      }
    }

    return {
      accountNumber: accountNumber || 'UNKNOWN',
      accountName: accountName || undefined,
      accountType,
      bsb: bsb || undefined,
      openingBalance,
      closingBalance,
      statementPeriod:
        periodStart && periodEnd
          ? { start: periodStart, end: periodEnd }
          : undefined,
    };
  }
}
