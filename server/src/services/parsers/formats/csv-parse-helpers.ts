/**
 * CSV Parser Helpers
 *
 * Date parsing, amount parsing, and description cleaning
 * utilities for the CSV statement parser.
 */

import type { BankCSVConfig } from './csv-bank-configs.js';

/**
 * Parse amount string to cents
 */
export function parseCSVAmount(amountStr: string, config: BankCSVConfig): number {
  if (!amountStr || amountStr.trim() === '') {
    return 0;
  }

  // Remove currency symbols and thousands separators
  let cleaned = amountStr.replace(/[$ ]/g, '').replace(/,/g, '').trim();

  // Handle parentheses for negative (accounting format)
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) {
    cleaned = cleaned.slice(1, -1);
  }

  // Handle explicit negative sign
  const hasNegativeSign = cleaned.startsWith('-');
  if (hasNegativeSign) {
    cleaned = cleaned.slice(1);
  }

  // Parse as float and convert to cents
  const value = parseFloat(cleaned);
  if (isNaN(value)) {
    return 0;
  }

  let cents = Math.round(value * config.amountMultiplier);

  if (isNegative || hasNegativeSign) {
    cents = -cents;
  }

  return cents;
}

/**
 * Parse date string using multiple formats
 */
export function parseCSVDate(dateStr: string, formats: string[]): string | null {
  const cleaned = dateStr.trim();

  for (const format of formats) {
    const parsed = parseDateWithFormat(cleaned, format);
    if (parsed) {
      return parsed;
    }
  }

  // Try native Date parsing as fallback
  const nativeDate = new Date(cleaned);
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parse date with a specific format
 */
function parseDateWithFormat(dateStr: string, format: string): string | null {
  const formatParts = format.split(/[/-]/);
  const dateParts = dateStr.split(/[/-]/);

  if (formatParts.length !== dateParts.length) {
    return null;
  }

  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  for (let i = 0; i < formatParts.length; i++) {
    const formatPart = formatParts[i].toUpperCase();
    const datePart = dateParts[i];

    if (formatPart.includes('D')) {
      day = parseInt(datePart, 10);
    } else if (formatPart === 'MMM') {
      month = parseMonthAbbreviation(datePart);
    } else if (formatPart.includes('M')) {
      month = parseInt(datePart, 10);
    } else if (formatPart.includes('Y')) {
      year = parseInt(datePart, 10);
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }
    }
  }

  if (day === null || month === null || year === null) {
    return null;
  }

  // Validate date
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse month abbreviation (Jan, Feb, etc.)
 */
function parseMonthAbbreviation(abbrev: string): number | null {
  const months: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  return months[abbrev.toLowerCase().slice(0, 3)] || null;
}

/**
 * Clean up transaction description
 */
export function cleanCSVDescription(description: string): string {
  return description
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/^\d{2}\/\d{2}\s*/, '') // Remove leading date
    .replace(/Card xx\d{4}/i, '') // Remove card numbers
    .replace(/Value Date:.*$/i, '') // Remove value date suffix
    .trim();
}
