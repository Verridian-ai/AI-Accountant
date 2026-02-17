/**
 * SBR Helper / Utility Functions
 *
 * Shared formatting, escaping, and calculation helpers used across SBR modules.
 */

import type { BASData } from './types.js';

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format ABN with spaces
 */
export function formatABN(abn: string): string {
  const clean = abn.replace(/\s/g, '');
  if (clean.length !== 11) return clean;
  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
}

/**
 * Convert cents to whole dollars (rounded)
 */
export function centsToWholeNumber(cents: number): number {
  return Math.round(cents / 100);
}

/**
 * Format currency for display
 */
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format currency for CSV
 */
export function formatCurrencyCSV(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Format currency for report (right-aligned)
 */
export function formatCurrencyReport(cents: number): string {
  const formatted = `$${Math.abs(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sign = cents < 0 ? '-' : ' ';
  return `${sign}${formatted}`.padStart(15);
}

// ============================================================================
// ESCAPING HELPERS
// ============================================================================

/**
 * Escape XML special characters and control characters
 * Prevents XML injection attacks by sanitizing all user-provided content
 */
export function escapeXml(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }

  return (
    str
      // Remove null bytes and other control characters (except tab, newline, carriage return)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Escape XML entities (order matters: & must be first)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // Remove or escape any CDATA section attempts
      .replace(/\]\]>/g, ']]&gt;')
      // Remove XML declaration attempts
      .replace(/<\?xml/gi, '&lt;?xml')
      // Remove DOCTYPE attempts
      .replace(/<!DOCTYPE/gi, '&lt;!DOCTYPE')
      // Remove entity declaration attempts
      .replace(/<!ENTITY/gi, '&lt;!ENTITY')
  );
}

/**
 * Escape CSV value
 */
export function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Validate date string
 */
export function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculate derived values for BAS
 */
export function calculateDerivedValues(basData: BASData): BASData {
  const g = { ...basData.gstLabels };

  // Calculate G5 if not provided
  if (g.G5 === undefined) {
    g.G5 = (g.G2 || 0) + (g.G3 || 0) + (g.G4 || 0);
  }

  // Calculate G6 if not provided
  if (g.G6 === undefined && g.G1 !== undefined) {
    g.G6 = g.G1 - g.G5;
  }

  // Calculate G8 if not provided
  if (g.G8 === undefined && g.G6 !== undefined) {
    g.G8 = g.G6 + (g.G7 || 0);
  }

  // Calculate G9 (GST on sales)
  if (g.G9 === undefined && g.G8 !== undefined) {
    g.G9 = Math.round(g.G8 / 11);
  }

  // Calculate G12
  if (g.G12 === undefined) {
    g.G12 = (g.G10 || 0) + (g.G11 || 0);
  }

  // Calculate G16
  if (g.G16 === undefined) {
    g.G16 = g.G12 - (g.G13 || 0) - (g.G14 || 0) - (g.G15 || 0);
  }

  // Calculate G18
  if (g.G18 === undefined) {
    g.G18 = g.G16 + (g.G17 || 0);
  }

  // Calculate G19 (GST on purchases)
  if (g.G19 === undefined && g.G18 !== undefined) {
    g.G19 = Math.round(g.G18 / 11);
  }

  // Calculate G20 (Net GST)
  if (g.G20 === undefined && g.G9 !== undefined && g.G19 !== undefined) {
    g.G20 = g.G9 - g.G19;
  }

  return {
    ...basData,
    gstLabels: g,
  };
}

// ============================================================================
// STANDALONE UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate ABN (Australian Business Number)
 * Uses the official ATO algorithm
 */
export function validateABN(abn: string): boolean {
  const clean = abn.replace(/\s/g, '');

  if (!/^\d{11}$/.test(clean)) {
    return false;
  }

  // ATO ABN validation algorithm
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = clean.split('').map(Number);

  // Subtract 1 from first digit
  digits[0] -= 1;

  // Calculate weighted sum
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }

  // Valid if divisible by 89
  return sum % 89 === 0;
}

/**
 * Validate ACN (Australian Company Number)
 * Uses the official ASIC modulus 10 algorithm
 *
 * The ACN is a 9-digit number where the 9th digit is a check digit.
 * Algorithm:
 * 1. Multiply each of the first 8 digits by its weighting factor (8,7,6,5,4,3,2,1)
 * 2. Sum the products
 * 3. Divide by 10 and get remainder
 * 4. Complement of remainder (10 - remainder) mod 10 = check digit
 * 5. Compare calculated check digit with the 9th digit
 *
 * @see https://asic.gov.au/for-business/registering-a-company/steps-to-register-a-company/australian-company-numbers/
 */
export function validateACN(acn: string): boolean {
  const clean = acn.replace(/\s/g, '');

  if (!/^\d{9}$/.test(clean)) {
    return false;
  }

  // Weights for first 8 digits only (check digit is 9th)
  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  const digits = clean.split('').map(Number);

  // Calculate weighted sum of first 8 digits
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }

  // Calculate check digit: complement of (sum mod 10)
  const remainder = sum % 10;
  const expectedCheckDigit = (10 - remainder) % 10;

  // Compare with the actual 9th digit (index 8)
  return digits[8] === expectedCheckDigit;
}

/**
 * Format amount in cents to ATO currency format (whole dollars, no cents)
 */
export function formatATOAmount(cents: number): string {
  const dollars = Math.round(cents / 100);
  return dollars.toString();
}

/**
 * Parse ATO amount (whole dollars) to cents
 */
export function parseATOAmount(dollars: string | number): number {
  const num = typeof dollars === 'string' ? parseInt(dollars, 10) : dollars;
  return num * 100;
}
