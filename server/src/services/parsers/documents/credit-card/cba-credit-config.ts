/**
 * CBA Credit Card Parser Configuration
 *
 * Configuration constants for the Commonwealth Bank credit card statement parser.
 */

import { CreditCardParserConfig } from './base-credit-parser';

/**
 * CBA Credit Card Parser Configuration
 */
export const CBA_CREDIT_CONFIG: CreditCardParserConfig = {
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
