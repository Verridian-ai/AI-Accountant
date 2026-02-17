/**
 * QIF Date Format Configurations
 *
 * Date parsing utilities for QIF files supporting US, AU, and common formats.
 */

// ============================================================================
// DATE FORMAT CONFIGURATIONS
// ============================================================================

export interface DateFormatConfig {
  pattern: RegExp;
  parse: (match: RegExpMatchArray) => { day: number; month: number; year: number } | null;
}

/**
 * Expand 2-digit year to 4-digit year
 * Uses 50 as the cutoff: 00-49 = 2000-2049, 50-99 = 1950-1999
 */
export function expandYear(shortYear: number): number {
  if (shortYear >= 100) return shortYear;
  return shortYear > 50 ? 1900 + shortYear : 2000 + shortYear;
}

/**
 * Parse month name to number (1-12)
 */
export function parseMonthName(name: string): number | null {
  const months: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  return months[name.toLowerCase()] || null;
}

/**
 * Supported date formats in QIF files
 * QIF spec allows for various formats depending on locale and software
 *
 * NOTE: US (MM/DD) and AU (DD/MM) formats use the same regex pattern.
 * The parser determines which to use based on:
 * 1. Explicit preference set via setDateFormatPreference()
 * 2. Heuristic analysis of sample transactions (values > 12 indicate day position)
 *
 * The DATE_FORMATS_US and DATE_FORMATS_AU arrays are used based on detected preference.
 */
export const DATE_FORMATS_US: DateFormatConfig[] = [
  // MM/DD/YY or M/D/YY (US format - most common in QIF)
  {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    parse: (match) => ({
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10),
      year: expandYear(parseInt(match[3], 10)),
    }),
  },
  // MM/DD/YYYY or M/D/YYYY
  {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (match) => ({
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10),
      year: parseInt(match[3], 10),
    }),
  },
];

export const DATE_FORMATS_AU: DateFormatConfig[] = [
  // DD/MM/YY or D/M/YY (Australian/European format)
  {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    parse: (match) => ({
      day: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      year: expandYear(parseInt(match[3], 10)),
    }),
  },
  // DD/MM/YYYY or D/M/YYYY
  {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (match) => ({
      day: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      year: parseInt(match[3], 10),
    }),
  },
];

// Common formats that work for both US and AU
export const DATE_FORMATS_COMMON: DateFormatConfig[] = [
  // YYYY-MM-DD (ISO format) - unambiguous
  {
    pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    parse: (match) => ({
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      day: parseInt(match[3], 10),
    }),
  },
  // DD MMM YY or DD MMM YYYY (e.g., "15 Jan 23" or "15 Jan 2023") - unambiguous due to month name
  {
    pattern: /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})$/,
    parse: (match) => {
      const month = parseMonthName(match[2]);
      if (month === null) return null;
      return {
        day: parseInt(match[1], 10),
        month,
        year: match[3].length === 2 ? expandYear(parseInt(match[3], 10)) : parseInt(match[3], 10),
      };
    },
  },
  // MMM DD, YYYY (e.g., "Jan 15, 2023") - unambiguous due to month name
  {
    pattern: /^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/,
    parse: (match) => {
      const month = parseMonthName(match[1]);
      if (month === null) return null;
      return {
        month,
        day: parseInt(match[2], 10),
        year: parseInt(match[3], 10),
      };
    },
  },
  // Quicken special format: M/D'YY (apostrophe before year) - US format
  {
    pattern: /^(\d{1,2})\/(\d{1,2})'(\d{2})$/,
    parse: (match) => ({
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10),
      year: expandYear(parseInt(match[3], 10)),
    }),
  },
  // Another Quicken variant: M/D' Y (space before single digit year) - US format
  {
    pattern: /^(\d{1,2})\/(\d{1,2})'\s*(\d{1,2})$/,
    parse: (match) => ({
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10),
      year: expandYear(parseInt(match[3], 10)),
    }),
  },
];

/**
 * Get date formats array based on locale preference
 * US formats are tried first for 'US' preference, AU formats first for 'AU'
 */
export function getDateFormatsForLocale(locale: 'US' | 'AU'): DateFormatConfig[] {
  if (locale === 'US') {
    return [...DATE_FORMATS_US, ...DATE_FORMATS_COMMON];
  } else {
    return [...DATE_FORMATS_AU, ...DATE_FORMATS_COMMON];
  }
}

/**
 * Validate date components
 */
export function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

/**
 * Format date components to ISO string
 */
export function formatISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
