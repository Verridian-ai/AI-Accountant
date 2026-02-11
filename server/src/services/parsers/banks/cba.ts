/**
 * Commonwealth Bank (CBA) Statement Parser
 *
 * Handles CBA Business Transaction Account statements.
 * Parses the "DD MMM" date format with separate debit/credit columns.
 *
 * CBA pdf-parse output produces multi-line transactions:
 *
 * Single-line (amount on same line):
 *   Debit:  "01 OctAccount Fee10.00$$736.91CR"
 *   Credit: "03 OctTransfer from xx7596 CommBank app$150.00$168.76CR"
 *
 * Multi-line (amount on continuation line):
 *   "02 OctCBA MERCHANT FEE"
 *   "5353109291838003"
 *   "Value Date: 30/09/2023155.18$$531.73CR"
 *
 *   "03 OctGoogle Storage Barangaroo AU"
 *   "Card xx6536"
 *   "Value Date: 30/09/20234.39$$524.59CR"
 */

import {
  BankParserConfig,
  ParsedTransaction,
  AccountInfo,
  AccountType,
} from '../types';
import { BaseBankParser, parseAmount } from '../base-parser';

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04',
  may: '05', jun: '06', jul: '07', aug: '08',
  sep: '09', oct: '10', nov: '11', dec: '12',
};

const CBA_CONFIG: BankParserConfig = {
  bankId: 'cba',
  bankName: 'Commonwealth Bank',
  displayName: 'Commonwealth Bank of Australia',

  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'DD MMM YYYY', 'DD MMM'],

  headerPatterns: [
    /Commonwealth\s*Bank/i,
    /CommBank/i,
    /CBA/i,
    /NetBank/i,
    /BSB:\s*06\d{4}/i,
    /Account\s+Statement/i,
  ],

  minHeaderMatches: 2,

  accountPatterns: [
    /Account\s*(?:Number|No\.?)[\s:]*(\d{4}\s*\d{4}\s*\d{4})/i,
    /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*Account[\s:]*(\d+)/i,
    /(\d{2}\s+\d{4}\s+\d{8,10})/,
  ],

  transactionPatterns: {
    datePattern: /(\d{1,2}\s+\w{3})/,
    amountPattern: /\$?([\d,]+\.\d{2})/,
    transactionLinePattern: /(\d{1,2}\s+\w{3})/,
    debitIndicators: ['-', 'DR'],
    creditIndicators: ['+', 'CR'],
    separateDebitCreditColumns: true,
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
    /Period\s*(\d{1,2}\s+\w{3}\s+\d{4})\s*[-–]\s*(\d{1,2}\s+\w{3}\s+\d{4})/i,
    /Statement\s+Period[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /From[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*To[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ],

  openingBalancePattern:
    /OPENING\s+BALANCE\s*\$?([\d,]+\.\d{2})/i,
  closingBalancePattern:
    /CLOSING\s+BALANCE\s*\$?([\d,]+\.\d{2})/i,
};

const AMT = '(\\d{1,3}(?:,\\d{3}){0,2}\\.\\d{2})';

/** Try to extract debit amount+balance from a text ending in amount$$balanceCR/DR.
 *  Parses right-to-left: first extract $$balance, then find amount before $$.
 *  Uses lookbehind to prevent matching amounts concatenated with reference numbers.
 *  If lookbehind fails, falls back to extracting just the raw decimal number. */
function tryDebitAmountBalance(text: string): { desc: string; amount: number; balance: number } | null {
  // Find $$ separator
  const ddIdx = text.lastIndexOf('$$');
  if (ddIdx < 0) return null;

  // Parse balance after $$
  const afterDD = text.substring(ddIdx + 2);
  const balMatch = afterDD.match(new RegExp(`^${AMT}(CR|DR)\\s*$`));
  if (!balMatch) return null;
  const balance = parseAmount(balMatch[1] + balMatch[2]);
  if (balance === null) return null;

  // Before $$ is "description + amount" — extract amount from end
  const beforeDD = text.substring(0, ddIdx);

  // First try: clean amount with non-digit boundary (best case)
  const cleanAmtMatch = beforeDD.match(/(?<!\d)(\d{1,3}(?:,\d{3}){0,2}\.\d{2})$/);
  if (cleanAmtMatch) {
    const amount = parseAmount(cleanAmtMatch[1]);
    if (amount !== null) {
      const desc = beforeDD.substring(0, beforeDD.length - cleanAmtMatch[0].length);
      return { desc, amount: -Math.abs(amount), balance };
    }
  }

  // Fallback: when reference number is concatenated with amount (e.g., "100015641,372.76")
  // Extract just the last decimal portion as the amount — everything before . that forms
  // a valid amount. Take the shortest valid amount (most conservative).
  const rawMatch = beforeDD.match(/(\d{1,3}\.\d{2})$/);
  if (rawMatch) {
    const amount = parseAmount(rawMatch[1]);
    if (amount !== null) {
      const desc = beforeDD.substring(0, beforeDD.length - rawMatch[0].length);
      return { desc, amount: -Math.abs(amount), balance };
    }
  }

  return null;
}

/** Try to extract credit amount+balance from a text ending in $amount$balanceCR/DR.
 *  Credit format has $ before amount and $ before balance. */
function tryCreditAmountBalance(text: string): { desc: string; amount: number; balance: number } | null {
  // Match from the right: $balance(CR|DR) at end
  const balRe = new RegExp(`\\$${AMT}(CR|DR)\\s*$`);
  const balMatch = text.match(balRe);
  if (!balMatch || balMatch.index === undefined) return null;
  const balance = parseAmount(balMatch[1] + balMatch[2]);
  if (balance === null) return null;

  // Before the balance, find $amount
  const beforeBal = text.substring(0, balMatch.index);
  const amtRe = new RegExp(`\\$${AMT}$`);
  const amtMatch = beforeBal.match(amtRe);
  if (!amtMatch) return null;
  const amount = parseAmount(amtMatch[1]);
  if (amount === null) return null;

  const desc = beforeBal.substring(0, beforeBal.length - amtMatch[0].length);
  return { desc, amount: Math.abs(amount), balance };
}

/** Try to extract amount+balance from a line (debit first, then credit) */
function tryAmountBalance(text: string): { desc: string; amount: number; balance: number } | null {
  // Check for $$ (debit indicator) first
  if (text.includes('$$')) {
    return tryDebitAmountBalance(text);
  }
  return tryCreditAmountBalance(text);
}

export class CBAParser extends BaseBankParser {
  config = CBA_CONFIG;

  private inferYear(month: string, statementYear: number, periodStartMonth: number, periodEndMonth: number): number {
    const monthNum = parseInt(MONTH_MAP[month.toLowerCase()] || '0');
    if (monthNum === 0) return statementYear;
    if (periodEndMonth < periodStartMonth) {
      if (monthNum >= periodStartMonth) return statementYear;
      return statementYear + 1;
    }
    return statementYear;
  }

  private extractStatementPeriod(pdfText: string): {
    startDate: string; endDate: string;
    startYear: number; startMonth: number;
    endYear: number; endMonth: number;
  } | null {
    // "Period1 Oct 2023 - 30 Dec 2023"
    const periodMatch = pdfText.match(
      /Period\s*(\d{1,2})\s+(\w{3})\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+(\w{3})\s+(\d{4})/i
    );
    if (periodMatch) {
      const [, sd, sm, sy, ed, em, ey] = periodMatch;
      const startMonth = parseInt(MONTH_MAP[sm.toLowerCase()] || '0');
      const endMonth = parseInt(MONTH_MAP[em.toLowerCase()] || '0');
      return {
        startDate: `${sy}-${String(startMonth).padStart(2, '0')}-${sd.padStart(2, '0')}`,
        endDate: `${ey}-${String(endMonth).padStart(2, '0')}-${ed.padStart(2, '0')}`,
        startYear: parseInt(sy), startMonth,
        endYear: parseInt(ey), endMonth,
      };
    }

    const slashMatch = pdfText.match(
      /Period[\s:]*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i
    );
    if (slashMatch) {
      const [, sd, sm, sy, ed, em, ey] = slashMatch;
      return {
        startDate: `${sy}-${sm.padStart(2, '0')}-${sd.padStart(2, '0')}`,
        endDate: `${ey}-${em.padStart(2, '0')}-${ed.padStart(2, '0')}`,
        startYear: parseInt(sy), startMonth: parseInt(sm),
        endYear: parseInt(ey), endMonth: parseInt(em),
      };
    }

    return null;
  }

  /** Check if a line starts with DD MMM (a date) */
  private startsWithDate(line: string): { dayStr: string; monthStr: string; rest: string } | null {
    const m = line.match(/^(\d{1,2})\s+(\w{3})(.*)/);
    if (!m) return null;
    if (!MONTH_MAP[m[2].toLowerCase()]) return null;
    return { dayStr: m[1], monthStr: m[2], rest: m[3] };
  }

  /** Check if a line is a page header/footer/non-transaction line */
  private isSkippableLine(line: string): boolean {
    if (/^Statement\s+\d+/i.test(line)) return true;
    if (/^\(Page\s+\d+/i.test(line)) return true;
    if (/^Account\s+Number/i.test(line)) return true;
    if (/^\d{4}\.\d+\.\d+/i.test(line)) return true;  // barcode
    if (/^SL\.R3\./i.test(line)) return true;
    if (/^V\d{2}\.\d{2}\.\d{2}/i.test(line)) return true;
    if (/^06\s+\d{4}\s+\d{8}/i.test(line)) return true;
    if (/^Date$/i.test(line)) return true;
    if (/^TransactionDebitCreditBalance/i.test(line)) return true;
    if (/OPENING\s+BALANCE/i.test(line)) return true;
    if (/CLOSING\s+BALANCE/i.test(line)) return true;
    if (/^Opening\s+balance.*Total/i.test(line)) return true;
    if (/^\$[\d,]+\.\d{2}(CR|DR)?\$[\d,]+/i.test(line)) return true;  // summary line
    if (/^Fee\s+Summary/i.test(line)) return true;
    if (/^Important\s+Information/i.test(line)) return true;
    if (/^Transaction\s+Summary/i.test(line)) return true;
    if (/^Your\s+Statement/i.test(line)) return true;
    if (/^Enquiries/i.test(line)) return true;
    if (/^13\s+\d{4}/i.test(line)) return true;  // phone number
    if (/^Name:/i.test(line)) return true;
    if (/^Note:/i.test(line)) return true;
    if (/^If\s+this\s+account/i.test(line)) return true;
    if (/^The\s+date\s+of\s+transactions/i.test(line)) return true;
    if (/^appears\s+on/i.test(line)) return true;
    return false;
  }

  async parseTransactions(pdfText: string): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];
    const lines = pdfText.split(/\r?\n/);

    const period = this.extractStatementPeriod(pdfText);
    // Derive year from statement period dates — never use new Date() for determinism
    if (!period) {
      console.warn('[CBAParser] No statement period found in PDF — transactions may have incorrect years');
    }
    const statementYear = period?.startYear ?? 2000;
    const periodStartMonth = period?.startMonth ?? 1;
    const periodEndMonth = period?.endMonth ?? 12;

    // State: we collect lines into a "pending transaction" and finalize when we
    // see the amount+balance (which might be on the same line or a continuation line)
    let pendingDate: string | null = null;
    let pendingDesc: string = '';
    let pendingContLines: string[] = [];
    let pendingLineNum = 0;
    let pastFees = false;

    const finalizePending = () => {
      if (!pendingDate || !pendingDesc) return;

      // Try to find amount+balance in continuation lines (last continuation often has it)
      let amount: number | null = null;
      let balance: number | null = null;
      let descParts = [pendingDesc];

      for (let i = 0; i < pendingContLines.length; i++) {
        const contLine = pendingContLines[i];

        // FIRST: Strip "Value Date:" prefix if present (e.g., "Value Date: 30/09/20234.39$$524.59CR")
        // Must do this BEFORE raw tryAmountBalance to avoid matching "20234.39" as "$234.39"
        if (/^Value\s+Date/i.test(contLine)) {
          const vdStripped = contLine.replace(/^Value\s+Date:\s*\d{2}\/\d{2}\/\d{4}/i, '').trim();
          if (vdStripped) {
            const ab = tryAmountBalance(vdStripped);
            if (ab) {
              if (ab.desc.trim()) descParts.push(ab.desc.trim());
              amount = ab.amount;
              balance = ab.balance;
              break;
            }
          }
          continue;
        }

        // Skip card info lines
        if (/^Card\s+xx\d+/i.test(contLine)) continue;

        // Try to extract amount+balance from this continuation line
        const ab = tryAmountBalance(contLine);
        if (ab) {
          if (ab.desc.trim()) {
            descParts.push(ab.desc.trim());
          }
          amount = ab.amount;
          balance = ab.balance;
          break;
        }

        // Pure description continuation line
        descParts.push(contLine);
      }

      if (amount !== null && balance !== null) {
        const fullDesc = descParts.join(' ');
        transactions.push({
          date: pendingDate,
          description: this.cleanDescription(fullDesc),
          amount,
          balance,
          merchantName: this.extractMerchantName(fullDesc),
          rawDate: pendingDate,
          rawAmount: String(Math.abs(amount)),
          lineNumber: pendingLineNum,
        });
      }

      pendingDate = null;
      pendingDesc = '';
      pendingContLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Stop processing after fee summary section
      if (/^Fee\s+Summary/i.test(line) || /^Transaction\s+Summary/i.test(line)) {
        pastFees = true;
      }
      if (pastFees) continue;
      if (/^Important\s+Information/i.test(line)) break;

      if (this.isSkippableLine(line)) continue;

      // Check if line starts with a date (DD MMM)
      const dateInfo = this.startsWithDate(line);
      if (dateInfo) {
        // Finalize any pending transaction first
        finalizePending();

        const { dayStr, monthStr, rest } = dateInfo;
        const year = this.inferYear(monthStr, statementYear, periodStartMonth, periodEndMonth);
        const monthNum = MONTH_MAP[monthStr.toLowerCase()];
        const date = `${year}-${monthNum}-${dayStr.padStart(2, '0')}`;

        // Try to parse amount+balance from the same line
        const ab = tryAmountBalance(rest);
        if (ab) {
          // Complete single-line transaction
          const desc = ab.desc.trim();
          transactions.push({
            date,
            description: this.cleanDescription(desc),
            amount: ab.amount,
            balance: ab.balance,
            merchantName: this.extractMerchantName(desc),
            rawDate: `${dayStr} ${monthStr}`,
            rawAmount: String(Math.abs(ab.amount)),
            lineNumber: i + 1,
          });
        } else {
          // Multi-line transaction — description only on this line, amount on continuation
          pendingDate = date;
          pendingDesc = rest.trim();
          pendingContLines = [];
          pendingLineNum = i + 1;
        }
        continue;
      }

      // Not a date line — it's a continuation line
      if (pendingDate) {
        pendingContLines.push(line);
      }
    }

    // Finalize last pending
    finalizePending();

    // Post-processing: Fix amounts using balance continuity.
    // When reference numbers are concatenated with amounts (e.g., "100015641,372.76"),
    // the regex may extract wrong amounts. But balances are always reliable since they
    // have a clean $$ or $ separator. Use: amount = current_balance - previous_balance.
    if (transactions.length > 1) {
      for (let i = 1; i < transactions.length; i++) {
        const prev = transactions[i - 1];
        const curr = transactions[i];
        if (prev.balance === undefined || curr.balance === undefined) continue;
        const expectedBalance = prev.balance + curr.amount;

        if (Math.abs(expectedBalance - curr.balance) > 1) {
          // Balance doesn't match — recalculate amount from balance delta
          const correctedAmount = curr.balance - prev.balance;
          curr.amount = correctedAmount;
        }
      }
    }

    return transactions;
  }

  async extractAccountInfo(pdfText: string): Promise<AccountInfo> {
    let accountNumber = '';
    let bsb = '';
    let accountName = '';
    let accountType: AccountType = 'unknown';
    let openingBalance: number | undefined;
    let closingBalance: number | undefined;

    // CBA format "06 2531 10347588"
    const bsbAccMatch = pdfText.match(/(\d{2}\s+\d{4})\s+(\d{8,10})/);
    if (bsbAccMatch) {
      bsb = bsbAccMatch[1].replace(/\s/g, '');
      accountNumber = bsbAccMatch[2];
    }

    if (!accountNumber) {
      const bsbMatch = pdfText.match(
        /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*(?:Account|Acc)[\s#:]*(\d+)/i
      );
      if (bsbMatch) {
        bsb = bsbMatch[1].replace(/\s|-/g, '');
        accountNumber = bsbMatch[2];
      }
    }

    for (const [keyword, type] of Object.entries(this.config.accountTypes)) {
      if (new RegExp(keyword, 'i').test(pdfText)) {
        accountName = keyword;
        accountType = type;
        break;
      }
    }

    const period = this.extractStatementPeriod(pdfText);

    const openMatch = pdfText.match(/OPENING\s+BALANCE\s*\$?([\d,]+\.\d{2})\s*(CR|DR)?/i);
    if (openMatch) {
      openingBalance = parseAmount(openMatch[1] + (openMatch[2] || '')) ?? undefined;
    }

    const closeMatch = pdfText.match(/CLOSING\s+BALANCE\s*\$?([\d,]+\.\d{2})\s*(CR|DR)?/i);
    if (closeMatch) {
      closingBalance = parseAmount(closeMatch[1] + (closeMatch[2] || '')) ?? undefined;
    }

    return {
      accountNumber: accountNumber || 'UNKNOWN',
      accountName: accountName || undefined,
      accountType,
      bsb: bsb || undefined,
      openingBalance,
      closingBalance,
      statementPeriod:
        period ? { start: period.startDate, end: period.endDate } : undefined,
    };
  }

  private extractMerchantName(description: string): string | undefined {
    let cleaned = description;
    cleaned = cleaned
      .replace(/^(VISA|EFTPOS|DIRECT DEBIT|DIRECT CREDIT|BPAY|TRANSFER)\s*/i, '')
      .replace(/^(Purchase|Withdrawal|Deposit)\s*/i, '');
    cleaned = cleaned.replace(/\s+(AU|AUS|NSW|VIC|QLD|SA|WA|TAS|NT|ACT)$/i, '');
    cleaned = cleaned.replace(/\s+\d{4}$/i, '');

    const parts = cleaned.split(/\s{2,}|\t/);
    if (parts.length > 0 && parts[0].length > 2) {
      return parts[0].trim();
    }
    return cleaned.trim() || undefined;
  }
}
