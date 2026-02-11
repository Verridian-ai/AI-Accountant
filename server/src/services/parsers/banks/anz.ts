/**
 * ANZ Bank Statement Parser
 *
 * Handles ANZ transaction account, savings, and credit card statements.
 * ANZ uses "DD MMM YYYY" date format and has running balance column.
 */

import {
  BankParserConfig,
  ParsedTransaction,
  AccountInfo,
  AccountType,
} from '../types';
import { BaseBankParser, parseDate, parseAmount } from '../base-parser';

/**
 * ANZ Parser Configuration
 */
const ANZ_CONFIG: BankParserConfig = {
  bankId: 'anz',
  bankName: 'ANZ',
  displayName: 'Australia and New Zealand Banking Group',

  dateFormats: ['DD MMM YYYY', 'DD MMM YY', 'DD/MM/YYYY'],

  headerPatterns: [
    /ANZ\s*Bank/i,
    /Australia\s+and\s+New\s+Zealand\s+Banking/i,
    /ANZ\s+Statement/i,
    /BSB:\s*01\d{4}/i, // ANZ BSBs start with 01
    /anz\.com/i,
  ],

  minHeaderMatches: 2,

  accountPatterns: [
    /Account\s*(?:Number|No\.?)[\s:]*(\d{9,})/i,
    /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*Account[\s:]*(\d+)/i,
  ],

  transactionPatterns: {
    datePattern: /(\d{1,2}\s+\w{3}\s+\d{2,4})/,
    amountPattern: /\$?([\d,]+\.\d{2})/,
    transactionLinePattern:
      /(\d{1,2}\s+\w{3}\s+\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*(-?\$?[\d,]+\.\d{2})?/,
    debitIndicators: ['-', 'DR'],
    creditIndicators: ['+', 'CR'],
    separateDebitCreditColumns: false,
  },

  accountTypes: {
    'Access Advantage': 'transaction',
    'Access Basic': 'transaction',
    'Access Select': 'transaction',
    'Online Saver': 'savings',
    'Progress Saver': 'savings',
    'Premium Cash': 'savings',
    'Visa': 'credit',
    'Rewards': 'credit',
    'Platinum': 'credit',
    'Business': 'business',
    'Offset': 'offset',
  },

  periodPatterns: [
    /Statement\s+Period[\s:]*(\d{1,2}\s+\w{3}\s+\d{2,4})\s*(?:to|-)\s*(\d{1,2}\s+\w{3}\s+\d{2,4})/i,
  ],

  openingBalancePattern:
    /(?:Opening|Beginning)\s*Balance[\s:]*\$?([\d,]+\.\d{2})/i,
  closingBalancePattern:
    /(?:Closing|Ending)\s*Balance[\s:]*\$?([\d,]+\.\d{2})/i,
};

/**
 * ANZ Bank Parser Implementation
 */
export class ANZParser extends BaseBankParser {
  config = ANZ_CONFIG;

  /**
   * Parse transactions from ANZ statement
   */
  async parseTransactions(pdfText: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    const lines = this.splitLines(pdfText);

    let inTransactionSection = false;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      // Detect start of transactions
      if (/^\s*Date\s+Transaction\s+Details/i.test(line)) {
        inTransactionSection = true;
        continue;
      }

      // Detect end
      if (
        inTransactionSection &&
        (/^\s*Closing\s+Balance/i.test(line) || /^\s*Total\s+/i.test(line))
      ) {
        continue;
      }

      // Skip if not in transaction section and doesn't look like transaction
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
    // ANZ format: DD MMM YYYY Description Amount Balance
    // Or with separate debit/credit: DD MMM YYYY Description Debit Credit Balance
    const match = line.match(
      /(\d{1,2}\s+\w{3}\s+\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})(?:\s+(-?\$?[\d,]+\.\d{2}))?(?:\s+(-?\$?[\d,]+\.\d{2}))?$/
    );

    if (!match) {
      return null;
    }

    const [, rawDate, rawDesc, val1, val2, val3] = match;

    const date = parseDate(rawDate, this.config.dateFormats);
    if (!date) return null;

    // Determine amount and balance based on column count
    let amount: number | null;
    let balance: number | undefined;

    if (val3) {
      // Three values: debit, credit, balance
      const debit = parseAmount(val1);
      const credit = parseAmount(val2);
      balance = parseAmount(val3) ?? undefined;
      // Use whichever is non-zero
      amount = debit && debit !== 0 ? -Math.abs(debit) : credit ?? 0;
    } else if (val2) {
      // Two values: amount, balance
      amount = parseAmount(val1);
      balance = parseAmount(val2) ?? undefined;
    } else {
      // Single value: amount only
      amount = parseAmount(val1);
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

    // Try ANZ-specific account number pattern
    if (!accountNumber) {
      const accMatch = pdfText.match(/Account\s*(?:Number|No\.?)[\s:]*(\d{9,})/i);
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
