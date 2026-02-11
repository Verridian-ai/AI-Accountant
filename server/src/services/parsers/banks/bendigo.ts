/**
 * Bendigo Bank Statement Parser
 *
 * Handles Bendigo Bank transaction account and savings statements.
 */

import {
  BankParserConfig,
  ParsedTransaction,
  AccountInfo,
  AccountType,
} from '../types';
import { BaseBankParser, parseDate, parseAmount } from '../base-parser';

/**
 * Bendigo Parser Configuration
 */
const BENDIGO_CONFIG: BankParserConfig = {
  bankId: 'bendigo',
  bankName: 'Bendigo Bank',
  displayName: 'Bendigo and Adelaide Bank',

  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'DD MMM YYYY'],

  headerPatterns: [
    /Bendigo\s+(?:Bank|and\s+Adelaide)/i,
    /bendigo\.com/i,
    /BSB:\s*63\d{4}/i, // Bendigo BSBs start with 63
    /Bendigo\s+Statement/i,
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
    separateDebitCreditColumns: false,
  },

  accountTypes: {
    'Everyday': 'transaction',
    'Easy Saver': 'savings',
    'Reward Saver': 'savings',
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
 * Bendigo Bank Parser Implementation
 */
export class BendigoParser extends BaseBankParser {
  config = BENDIGO_CONFIG;

  /**
   * Parse transactions from Bendigo statement
   */
  async parseTransactions(pdfText: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    const lines = this.splitLines(pdfText);

    let inTransactionSection = false;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      if (/^\s*Date\s+(?:Transaction|Details|Description)/i.test(line)) {
        inTransactionSection = true;
        continue;
      }

      if (inTransactionSection && /^\s*(?:Closing|Total)\s+/i.test(line)) {
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
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})(?:\s+(-?\$?[\d,]+\.\d{2}))?$/
    );

    if (!match) return null;

    const [, rawDate, rawDesc, rawAmount, rawBalance] = match;

    const date = parseDate(rawDate, this.config.dateFormats);
    const amount = parseAmount(rawAmount);
    const balance = rawBalance ? parseAmount(rawBalance) : undefined;

    if (!date || amount === null) return null;

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
