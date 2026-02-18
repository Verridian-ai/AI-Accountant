/**
 * Parse a foreign currency amount string
 * Returns amount in minor units (e.g., cents)
 */
export function parseForeignAmount(amountStr: string): { amount: number; currency: string } | null {
  if (!amountStr) return null;

  // Common patterns:
  // USD 123.45
  // 123.45 USD
  // $123.45 USD
  // US$123.45
  // EUR 99,50
  // 99.50 EUR

  const currencySymbols: Record<string, string> = {
    $: 'USD',
    US$: 'USD',
    A$: 'AUD',
    AU$: 'AUD',
    '\u20AC': 'EUR', // Euro symbol
    '\u00A3': 'GBP', // Pound symbol
    '\u00A5': 'JPY', // Yen symbol
    NZ$: 'NZD',
    S$: 'SGD',
    HK$: 'HKD',
    C$: 'CAD',
  };

  const cleaned = amountStr.trim();

  // Try pattern: CURRENCY_CODE AMOUNT (e.g., "USD 123.45")
  const codeFirstMatch = cleaned.match(/^([A-Z]{3})\s*(-?[\d,]+\.?\d*)$/);
  if (codeFirstMatch) {
    const [, currency, amount] = codeFirstMatch;
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (!isNaN(parsed)) {
      return { amount: Math.round(parsed * 100), currency };
    }
  }

  // Try pattern: AMOUNT CURRENCY_CODE (e.g., "123.45 USD")
  const codeLastMatch = cleaned.match(/^(-?[\d,]+\.?\d*)\s*([A-Z]{3})$/);
  if (codeLastMatch) {
    const [, amount, currency] = codeLastMatch;
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (!isNaN(parsed)) {
      return { amount: Math.round(parsed * 100), currency };
    }
  }

  // Try pattern with symbol: SYMBOL AMOUNT (e.g., "US$123.45")
  for (const [symbol, currency] of Object.entries(currencySymbols)) {
    if (cleaned.startsWith(symbol)) {
      const amount = cleaned.substring(symbol.length).replace(/,/g, '').trim();
      const parsed = parseFloat(amount);
      if (!isNaN(parsed)) {
        return { amount: Math.round(parsed * 100), currency };
      }
    }
  }

  return null;
}

/**
 * Parse a conversion rate from text
 */
export function parseConversionRate(rateStr: string): number | null {
  if (!rateStr) return null;

  // Common patterns:
  // 0.7523
  // 1 AUD = 0.7523 USD
  // Rate: 0.7523
  // @0.7523

  const cleaned = rateStr.trim();

  // Direct number
  const directMatch = cleaned.match(/^@?(\d+\.?\d*)$/);
  if (directMatch) {
    const rate = parseFloat(directMatch[1]);
    if (!isNaN(rate) && rate > 0) {
      return rate;
    }
  }

  // Pattern: X CURRENCY = Y CURRENCY
  const equationMatch = cleaned.match(/\d+\.?\d*\s*[A-Z]{3}\s*=\s*(\d+\.?\d*)\s*[A-Z]{3}/);
  if (equationMatch) {
    const rate = parseFloat(equationMatch[1]);
    if (!isNaN(rate) && rate > 0) {
      return rate;
    }
  }

  // Pattern: Rate: X.XXXX
  const rateMatch = cleaned.match(/rate[:\s]+(\d+\.?\d*)/i);
  if (rateMatch) {
    const rate = parseFloat(rateMatch[1]);
    if (!isNaN(rate) && rate > 0) {
      return rate;
    }
  }

  return null;
}
