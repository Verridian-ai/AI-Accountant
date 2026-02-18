/**
 * Data Masking Utilities
 * Masks sensitive Australian financial identifiers for display purposes.
 */

/**
 * Mask a TFN for display (Australian format).
 * Input: '123456789' -> Output: '***-***-**9'
 *
 * @param tfn - Decrypted TFN (9 digits)
 * @returns Masked string showing only last digit
 */
export function maskTFN(tfn: string): string {
  if (!tfn || tfn.length < 3) return '***';
  const lastChar = tfn.charAt(tfn.length - 1);
  return `***-***-**${lastChar}`;
}

/**
 * Mask a bank account number for display.
 * Input: '12345678' -> Output: '****5678'
 *
 * @param accountNumber - Decrypted account number
 * @returns Masked string showing only last 4 digits
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) return '****';
  const last4 = accountNumber.slice(-4);
  return `****${last4}`;
}

/**
 * Mask a BSB for display (not encrypted, but partially masked).
 * Input: '062-000' or '062000' -> Output: '062-***'
 *
 * @param bsb - BSB number (6 digits, optionally with dash)
 * @returns Partially masked BSB
 */
export function maskBSB(bsb: string): string {
  const cleaned = bsb.replace(/\D/g, '');
  if (cleaned.length < 3) return '***-***';
  return `${cleaned.slice(0, 3)}-***`;
}
