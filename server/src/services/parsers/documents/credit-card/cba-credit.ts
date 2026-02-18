/**
 * Commonwealth Bank (CBA) Credit Card Statement Parser
 *
 * Parses CBA credit card statements including:
 * - Visa, Mastercard credit cards
 * - Low Rate, Awards, Diamond cards
 * - Business credit cards
 *
 * Handles credit card specific features:
 * - Billing cycle dates
 * - Credit limits and available credit
 * - Interest charges and APRs
 * - Foreign transaction conversion
 * - Minimum payment due
 */

import {
  BaseCreditCardParser,
  CreditCardParserConfig,
  CreditCardTransaction,
  CreditCardAccountInfo,
  parseForeignAmount,
  parseConversionRate,
} from './base-credit-parser';

/**
 * CBA Credit Card Parser Configuration
 */
const CBA_CREDIT_CONFIG: CreditCardParserConfig = {
  bankId: 'cba',
  bankName: 'Commonwealth Bank',
  displayName: 'Commonwealth Bank Credit Card',

  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'DD MMM YYYY', 'DD MMM YY'],

  headerPatterns: [
    /Commonwealth\s*Bank/i,
    /CommBank/i,
    /CBA/i,
    /Credit\s*Card\s*Statement/i,
    /Mastercard/i,
    /Visa\s*Card/i,
  ],

  minHeaderMatches: 2,

  // Patterns that indicate this is a credit card statement (not a bank statement)
  creditCardIndicators: [
    /Credit\s*Card\s*Statement/i,
    /Credit\s*Limit/i,
    /Available\s*Credit/i,
    /Minimum\s*Payment/i,
    /Payment\s*Due\s*Date/i,
    /Cash\s*Advance/i,
    /Purchase\s*Rate/i,
    /Annual\s*Percentage\s*Rate/i,
    /Interest\s*Charged/i,
    /Card\s*Number/i,
    /Billing\s*Period/i,
  ],

  cardNumberPatterns: [
    /Card\s*(?:Number|No\.?)[\s:]*(\d{4}\s*\*{4,8}\s*\d{4})/i,
    /Card\s*(?:Number|No\.?)[\s:]*(\*{4,12}\s*\d{4})/i,
    /Card\s*(?:ending\s*in|ending)[\s:]*(\d{4})/i,
    /(\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/,
    /(\*{4}\s*\*{4}\s*\*{4}\s*\d{4})/,
  ],

  accountPatterns: [
    /Account\s*(?:Number|No\.?)[\s:]*(\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/i,
    /Account\s*(?:Number|No\.?)[\s:]*(\d+)/i,
  ],

  transactionTypePatterns: {
    purchase: [/VISA\s*PURCHASE/i, /EFTPOS\s*PURCHASE/i, /^PURCHASE/i, /RETAIL\s*PURCHASE/i],
    cash_advance: [/CASH\s*ADVANCE/i, /ATM\s*WITHDRAWAL/i, /CASH\s*WITHDRAWAL/i],
    interest: [
      /INTEREST\s*CHARGE/i,
      /FINANCE\s*CHARGE/i,
      /PURCHASE\s*INTEREST/i,
      /CASH\s*ADVANCE\s*INTEREST/i,
    ],
    fee: [
      /ANNUAL\s*FEE/i,
      /MEMBERSHIP\s*FEE/i,
      /LATE\s*(?:PAYMENT\s*)?FEE/i,
      /OVER\s*LIMIT\s*FEE/i,
      /FOREIGN\s*TRANSACTION\s*FEE/i,
      /CASH\s*ADVANCE\s*FEE/i,
      /CARD\s*FEE/i,
    ],
    payment: [
      /PAYMENT\s*(?:RECEIVED|THANK|CREDITED)?/i,
      /BPAY\s*PAYMENT/i,
      /DIRECT\s*DEBIT\s*PAYMENT/i,
      /AUTOMATIC\s*PAYMENT/i,
    ],
    refund: [/REFUND/i, /CREDIT\s*ADJUSTMENT/i, /REVERSAL/i, /CHARGEBACK/i, /DISPUTE\s*CREDIT/i],
    balance_transfer: [/BALANCE\s*TRANSFER/i, /PROMOTIONAL\s*TRANSFER/i],
    reward: [/REWARD/i, /POINTS/i, /CASHBACK/i, /BONUS/i],
    adjustment: [/ADJUSTMENT/i, /CORRECTION/i],
    unknown: [],
  },

  foreignTransactionPatterns: [
    /[A-Z]{3}\s*[\d,]+\.\d{2}/, // Currency code pattern (e.g., "USD 123.45")
    /\b(USD|EUR|GBP|JPY|SGD|HKD|NZD)\b/i, // Common currency codes
    /Exchange\s*Rate/i,
    /Conversion\s*Rate/i,
    /Foreign\s*(?:Currency|Transaction)/i,
    /International/i,
  ],

  creditLimitPattern: /Credit\s*Limit[\s:]*\$?([\d,]+\.?\d*)/i,
  availableCreditPattern: /Available\s*Credit[\s:]*\$?([\d,]+\.?\d*)/i,
  minimumPaymentPattern: /Minimum\s*(?:Payment|Amount)\s*(?:Due)?[\s:]*\$?([\d,]+\.?\d*)/i,
  paymentDueDatePattern: /Payment\s*Due\s*(?:Date)?[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  openingBalancePattern: /(?:Opening|Previous|Last\s*Statement)\s*Balance[\s:]*\$?([\d,]+\.?\d*)/i,
  closingBalancePattern: /(?:Closing|New|Current|Statement)\s*Balance[\s:]*\$?([\d,]+\.?\d*)/i,

  purchaseAPRPattern: /Purchase\s*(?:Interest\s*)?Rate[\s:]*(\d+\.?\d*)\s*%/i,
  cashAdvanceAPRPattern: /Cash\s*Advance\s*(?:Interest\s*)?Rate[\s:]*(\d+\.?\d*)\s*%/i,

  statementPeriodPatterns: [
    /Statement\s*Period[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /Billing\s*Period[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /From[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*To[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ],

  billingCyclePatterns: [
    /(\d{1,2})\s*days?\s*in\s*(?:this\s*)?billing\s*(?:cycle|period)/i,
    /billing\s*(?:cycle|period)[\s:]*(\d{1,2})\s*days?/i,
  ],
};

/**
 * CBA Credit Card Parser Implementation
 */
export class CBACreditCardParser extends BaseCreditCardParser {
  config = CBA_CREDIT_CONFIG;

  /**
   * Parse transactions from CBA credit card statement
   */
  async parseTransactions(pdfText: string): Promise<CreditCardTransaction[]> {
    const transactions: CreditCardTransaction[] = [];
    const lines = this.splitLines(pdfText);

    let inTransactionSection = false;
    let lineNumber = 0;
    let pendingForeignTransaction: Partial<CreditCardTransaction> | null = null;

    for (const line of lines) {
      lineNumber++;

      // Detect start of transactions section
      if (this.isTransactionHeaderLine(line)) {
        inTransactionSection = true;
        continue;
      }

      // Detect end of transactions section
      if (inTransactionSection && this.isEndOfTransactionsLine(line)) {
        // Flush any pending foreign transaction
        if (pendingForeignTransaction) {
          transactions.push(pendingForeignTransaction as CreditCardTransaction);
          pendingForeignTransaction = null;
        }
        inTransactionSection = false;
        continue;
      }

      // Skip non-transaction content when not in transaction section
      if (!inTransactionSection && !this.isTransactionLine(line)) {
        continue;
      }

      // Check if this is a foreign currency detail line (continuation of previous transaction)
      const foreignDetails = this.parseForeignCurrencyLine(line);
      if (foreignDetails && pendingForeignTransaction) {
        pendingForeignTransaction.foreignAmount = foreignDetails.amount;
        pendingForeignTransaction.foreignCurrency = foreignDetails.currency;
        pendingForeignTransaction.conversionRate = foreignDetails.rate;
        transactions.push(pendingForeignTransaction as CreditCardTransaction);
        pendingForeignTransaction = null;
        continue;
      }

      // Flush any pending foreign transaction before starting a new one
      if (pendingForeignTransaction) {
        transactions.push(pendingForeignTransaction as CreditCardTransaction);
        pendingForeignTransaction = null;
      }

      // Try to parse as a transaction
      const tx = this.parseTransactionLine(line, lineNumber, pdfText);
      if (tx) {
        // Check if this might have foreign currency details on the next line
        if (this.mightHaveForeignDetails(line)) {
          pendingForeignTransaction = tx;
        } else {
          transactions.push(tx);
        }
      }
    }

    // Flush any remaining pending transaction
    if (pendingForeignTransaction) {
      transactions.push(pendingForeignTransaction as CreditCardTransaction);
    }

    return transactions;
  }

  /**
   * Check if line is a transaction section header
   */
  private isTransactionHeaderLine(line: string): boolean {
    return (
      /^\s*Date\s+Transaction\s*/i.test(line) ||
      /^\s*Date\s+Description\s*/i.test(line) ||
      /^\s*Trans\s*Date\s+Description\s*/i.test(line) ||
      /^\s*Transaction\s+Details/i.test(line)
    );
  }

  /**
   * Check if line marks the end of transactions
   */
  private isEndOfTransactionsLine(line: string): boolean {
    return (
      /^\s*Closing\s+Balance/i.test(line) ||
      /^\s*New\s+Balance/i.test(line) ||
      /^\s*Statement\s+Balance/i.test(line) ||
      /^\s*Total\s+/i.test(line) ||
      /^\s*Interest\s+Charges?\s+Summary/i.test(line) ||
      /^\s*Page\s+\d+\s+of\s+\d+/i.test(line) ||
      /^\s*Important\s+Information/i.test(line)
    );
  }

  /**
   * Parse a single transaction line
   */
  private parseTransactionLine(
    line: string,
    lineNumber: number,
    pdfText: string,
  ): CreditCardTransaction | null {
    // CBA credit card formats:
    // DD/MM/YYYY Description Amount
    // DD/MM DD/MM Description Amount (transaction date + posting date)
    // DD MMM Description Amount

    // Try format with separate transaction and posting dates
    // Allow optional CR/DR suffix after amount for credit card payments
    const dualDateMatch = line.match(
      /(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?\s+(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?\s+(.+?)\s+(-?\$?[\d,]+\.\d{2}\s*(?:CR|DR)?)\s*$/i,
    );

    if (dualDateMatch) {
      const [, transDate, postDate, rawDesc, rawAmount] = dualDateMatch;

      // Add year to dates if needed
      // Derive year from statement billing period — never use new Date() for determinism
      const inferYear = (dateStr: string): string => {
        if (!dateStr.includes('/') || dateStr.split('/').length !== 2) {
          return dateStr;
        }
        // Use billing cycle end year from account info if available
        // Parse statement period from the PDF text
        let statementYear: number | null = null;
        for (const pattern of this.config.statementPeriodPatterns || []) {
          const match = pdfText.match(pattern);
          if (match) {
            const endDate = this.parseDate(match[2]);
            if (endDate) {
              statementYear = parseInt(endDate.split('-')[0], 10);
              break;
            }
          }
        }
        if (!statementYear) {
          // Fallback: can't determine year without statement period
          return dateStr;
        }
        return `${dateStr}/${statementYear}`;
      };

      const transDateFull = inferYear(transDate);
      const postDateFull = inferYear(postDate);

      const date = this.parseDate(transDateFull);
      const parsedPostDate = this.parseDate(postDateFull);
      const amount = this.parseAmount(rawAmount);

      if (date && amount !== null) {
        const description = this.cleanDescription(rawDesc);
        const transactionType = this.detectTransactionType(description, amount);

        return {
          date,
          postDate: parsedPostDate || undefined,
          description,
          amount,
          transactionType,
          merchantName: this.extractMerchantName(rawDesc),
          rawDate: transDate,
          rawAmount,
          rawDescription: rawDesc,
          lineNumber,
        };
      }
    }

    // Try standard format: DD/MM/YYYY Description Amount
    const standardMatch = line.match(
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2}\s*(?:CR|DR)?)\s*$/i,
    );

    if (standardMatch) {
      const [, rawDate, rawDesc, rawAmount] = standardMatch;

      const date = this.parseDate(rawDate);
      const amount = this.parseAmount(rawAmount);

      if (date && amount !== null) {
        const description = this.cleanDescription(rawDesc);
        const transactionType = this.detectTransactionType(description, amount);

        return {
          date,
          description,
          amount,
          transactionType,
          merchantName: this.extractMerchantName(rawDesc),
          rawDate,
          rawAmount,
          rawDescription: rawDesc,
          lineNumber,
        };
      }
    }

    // Try format with month name: DD MMM Description Amount
    const monthNameMatch = line.match(
      /(\d{1,2}\s+\w{3}(?:\s+\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2}\s*(?:CR|DR)?)\s*$/i,
    );

    if (monthNameMatch) {
      const [, rawDate, rawDesc, rawAmount] = monthNameMatch;

      const date = this.parseDate(rawDate);
      const amount = this.parseAmount(rawAmount);

      if (date && amount !== null) {
        const description = this.cleanDescription(rawDesc);
        const transactionType = this.detectTransactionType(description, amount);

        return {
          date,
          description,
          amount,
          transactionType,
          merchantName: this.extractMerchantName(rawDesc),
          rawDate,
          rawAmount,
          rawDescription: rawDesc,
          lineNumber,
        };
      }
    }

    return null;
  }

  /**
   * Check if a transaction line might have foreign currency details on next line
   */
  private mightHaveForeignDetails(line: string): boolean {
    // Look for international indicators without foreign amount on same line
    const hasInternationalIndicator =
      /overseas|international|foreign/i.test(line) || /\b[A-Z]{2}\s*(?!AU)$/i.test(line); // Country code at end (not AU)

    const hasForeignAmountOnLine = /[A-Z]{3}\s*[\d,]+\.\d{2}/.test(line);

    return hasInternationalIndicator && !hasForeignAmountOnLine;
  }

  /**
   * Parse foreign currency details from a continuation line
   */
  private parseForeignCurrencyLine(
    line: string,
  ): { amount: number; currency: string; rate?: number } | null {
    // Patterns for foreign currency lines:
    // "USD 123.45 @ 0.7523"
    // "123.45 USD Exchange Rate 0.7523"
    // "Foreign Currency: USD 123.45"

    // Pattern: CURRENCY AMOUNT @ RATE
    const currencyRateMatch = line.match(/([A-Z]{3})\s*([\d,]+\.?\d*)\s*@\s*(\d+\.?\d*)/i);

    if (currencyRateMatch) {
      const [, currency, amount, rate] = currencyRateMatch;
      const parsed = parseForeignAmount(`${currency} ${amount}`);
      const parsedRate = parseConversionRate(rate);

      if (parsed) {
        return {
          amount: parsed.amount,
          currency: parsed.currency,
          rate: parsedRate || undefined,
        };
      }
    }

    // Pattern: AMOUNT CURRENCY (Exchange|Conversion) Rate RATE
    const amountCurrencyMatch = line.match(
      /([\d,]+\.?\d*)\s*([A-Z]{3})\s*(?:Exchange|Conversion)?\s*Rate[\s:]*(\d+\.?\d*)/i,
    );

    if (amountCurrencyMatch) {
      const [, amount, currency, rate] = amountCurrencyMatch;
      const parsed = parseForeignAmount(`${currency} ${amount}`);
      const parsedRate = parseConversionRate(rate);

      if (parsed) {
        return {
          amount: parsed.amount,
          currency: parsed.currency,
          rate: parsedRate || undefined,
        };
      }
    }

    // Pattern: Foreign Currency: CURRENCY AMOUNT
    const foreignCurrencyMatch = line.match(/Foreign\s*Currency[\s:]*([A-Z]{3})\s*([\d,]+\.?\d*)/i);

    if (foreignCurrencyMatch) {
      const [, currency, amount] = foreignCurrencyMatch;
      const parsed = parseForeignAmount(`${currency} ${amount}`);

      if (parsed) {
        return {
          amount: parsed.amount,
          currency: parsed.currency,
        };
      }
    }

    // Simple pattern: CURRENCY AMOUNT
    const simpleForeignMatch = line.match(/^\s*([A-Z]{3})\s*([\d,]+\.?\d*)\s*$/);

    if (simpleForeignMatch) {
      const [, currency, amount] = simpleForeignMatch;
      const parsed = parseForeignAmount(`${currency} ${amount}`);

      if (parsed && parsed.currency !== 'AUD') {
        return {
          amount: parsed.amount,
          currency: parsed.currency,
        };
      }
    }

    return null;
  }

  /**
   * Extract account information from credit card statement
   */
  async extractAccountInfo(pdfText: string): Promise<CreditCardAccountInfo> {
    const info: CreditCardAccountInfo = {
      accountNumber: 'UNKNOWN',
      accountType: 'credit',
    };

    // Extract card number
    for (const pattern of this.config.cardNumberPatterns) {
      const match = pdfText.match(pattern);
      if (match) {
        info.cardNumber = match[1].replace(/\s+/g, ' ').trim();
        // Also use as account number
        info.accountNumber = info.cardNumber.replace(/[\s*]/g, '').slice(-4);
        break;
      }
    }

    // Extract cardholder name
    const cardholderMatch = pdfText.match(
      /(?:Card\s*holder|Account\s*holder|Name)[\s:]*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)/,
    );
    if (cardholderMatch) {
      info.cardHolder = cardholderMatch[1].trim();
    }

    // Detect card type
    if (/visa/i.test(pdfText)) {
      info.cardType = 'Visa';
    } else if (/mastercard|master\s*card/i.test(pdfText)) {
      info.cardType = 'Mastercard';
    } else if (/american\s*express|amex/i.test(pdfText)) {
      info.cardType = 'American Express';
    }

    // Extract credit limit
    if (this.config.creditLimitPattern) {
      const match = pdfText.match(this.config.creditLimitPattern);
      if (match) {
        info.creditLimit = this.parseAmount(match[1]) ?? undefined;
      }
    }

    // Extract available credit
    if (this.config.availableCreditPattern) {
      const match = pdfText.match(this.config.availableCreditPattern);
      if (match) {
        info.availableCredit = this.parseAmount(match[1]) ?? undefined;
      }
    }

    // Extract minimum payment
    if (this.config.minimumPaymentPattern) {
      const match = pdfText.match(this.config.minimumPaymentPattern);
      if (match) {
        info.minimumPaymentDue = this.parseAmount(match[1]) ?? undefined;
      }
    }

    // Extract payment due date
    if (this.config.paymentDueDatePattern) {
      const match = pdfText.match(this.config.paymentDueDatePattern);
      if (match) {
        info.paymentDueDate = this.parseDate(match[1]) || undefined;
      }
    }

    // Extract opening balance (previous statement balance)
    if (this.config.openingBalancePattern) {
      const match = pdfText.match(this.config.openingBalancePattern);
      if (match) {
        info.previousBalance = this.parseAmount(match[1]) ?? undefined;
        info.openingBalance = info.previousBalance;
      }
    }

    // Extract closing balance (current/new balance)
    if (this.config.closingBalancePattern) {
      const match = pdfText.match(this.config.closingBalancePattern);
      if (match) {
        info.currentBalance = this.parseAmount(match[1]) ?? undefined;
        info.closingBalance = info.currentBalance;
      }
    }

    // Extract interest rates
    if (this.config.purchaseAPRPattern) {
      const match = pdfText.match(this.config.purchaseAPRPattern);
      if (match) {
        info.purchaseAPR = parseFloat(match[1]);
      }
    }

    if (this.config.cashAdvanceAPRPattern) {
      const match = pdfText.match(this.config.cashAdvanceAPRPattern);
      if (match) {
        info.cashAdvanceAPR = parseFloat(match[1]);
      }
    }

    // Extract statement/billing period
    for (const pattern of this.config.statementPeriodPatterns || []) {
      const match = pdfText.match(pattern);
      if (match) {
        const startDate = this.parseDate(match[1]);
        const endDate = this.parseDate(match[2]);
        if (startDate && endDate) {
          info.billingCycleStart = startDate;
          info.billingCycleEnd = endDate;
          info.statementPeriod = { start: startDate, end: endDate };

          // Calculate days in billing cycle
          const start = new Date(startDate);
          const end = new Date(endDate);
          info.daysInBillingCycle = Math.round(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
          );
        }
        break;
      }
    }

    // Try to extract billing cycle days if not calculated
    if (!info.daysInBillingCycle) {
      for (const pattern of this.config.billingCyclePatterns || []) {
        const match = pdfText.match(pattern);
        if (match) {
          info.daysInBillingCycle = parseInt(match[1], 10);
          break;
        }
      }
    }

    // Extract statement date
    const statementDateMatch = pdfText.match(/Statement\s*Date[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (statementDateMatch) {
      info.statementDate = this.parseDate(statementDateMatch[1]) || undefined;
    }

    // Extract interest charged
    const interestMatch = pdfText.match(/Interest\s*Charged[\s:]*\$?([\d,]+\.?\d*)/i);
    if (interestMatch) {
      info.interestCharged = this.parseAmount(interestMatch[1]) ?? undefined;
    }

    // Extract fees charged
    const feesMatch = pdfText.match(/(?:Total\s*)?Fees\s*(?:Charged)?[\s:]*\$?([\d,]+\.?\d*)/i);
    if (feesMatch) {
      info.feesCharged = this.parseAmount(feesMatch[1]) ?? undefined;
    }

    // Extract new charges
    const chargesMatch = pdfText.match(/(?:New\s*)?(?:Purchases|Charges)[\s:]*\$?([\d,]+\.?\d*)/i);
    if (chargesMatch) {
      info.newCharges = this.parseAmount(chargesMatch[1]) ?? undefined;
    }

    // Extract payments received
    const paymentsMatch = pdfText.match(
      /Payments?\s*(?:Received|Credits?)[\s:]*\$?([\d,]+\.?\d*)/i,
    );
    if (paymentsMatch) {
      info.paymentsReceived = this.parseAmount(paymentsMatch[1]) ?? undefined;
    }

    // Extract rewards info
    const pointsEarnedMatch = pdfText.match(
      /Points?\s*Earned(?:\s*this\s*(?:statement|period))?[\s:]*(\d+)/i,
    );
    if (pointsEarnedMatch) {
      info.rewardPointsEarned = parseInt(pointsEarnedMatch[1], 10);
    }

    const pointsBalanceMatch = pdfText.match(/(?:Total\s*)?Points?\s*Balance[\s:]*(\d+)/i);
    if (pointsBalanceMatch) {
      info.rewardPointsBalance = parseInt(pointsBalanceMatch[1], 10);
    }

    // Extract cash advance limit
    const cashLimitMatch = pdfText.match(/Cash\s*(?:Advance\s*)?Limit[\s:]*\$?([\d,]+\.?\d*)/i);
    if (cashLimitMatch) {
      info.cashAdvanceLimit = this.parseAmount(cashLimitMatch[1]) ?? undefined;
    }

    // Extract available cash advance
    const availableCashMatch = pdfText.match(
      /Available\s*(?:Cash(?:\s*Advance)?|for\s*Cash)[\s:]*\$?([\d,]+\.?\d*)/i,
    );
    if (availableCashMatch) {
      info.availableCashAdvance = this.parseAmount(availableCashMatch[1]) ?? undefined;
    }

    return info;
  }

  /**
   * Extract merchant name from transaction description
   */
  private extractMerchantName(description: string): string | undefined {
    let cleaned = description;

    // Remove common CBA prefixes
    cleaned = cleaned
      .replace(/^(VISA|EFTPOS|MASTERCARD|DIRECT DEBIT|DIRECT CREDIT|BPAY|TRANSFER)\s*/i, '')
      .replace(/^(Purchase|Withdrawal|Deposit|Refund|Payment)\s*/i, '')
      .replace(/^(Card\s*\d+\s*)/i, '');

    // Remove location suffixes (AU, AUS, state codes)
    cleaned = cleaned.replace(/\s+(AU|AUS|NSW|VIC|QLD|SA|WA|TAS|NT|ACT)$/i, '');
    cleaned = cleaned.replace(/\s+\d{4}$/i, ''); // Postcode

    // Remove country codes for international transactions
    cleaned = cleaned.replace(/\s+[A-Z]{2}$/i, '');

    // Take first meaningful part (before double spaces or tabs)
    const parts = cleaned.split(/\s{2,}|\t/);
    if (parts.length > 0 && parts[0].length > 2) {
      return parts[0].trim();
    }

    return cleaned.trim() || undefined;
  }
}
