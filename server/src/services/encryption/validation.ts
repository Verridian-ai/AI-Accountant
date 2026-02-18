/**
 * Australian Financial Identifier Validation
 */

/**
 * Validate Australian TFN format.
 * TFN is 8-9 digits with a check digit algorithm.
 *
 * @param tfn - TFN to validate (digits only)
 * @returns true if valid format
 */
export function validateTFN(tfn: string): boolean {
  const cleaned = tfn.replace(/\D/g, '');
  if (cleaned.length < 8 || cleaned.length > 9) return false;

  // ATO TFN check digit algorithm (weights)
  const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
  const digits = cleaned.split('').map(Number);

  // Pad to 9 digits if 8
  if (digits.length === 8) digits.unshift(0);

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }

  return sum % 11 === 0;
}

/**
 * Validate Australian BSB format.
 * BSB is 6 digits, optionally formatted as XXX-XXX.
 */
export function validateBSB(bsb: string): boolean {
  const cleaned = bsb.replace(/\D/g, '');
  return cleaned.length === 6 && /^\d{6}$/.test(cleaned);
}
