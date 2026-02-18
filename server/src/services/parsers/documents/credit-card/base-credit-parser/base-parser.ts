/**
 * Abstract base class for credit card statement parsers.
 */

import { parseDate, parseAmount } from '../../../base-parser.js';
import type {
  CreditCardParser,
  CreditCardParserConfig,
  CreditCardDetectionResult,
  CreditCardTransaction,
  CreditCardAccountInfo,
  CreditCardStatementParseResult,
  CreditCardTransactionType,
} from './types.js';

export abstract class BaseCreditCardParser implements CreditCardParser {
  abstract config: CreditCardParserConfig;

  /**
   * Detect if this parser can handle the PDF text
   */
  detect(pdfText: string): CreditCardDetectionResult {
    const matchedPatterns: string[] = [];
    let matchCount = 0;

    // Test each header pattern
    for (const pattern of this.config.headerPatterns) {
      if (pattern.test(pdfText)) {
        matchedPatterns.push(pattern.source);
        matchCount++;
      }
    }

    // Calculate base confidence
    const baseConfidence =
      matchCount >= this.config.minHeaderMatches
        ? Math.min(1, matchCount / this.config.headerPatterns.length + 0.3)
        : matchCount / this.config.headerPatterns.length;

    // Check for credit card indicators
    let creditCardMatches = 0;
    for (const pattern of this.config.creditCardIndicators) {
      if (pattern.test(pdfText)) {
        creditCardMatches++;
      }
    }

    const creditCardConfidence =
      this.config.creditCardIndicators.length > 0
        ? creditCardMatches / this.config.creditCardIndicators.length
        : 0;

    const isCreditCardStatement = creditCardConfidence >= 0.5;

    // Detect card type
    let detectedCardType: string | undefined;
    if (/visa/i.test(pdfText)) {
      detectedCardType = 'Visa';
    } else if (/mastercard|master\s*card/i.test(pdfText)) {
      detectedCardType = 'Mastercard';
    } else if (/american\s*express|amex/i.test(pdfText)) {
      detectedCardType = 'American Express';
    } else if (/diners\s*club/i.test(pdfText)) {
      detectedCardType = 'Diners Club';
    }

    return {
      bankId: this.config.bankId,
      bankName: this.config.bankName,
      confidence: baseConfidence,
      matchedPatterns,
      isCreditCardStatement,
      creditCardConfidence,
      detectedCardType,
      suggestedParser: `${this.config.bankId}-credit`,
    };
  }

  /**
   * Parse transactions - must be implemented by subclass
   */
  abstract parseTransactions(pdfText: string): Promise<CreditCardTransaction[]>;

  /**
   * Extract account info - must be implemented by subclass
   */
  abstract extractAccountInfo(pdfText: string): Promise<CreditCardAccountInfo>;

  /**
   * Full parse combining detection, account info, and transactions
   */
  async parse(pdfText: string): Promise<CreditCardStatementParseResult> {
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

      if (!accountInfo.cardNumber) {
        warnings.push('Could not extract card number');
      }

      // Calculate summary totals
      let totalPurchases = 0;
      let totalCashAdvances = 0;
      let totalInterestCharges = 0;
      let totalFees = 0;
      let totalPayments = 0;
      let totalCredits = 0;
      let foreignTransactionCount = 0;
      let foreignTransactionTotal = 0;

      for (const tx of transactions) {
        switch (tx.transactionType) {
          case 'purchase':
            totalPurchases += Math.abs(tx.amount);
            break;
          case 'cash_advance':
            totalCashAdvances += Math.abs(tx.amount);
            break;
          case 'interest':
            totalInterestCharges += Math.abs(tx.amount);
            break;
          case 'fee':
            totalFees += Math.abs(tx.amount);
            break;
          case 'payment':
          case 'refund':
            totalPayments += Math.abs(tx.amount);
            totalCredits += Math.abs(tx.amount);
            break;
        }

        if (tx.foreignAmount) {
          foreignTransactionCount++;
          foreignTransactionTotal += Math.abs(tx.foreignAmount);
        }
      }

      return {
        success: errors.length === 0,
        bankId: this.config.bankId,
        bankName: this.config.bankName,
        accountInfo,
        transactions,
        parseWarnings: warnings,
        parseErrors: errors,
        totalPurchases,
        totalCashAdvances,
        totalInterestCharges,
        totalFees,
        totalPayments,
        totalCredits,
        foreignTransactionCount: foreignTransactionCount > 0 ? foreignTransactionCount : undefined,
        foreignTransactionTotal: foreignTransactionTotal > 0 ? foreignTransactionTotal : undefined,
        detectionConfidence: detection.confidence,
        parserUsed: `${this.config.bankId}-credit`,
        processingTimeMs: Date.now() - startTime,
        isCreditCardStatement: true,
      };
    } catch (err) {
      return {
        success: false,
        bankId: this.config.bankId,
        bankName: this.config.bankName,
        accountInfo: this.getDefaultAccountInfo(),
        transactions: [],
        parseWarnings: warnings,
        parseErrors: [`Parse failed: ${err instanceof Error ? err.message : String(err)}`],
        detectionConfidence: detection.confidence,
        parserUsed: `${this.config.bankId}-credit`,
        processingTimeMs: Date.now() - startTime,
        isCreditCardStatement: true,
      };
    }
  }

  /**
   * Get default account info when extraction fails
   */
  protected getDefaultAccountInfo(): CreditCardAccountInfo {
    return {
      accountNumber: 'UNKNOWN',
      accountType: 'credit',
    };
  }

  /**
   * Determine transaction type from description
   */
  protected detectTransactionType(description: string, amount: number): CreditCardTransactionType {
    const desc = description.toLowerCase();

    // Check configured patterns first
    for (const [type, patterns] of Object.entries(this.config.transactionTypePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(description)) {
          return type as CreditCardTransactionType;
        }
      }
    }

    // Fallback detection based on common keywords
    if (/interest\s*(charge|fee)?/i.test(desc) || /finance\s*charge/i.test(desc)) {
      return 'interest';
    }

    if (/cash\s*advance/i.test(desc) || /atm\s*withdrawal/i.test(desc)) {
      return 'cash_advance';
    }

    if (/\b(fee|charge)\b/i.test(desc) && !/purchase/i.test(desc)) {
      if (/annual|membership|late|over.?limit|foreign/i.test(desc)) {
        return 'fee';
      }
    }

    if (/payment\s*(received|thank|credited)?/i.test(desc) || /^payment\s*-/i.test(desc)) {
      return 'payment';
    }

    if (/refund|credit|reversal|chargeback/i.test(desc)) {
      return 'refund';
    }

    if (/balance\s*transfer/i.test(desc)) {
      return 'balance_transfer';
    }

    if (/reward|points|cashback|bonus/i.test(desc)) {
      return 'reward';
    }

    if (/adjustment|correction/i.test(desc)) {
      return 'adjustment';
    }

    // Payments are typically negative (credits to the account)
    if (amount < 0) {
      return 'payment';
    }

    // Default to purchase for positive amounts
    return 'purchase';
  }

  /**
   * Check if a transaction is a foreign transaction
   */
  protected isForeignTransaction(line: string): boolean {
    for (const pattern of this.config.foreignTransactionPatterns) {
      if (pattern.test(line)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract text between two patterns
   */
  protected extractBetween(text: string, startPattern: RegExp, endPattern: RegExp): string | null {
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
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
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
   * Check if a line looks like a credit card transaction
   */
  protected isTransactionLine(line: string): boolean {
    // Must contain a date-like pattern and an amount-like pattern
    const hasDate = /\d{1,2}[/\-\s]\w{2,3}[/\-\s]?\d{2,4}/.test(line);
    const hasAmount = /\$?\d+[,.]?\d*\.?\d{2}/.test(line);
    return hasDate && hasAmount;
  }

  /**
   * Parse date using configured formats
   */
  protected parseDate(dateStr: string): string | null {
    return parseDate(dateStr, this.config.dateFormats);
  }

  /**
   * Parse amount to cents
   */
  protected parseAmount(amountStr: string): number | null {
    return parseAmount(amountStr);
  }
}

// Re-export utility functions so subclasses can access them via this module
export { parseDate, parseAmount };
