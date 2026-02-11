/**
 * NAB (National Australia Bank) Statement Parser
 *
 * Handles NAB transaction account, savings, and credit card statements.
 */

import {
  BankParserConfig,
  ParsedTransaction,
  AccountInfo,
  AccountType,
} from '../types';
import { BaseBankParser, parseDate, parseAmount } from '../base-parser';

/**
 * NAB Parser Configuration
 */
const NAB_CONFIG: BankParserConfig = {
  bankId: 'nab',
  bankName: 'NAB',
  displayName: 'National Australia Bank',

  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'DD MMM YYYY'],

  headerPatterns: [
    /National\s+Australia\s+Bank/i,
    /NAB/i,
    /nab\.com/i,
    /BSB:\s*08\d{4}/i, // NAB BSBs start with 08
    /NAB\s+Statement/i,
  ],

  minHeaderMatches: 2,

  accountPatterns: [
    /Account\s*(?:Number|No\.?)[\s:]*(\d{10,})/i,
    /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*Account[\s:]*(\d+)/i,
  ],

  transactionPatterns: {
    datePattern: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    amountPattern: /\$?([\d,]+\.\d{2})/,
    transactionLinePattern:
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})/,
    debitIndicators: ['-', 'DR'],
    creditIndicators: ['+', 'CR'],
    separateDebitCreditColumns: false,
  },

  accountTypes: {
    'Classic Banking': 'transaction',
    'iSaver': 'savings',
    'Reward Saver': 'savings',
    'Qantas': 'credit',
    'Rewards': 'credit',
    'Low Rate': 'credit',
    'Business': 'business',
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
 * NAB Parser Implementation
 */
export class NABParser extends BaseBankParser {
  config = NAB_CONFIG;

  /**
   * Parse transactions from NAB statement
   */
  async parseTransactions(pdfText: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    const lines = this.splitLines(pdfText);

    let inTransactionSection = false;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      // Detect transaction section
      if (/^\s*Date\s+(?:Transaction|Details)/i.test(line)) {
        inTransactionSection = true;
        continue;
      }

      if (
        inTransactionSection &&
        /^\s*(?:Closing|Total)\s+/i.test(line)
      ) {
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
    // NAB format: DD/MM/YYYY Description Amount Balance
    const match = line.match(
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})(?:\s+(-?\$?[\d,]+\.\d{2}))?$/
    );

    if (!match) {
      return null;
    }

    const [, rawDate, rawDesc, rawAmount, rawBalance] = match;

    const date = parseDate(rawDate, this.config.dateFormats);
    const amount = parseAmount(rawAmount);
    const balance = rawBalance ? parseAmount(rawBalance) : undefined;

    if (!date || amount === null) {
      return null;
    }

    return {
      date,
      description: this.cleanDescription(rawDesc),
      amount,
      balance: balance ?? undefined,
      rawDate,
      rawAmount,
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

    // NAB account number format
    if (!accountNumber) {
      const accMatch = pdfText.match(
        /Account\s*(?:Number|No\.?)[\s:]*(\d{10,})/i
      );
      if (accMatch) {
        accountNumber = accMatch[1];
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
