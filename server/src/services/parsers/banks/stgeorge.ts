/**
 * St.George Bank Statement Parser
 *
 * Handles St.George transaction account, savings, and credit card statements.
 * St.George is part of the Westpac group but has distinct branding.
 */

import {
  BankParserConfig,
  ParsedTransaction,
  AccountInfo,
  AccountType,
} from '../types';
import { BaseBankParser, parseDate, parseAmount } from '../base-parser';

/**
 * St.George Parser Configuration
 */
const STGEORGE_CONFIG: BankParserConfig = {
  bankId: 'stgeorge',
  bankName: 'St.George',
  displayName: 'St.George Bank',

  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'DD MMM YYYY'],

  headerPatterns: [
    /St\.?\s*George/i,
    /stgeorge\.com/i,
    /BSB:\s*11\d{4}/i, // St.George BSBs start with 11
    /BSB:\s*33\d{4}/i, // Some St.George BSBs
    /St\.?\s*George\s+Statement/i,
  ],

  minHeaderMatches: 2,

  accountPatterns: [
    /Account\s*(?:Number|No\.?)[\s:]*(\d{9,})/i,
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
    'Complete Freedom': 'transaction',
    'Freedom': 'transaction',
    'Maxi Saver': 'savings',
    'Incentive Saver': 'savings',
    'Amplify': 'credit',
    'Vertigo': 'credit',
    'Business': 'business',
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
 * St.George Bank Parser Implementation
 */
export class StGeorgeParser extends BaseBankParser {
  config = STGEORGE_CONFIG;

  /**
   * Parse transactions from St.George statement
   */
  async parseTransactions(pdfText: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    const lines = this.splitLines(pdfText);

    let inTransactionSection = false;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      if (/^\s*Date\s+(?:Transaction|Details)/i.test(line)) {
        inTransactionSection = true;
        continue;
      }

      if (inTransactionSection && /^\s*(?:Closing|Total)\s+/i.test(line)) {
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
    const match = line.match(
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})?\s*(-?\$?[\d,]+\.\d{2})?\s*(-?\$?[\d,]+\.\d{2})?$/
    );

    if (!match) return null;

    const [, rawDate, rawDesc, val1, val2, val3] = match;

    const date = parseDate(rawDate, this.config.dateFormats);
    if (!date) return null;

    let amount: number | null = null;
    let balance: number | undefined;

    const values = [val1, val2, val3].filter(Boolean);

    if (values.length === 3) {
      const debit = parseAmount(values[0]);
      const credit = parseAmount(values[1]);
      balance = parseAmount(values[2]) ?? undefined;
      amount = debit && debit !== 0 ? -Math.abs(debit) : credit ?? 0;
    } else if (values.length === 2) {
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

    const bsbMatch = pdfText.match(
      /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*Account[\s#:]*(\d+)/i
    );
    if (bsbMatch) {
      bsb = bsbMatch[1].replace(/\s|-/g, '');
      accountNumber = bsbMatch[2];
    }

    for (const [keyword, type] of Object.entries(this.config.accountTypes)) {
      if (new RegExp(keyword, 'i').test(pdfText)) {
        accountName = keyword;
        accountType = type;
        break;
      }
    }

    return {
      accountNumber: accountNumber || 'UNKNOWN',
      accountName: accountName || undefined,
      accountType,
      bsb: bsb || undefined,
    };
  }
}
