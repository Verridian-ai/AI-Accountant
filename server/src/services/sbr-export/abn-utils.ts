/**
 * ABN/ACN validation and ATO amount formatting utilities.
 * Pure functions — no external dependencies.
 */

export function validateABN(abn: string): boolean {
  const clean = abn.replace(/\s/g, '');
  if (!/^\d{11}$/.test(clean)) return false;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = clean.split('').map(Number);
  digits[0] -= 1;

  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }
  return sum % 89 === 0;
}

export function validateACN(acn: string): boolean {
  const clean = acn.replace(/\s/g, '');
  if (!/^\d{9}$/.test(clean)) return false;

  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  const digits = clean.split('').map(Number);

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  return digits[8] === expectedCheckDigit;
}

export function formatATOAmount(cents: number): string {
  const dollars = Math.round(cents / 100);
  return dollars.toString();
}

export function parseATOAmount(dollars: string | number): number {
  const num = typeof dollars === 'string' ? parseInt(dollars, 10) : dollars;
  return num * 100;
}
