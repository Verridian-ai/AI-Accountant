/**
 * Credit Card Transaction Type Detection
 *
 * Logic for determining the type of a credit card transaction
 * based on its description and amount.
 */

import type { CreditCardTransactionType, CreditCardParserConfig } from './credit-card-types.js';

/**
 * Determine transaction type from description and amount
 */
export function detectTransactionType(
  description: string,
  amount: number,
  config: CreditCardParserConfig,
): CreditCardTransactionType {
  const desc = description.toLowerCase();

  // Check configured patterns first
  for (const [type, patterns] of Object.entries(config.transactionTypePatterns)) {
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
