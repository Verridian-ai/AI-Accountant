/**
 * Commonwealth Bank (CBA) Statement Parser
 *
 * Reference implementation for Australian bank statement parsing.
 * Handles CBA transaction account, savings, and credit card statements.
 */

import {
  BankParserConfig,
  ParsedTransaction,
  AccountInfo,
  AccountType,
} from '../types';
import { BaseBankParser, parseDate, parseAmount } from '../base-parser';

/**
 * CBA Parser Configuration
 */
const CBA_CONFIG: BankParserConfig = {
  bankId: 'cba',
  bankName: 'Commonwealth Bank',
  displayName: 'Commonwealth Bank of Australia',

  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'DD MMM YYYY'],

  headerPatterns: [
    /Commonwealth\s*Bank/i,
    /CommBank/i,
    /CBA/i,
    /NetBank/i,
    /BSB:\s*06\d{4}/i, // CBA BSBs start with 06
    /Account\s+Statement/i,
  ],

  minHeaderMatches: 2,

  accountPatterns: [
    /Account\s*(?:Number|No\.?)[\s:]*(\d{4}\s*\d{4}\s*\d{4})/i,
    /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*Account[\s:]*(\d+)/i,
    /(\d{6})[\s-](\d{8,10})/,
  ],

  transactionPatterns: {
    datePattern: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    amountPattern: /\$?([\d,]+\.\d{2})/,
    transactionLinePattern:
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*(-?\$?[\d,]+\.\d{2})?/,
    debitIndicators: ['-', 'DR'],
    creditIndicators: ['+', 'CR'],
    separateDebitCreditColumns: false,
  },

  accountTypes: {
    'Smart Access': 'transaction',
    'Complete Access': 'transaction',
    'Streamline': 'transaction',
    'Goal Saver': 'savings',
    'NetBank Saver': 'savings',
    'Youthsaver': 'savings',
    'Mastercard': 'credit',
    'Credit Card': 'credit',
    'Business': 'business',
    'Offset': 'offset',
    'Home Loan': 'loan',
  },

  periodPatterns: [
    /Statement\s+Period[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /From[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*To[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ],

  openingBalancePattern:
    /(?:Opening|Beginning)\s*Balance[\s:]*\$?([\d,]+\.\d{2})/i,
  closingBalancePattern:
    /(?:Closing|Ending)\s*Balance[\s:]*\$?([\d,]+\.\d{2})/i,
};

/**
 * Commonwealth Bank Parser Implementation
 */
export class CBAParser extends BaseBankParser {
  config = CBA_CONFIG;

  /**
   * Parse transactions from CBA statement
   */
  async parseTransactions(pdfText: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    const lines = this.splitLines(pdfText);

    // Track running balance for validation
    let lastBalance: number | undefined;

    // Find transaction section
    let inTransactionSection = false;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      // Detect start of transactions
      if (
        /^\s*Date\s+Transaction\s+/i.test(line) ||
        /^\s*Date\s+Description\s+/i.test(line)
      ) {
        inTransactionSection = true;
        continue;
      }

      // Detect end of transactions
      if (
        inTransactionSection &&
        (/^\s*Closing\s+Balance/i.test(line) ||
          /^\s*Total\s+/i.test(line) ||
          /^\s*Page\s+\d+/i.test(line))
      ) {
        continue;
      }

      // Skip non-transaction content
      if (!inTransactionSection && !this.isTransactionLine(line)) {
        continue;
      }

      // Try to parse transaction
      const tx = this.parseTransactionLine(line, lineNumber);
      if (tx) {
        // Track balance
        if (tx.balance !== undefined) {
          lastBalance = tx.balance;
        }
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
    // Standard CBA format: DD/MM/YYYY Description Amount Balance
    const match = line.match(
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})(?:\s+(-?\$?[\d,]+\.\d{2}))?$/
    );

    if (!match) {
      // Try alternate format without balance
      const altMatch = line.match(
        /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/
      );

      if (altMatch) {
        const [, rawDate, rawDesc, rawAmount] = altMatch;

        const date = parseDate(rawDate, this.config.dateFormats);
        const amount = parseAmount(rawAmount);

        if (date && amount !== null) {
          return {
            date,
            description: this.cleanDescription(rawDesc),
            amount,
            rawDate,
            rawAmount,
            rawDescription: rawDesc,
            lineNumber,
          };
        }
      }

      return null;
    }

    const [, rawDate, rawDesc, rawAmount, rawBalance] = match;

    const date = parseDate(rawDate, this.config.dateFormats);
    const amount = parseAmount(rawAmount);
    const balance = rawBalance ? parseAmount(rawBalance) : undefined;

    if (!date || amount === null) {
      return null;
    }

    // Extract merchant name from description
    const merchantName = this.extractMerchantName(rawDesc);

    return {
      date,
      description: this.cleanDescription(rawDesc),
      amount,
      balance: balance ?? undefined,
      merchantName,
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
      /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*(?:Account|Acc)[\s#:]*(\d+)/i
    );
    if (bsbMatch) {
      bsb = bsbMatch[1].replace(/\s|-/g, '');
      accountNumber = bsbMatch[2];
    }

    // Try alternate account number patterns
    if (!accountNumber) {
      const accMatch = pdfText.match(
        /Account\s*(?:Number|No\.?)[\s:]*(\d{4}\s*\d{4}\s*\d{4})/i
      );
      if (accMatch) {
        accountNumber = accMatch[1].replace(/\s/g, '');
      }
    }

    // Extract account name/type
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
        periodStart =
          parseDate(match[1], this.config.dateFormats) || undefined;
        periodEnd = parseDate(match[2], this.config.dateFormats) || undefined;
        break;
      }
    }

    // Extract opening balance
    if (this.config.openingBalancePattern) {
      const openMatch = pdfText.match(this.config.openingBalancePattern);
      if (openMatch) {
        openingBalance = parseAmount(openMatch[1]) ?? undefined;
      }
    }

    // Extract closing balance
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

  /**
   * Extract merchant name from transaction description
   */
  private extractMerchantName(description: string): string | undefined {
    // CBA often has format: "MERCHANT NAME CITY AUS"
    // Or: "VISA PURCHASE MERCHANT NAME"

    let cleaned = description;

    // Remove common prefixes
    cleaned = cleaned
      .replace(/^(VISA|EFTPOS|DIRECT DEBIT|DIRECT CREDIT|BPAY|TRANSFER)\s*/i, '')
      .replace(/^(Purchase|Withdrawal|Deposit)\s*/i, '');

    // Remove location suffixes (AU, AUS, Sydney, etc.)
    cleaned = cleaned.replace(/\s+(AU|AUS|NSW|VIC|QLD|SA|WA|TAS|NT|ACT)$/i, '');
    cleaned = cleaned.replace(/\s+\d{4}$/i, ''); // Postcode

    // Take first meaningful part
    const parts = cleaned.split(/\s{2,}|\t/);
    if (parts.length > 0 && parts[0].length > 2) {
      return parts[0].trim();
    }

    return cleaned.trim() || undefined;
  }
}
