/**
 * Parser Utility Functions
 *
 * Date and amount parsing utilities shared across all bank parsers.
 */

/**
 * Parse a date string using multiple formats
 */
export function parseDate(dateStr: string, formats: string[]): string | null {
  const cleanDate = dateStr.trim();

  for (const format of formats) {
    const parsed = parseDateWithFormat(cleanDate, format);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

/**
 * Parse date with a specific format
 */
function parseDateWithFormat(dateStr: string, format: string): string | null {
  const monthNames: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };

  try {
    if (format === 'DD/MM/YYYY') {
      const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const [, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    if (format === 'DD/MM/YY') {
      const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/);
      if (match) {
        const [, day, month, yearShort] = match;
        const year = parseInt(yearShort, 10) > 50 ? `19${yearShort}` : `20${yearShort}`;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    if (format === 'DD MMM YYYY') {
      const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/i);
      if (match) {
        const [, day, monthStr, year] = match;
        const month = monthNames[monthStr.toLowerCase()];
        if (month) {
          return `${year}-${month}-${day.padStart(2, '0')}`;
        }
      }
    }

    if (format === 'DD MMM YY') {
      const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{2})/i);
      if (match) {
        const [, day, monthStr, yearShort] = match;
        const month = monthNames[monthStr.toLowerCase()];
        if (month) {
          const year = parseInt(yearShort, 10) > 50 ? `19${yearShort}` : `20${yearShort}`;
          return `${year}-${month}-${day.padStart(2, '0')}`;
        }
      }
    }

    if (format === 'YYYY-MM-DD') {
      const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return dateStr;
      }
    }

    if (format === 'DD-MM-YYYY') {
      const match = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
      if (match) {
        const [, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Parse an amount string to cents
 */
export function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;

  // Remove currency symbols, commas, spaces
  let cleaned = amountStr.replace(/[$,\s]/g, '').trim();

  // Handle CR/DR suffixes
  let multiplier = 1;
  if (/CR$/i.test(cleaned)) {
    cleaned = cleaned.replace(/CR$/i, '');
    multiplier = 1; // Credit is positive
  } else if (/DR$/i.test(cleaned)) {
    cleaned = cleaned.replace(/DR$/i, '');
    multiplier = -1; // Debit is negative
  }

  // Handle parentheses for negative
  if (/^\(.*\)$/.test(cleaned)) {
    cleaned = cleaned.replace(/[()]/g, '');
    multiplier = -1;
  }

  // Handle leading minus
  if (cleaned.startsWith('-')) {
    cleaned = cleaned.substring(1);
    multiplier = -1;
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  // Convert to cents
  return Math.round(parsed * 100) * multiplier;
}
