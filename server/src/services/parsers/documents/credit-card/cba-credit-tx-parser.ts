/**
 * CBA Credit Card Transaction Line Parsing
 *
 * Handles parsing individual transaction lines from CBA credit card statements,
 * including dual-date formats, standard formats, and month-name formats.
 */

import type { CreditCardTransaction, CreditCardParserConfig } from './credit-card-types.js';
import { parseForeignAmount, parseConversionRate } from './credit-card-utils.js';

/**
 * Parse a single CBA credit card transaction line
 */
export function parseTransactionLine(
  line: string,
  lineNumber: number,
  pdfText: string,
  config: CreditCardParserConfig,
  parseDateFn: (dateStr: string) => string | null,
  parseAmountFn: (amountStr: string) => number | null,
  cleanDescFn: (desc: string) => string,
  detectTypeFn: (description: string, amount: number) => CreditCardTransaction['transactionType'],
  extractMerchantFn: (rawDesc: string) => string | undefined,
): CreditCardTransaction | null {
  // Try format with separate transaction and posting dates
  const dualDateMatch = line.match(
    /(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?\s+(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?\s+(.+?)\s+(-?\$?[\d,]+\.\d{2}\s*(?:CR|DR)?)\s*$/i,
  );

  if (dualDateMatch) {
    return parseDualDateTransaction(
      dualDateMatch,
      lineNumber,
      pdfText,
      config,
      parseDateFn,
      parseAmountFn,
      cleanDescFn,
      detectTypeFn,
      extractMerchantFn,
    );
  }

  // Try standard format: DD/MM/YYYY Description Amount
  const standardMatch = line.match(
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2}\s*(?:CR|DR)?)\s*$/i,
  );

  if (standardMatch) {
    return parseStandardTransaction(
      standardMatch,
      lineNumber,
      parseDateFn,
      parseAmountFn,
      cleanDescFn,
      detectTypeFn,
      extractMerchantFn,
    );
  }

  // Try format with month name: DD MMM Description Amount
  const monthNameMatch = line.match(
    /(\d{1,2}\s+\w{3}(?:\s+\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2}\s*(?:CR|DR)?)\s*$/i,
  );

  if (monthNameMatch) {
    return parseStandardTransaction(
      monthNameMatch,
      lineNumber,
      parseDateFn,
      parseAmountFn,
      cleanDescFn,
      detectTypeFn,
      extractMerchantFn,
    );
  }

  return null;
}

function parseDualDateTransaction(
  match: RegExpMatchArray,
  lineNumber: number,
  pdfText: string,
  config: CreditCardParserConfig,
  parseDateFn: (dateStr: string) => string | null,
  parseAmountFn: (amountStr: string) => number | null,
  cleanDescFn: (desc: string) => string,
  detectTypeFn: (description: string, amount: number) => CreditCardTransaction['transactionType'],
  extractMerchantFn: (rawDesc: string) => string | undefined,
): CreditCardTransaction | null {
  const [, transDate, postDate, rawDesc, rawAmount] = match;

  const inferYear = (dateStr: string): string => {
    if (!dateStr.includes('/') || dateStr.split('/').length !== 2) {
      return dateStr;
    }
    let statementYear: number | null = null;
    for (const pattern of config.statementPeriodPatterns || []) {
      const m = pdfText.match(pattern);
      if (m) {
        const endDate = parseDateFn(m[2]);
        if (endDate) {
          statementYear = parseInt(endDate.split('-')[0], 10);
          break;
        }
      }
    }
    if (!statementYear) {
      return dateStr;
    }
    return `${dateStr}/${statementYear}`;
  };

  const transDateFull = inferYear(transDate);
  const postDateFull = inferYear(postDate);

  const date = parseDateFn(transDateFull);
  const parsedPostDate = parseDateFn(postDateFull);
  const amount = parseAmountFn(rawAmount);

  if (date && amount !== null) {
    const description = cleanDescFn(rawDesc);
    const transactionType = detectTypeFn(description, amount);

    return {
      date,
      postDate: parsedPostDate || undefined,
      description,
      amount,
      transactionType,
      merchantName: extractMerchantFn(rawDesc),
      rawDate: transDate,
      rawAmount,
      rawDescription: rawDesc,
      lineNumber,
    };
  }

  return null;
}

function parseStandardTransaction(
  match: RegExpMatchArray,
  lineNumber: number,
  parseDateFn: (dateStr: string) => string | null,
  parseAmountFn: (amountStr: string) => number | null,
  cleanDescFn: (desc: string) => string,
  detectTypeFn: (description: string, amount: number) => CreditCardTransaction['transactionType'],
  extractMerchantFn: (rawDesc: string) => string | undefined,
): CreditCardTransaction | null {
  const [, rawDate, rawDesc, rawAmount] = match;

  const date = parseDateFn(rawDate);
  const amount = parseAmountFn(rawAmount);

  if (date && amount !== null) {
    const description = cleanDescFn(rawDesc);
    const transactionType = detectTypeFn(description, amount);

    return {
      date,
      description,
      amount,
      transactionType,
      merchantName: extractMerchantFn(rawDesc),
      rawDate,
      rawAmount,
      rawDescription: rawDesc,
      lineNumber,
    };
  }

  return null;
}

/**
 * Check if a transaction line might have foreign currency details on next line
 */
export function mightHaveForeignDetails(line: string): boolean {
  const hasInternationalIndicator =
    /overseas|international|foreign/i.test(line) || /\b[A-Z]{2}\s*(?!AU)$/i.test(line);

  const hasForeignAmountOnLine = /[A-Z]{3}\s*[\d,]+\.\d{2}/.test(line);

  return hasInternationalIndicator && !hasForeignAmountOnLine;
}

/**
 * Parse foreign currency details from a continuation line
 */
export function parseForeignCurrencyLine(
  line: string,
): { amount: number; currency: string; rate?: number } | null {
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
