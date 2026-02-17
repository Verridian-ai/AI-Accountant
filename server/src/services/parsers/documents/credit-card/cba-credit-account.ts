/**
 * CBA Credit Card Account Info Extraction
 *
 * Extracts account information from CBA credit card statement PDFs,
 * including card details, balances, interest rates, and rewards.
 */

import type { CreditCardAccountInfo, CreditCardParserConfig } from './credit-card-types.js';

/**
 * Extract account information from CBA credit card statement text
 */
export async function extractCBAAccountInfo(
  pdfText: string,
  config: CreditCardParserConfig,
  parseDateFn: (dateStr: string) => string | null,
  parseAmountFn: (amountStr: string) => number | null,
): Promise<CreditCardAccountInfo> {
  const info: CreditCardAccountInfo = {
    accountNumber: 'UNKNOWN',
    accountType: 'credit',
  };

  // Extract card number
  for (const pattern of config.cardNumberPatterns) {
    const match = pdfText.match(pattern);
    if (match) {
      info.cardNumber = match[1].replace(/\s+/g, ' ').trim();
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

  // Extract financial details using config patterns
  extractFinancialDetails(info, pdfText, config, parseDateFn, parseAmountFn);

  // Extract statement period
  extractStatementPeriod(info, pdfText, config, parseDateFn);

  // Extract additional details
  extractAdditionalDetails(info, pdfText, parseAmountFn);

  return info;
}

function extractFinancialDetails(
  info: CreditCardAccountInfo,
  pdfText: string,
  config: CreditCardParserConfig,
  parseDateFn: (dateStr: string) => string | null,
  parseAmountFn: (amountStr: string) => number | null,
): void {
  if (config.creditLimitPattern) {
    const match = pdfText.match(config.creditLimitPattern);
    if (match) info.creditLimit = parseAmountFn(match[1]) ?? undefined;
  }

  if (config.availableCreditPattern) {
    const match = pdfText.match(config.availableCreditPattern);
    if (match) info.availableCredit = parseAmountFn(match[1]) ?? undefined;
  }

  if (config.minimumPaymentPattern) {
    const match = pdfText.match(config.minimumPaymentPattern);
    if (match) info.minimumPaymentDue = parseAmountFn(match[1]) ?? undefined;
  }

  if (config.paymentDueDatePattern) {
    const match = pdfText.match(config.paymentDueDatePattern);
    if (match) info.paymentDueDate = parseDateFn(match[1]) || undefined;
  }

  if (config.openingBalancePattern) {
    const match = pdfText.match(config.openingBalancePattern);
    if (match) {
      info.previousBalance = parseAmountFn(match[1]) ?? undefined;
      info.openingBalance = info.previousBalance;
    }
  }

  if (config.closingBalancePattern) {
    const match = pdfText.match(config.closingBalancePattern);
    if (match) {
      info.currentBalance = parseAmountFn(match[1]) ?? undefined;
      info.closingBalance = info.currentBalance;
    }
  }

  if (config.purchaseAPRPattern) {
    const match = pdfText.match(config.purchaseAPRPattern);
    if (match) info.purchaseAPR = parseFloat(match[1]);
  }

  if (config.cashAdvanceAPRPattern) {
    const match = pdfText.match(config.cashAdvanceAPRPattern);
    if (match) info.cashAdvanceAPR = parseFloat(match[1]);
  }
}

function extractStatementPeriod(
  info: CreditCardAccountInfo,
  pdfText: string,
  config: CreditCardParserConfig,
  parseDateFn: (dateStr: string) => string | null,
): void {
  for (const pattern of config.statementPeriodPatterns || []) {
    const match = pdfText.match(pattern);
    if (match) {
      const startDate = parseDateFn(match[1]);
      const endDate = parseDateFn(match[2]);
      if (startDate && endDate) {
        info.billingCycleStart = startDate;
        info.billingCycleEnd = endDate;
        info.statementPeriod = { start: startDate, end: endDate };

        const start = new Date(startDate);
        const end = new Date(endDate);
        info.daysInBillingCycle = Math.round(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        );
      }
      break;
    }
  }

  if (!info.daysInBillingCycle) {
    for (const pattern of config.billingCyclePatterns || []) {
      const match = pdfText.match(pattern);
      if (match) {
        info.daysInBillingCycle = parseInt(match[1], 10);
        break;
      }
    }
  }

  const statementDateMatch = pdfText.match(/Statement\s*Date[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (statementDateMatch) {
    info.statementDate = parseDateFn(statementDateMatch[1]) || undefined;
  }
}

function extractAdditionalDetails(
  info: CreditCardAccountInfo,
  pdfText: string,
  parseAmountFn: (amountStr: string) => number | null,
): void {
  const interestMatch = pdfText.match(/Interest\s*Charged[\s:]*\$?([\d,]+\.?\d*)/i);
  if (interestMatch) info.interestCharged = parseAmountFn(interestMatch[1]) ?? undefined;

  const feesMatch = pdfText.match(/(?:Total\s*)?Fees\s*(?:Charged)?[\s:]*\$?([\d,]+\.?\d*)/i);
  if (feesMatch) info.feesCharged = parseAmountFn(feesMatch[1]) ?? undefined;

  const chargesMatch = pdfText.match(/(?:New\s*)?(?:Purchases|Charges)[\s:]*\$?([\d,]+\.?\d*)/i);
  if (chargesMatch) info.newCharges = parseAmountFn(chargesMatch[1]) ?? undefined;

  const paymentsMatch = pdfText.match(/Payments?\s*(?:Received|Credits?)[\s:]*\$?([\d,]+\.?\d*)/i);
  if (paymentsMatch) info.paymentsReceived = parseAmountFn(paymentsMatch[1]) ?? undefined;

  const pointsEarnedMatch = pdfText.match(
    /Points?\s*Earned(?:\s*this\s*(?:statement|period))?[\s:]*(\d+)/i,
  );
  if (pointsEarnedMatch) info.rewardPointsEarned = parseInt(pointsEarnedMatch[1], 10);

  const pointsBalanceMatch = pdfText.match(/(?:Total\s*)?Points?\s*Balance[\s:]*(\d+)/i);
  if (pointsBalanceMatch) info.rewardPointsBalance = parseInt(pointsBalanceMatch[1], 10);

  const cashLimitMatch = pdfText.match(/Cash\s*(?:Advance\s*)?Limit[\s:]*\$?([\d,]+\.?\d*)/i);
  if (cashLimitMatch) info.cashAdvanceLimit = parseAmountFn(cashLimitMatch[1]) ?? undefined;

  const availableCashMatch = pdfText.match(
    /Available\s*(?:Cash(?:\s*Advance)?|for\s*Cash)[\s:]*\$?([\d,]+\.?\d*)/i,
  );
  if (availableCashMatch) {
    info.availableCashAdvance = parseAmountFn(availableCashMatch[1]) ?? undefined;
  }
}
