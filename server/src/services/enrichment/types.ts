/**
 * Enrichment types and helpers — extracted from parent monolith ../enrichment.ts.
 */
import { calculateGstFromInclusive } from '../bas.js';

export type EnrichmentStatus = 'enriched' | 'pending' | 'unknown' | 'failed';

const GST_FREE_CATEGORIES = new Set([
  'Government & Tax',
  'Internal Transfer',
  'Transfer',
  'Interest & Dividends',
  'Loan/Liability Payment',
  'Superannuation',
  'Insurance',
  'Medical & Health',
  'Education & Childcare',
  'Donations & Charity',
  'Employment Income',
  'Salary & Wages',
]);

const INPUT_TAXED_CATEGORIES = new Set(['Financial Services']);

const PAYMENT_PREFIXES = [
  'EFTPOS',
  'BPAY',
  'DIRECT DEBIT',
  'ATM',
  'OSKO',
  'PAY/TRANSFER',
  'VISA PURCHASE',
  'VISA DEBIT',
  'MASTERCARD',
  'PENDING',
  'INTERNATIONAL',
  'CARD PURCHASE',
  'TRANSFER TO',
  'TRANSFER FROM',
  'INTERNET BANKING',
  'MOBILE BANKING',
];

const PREFIX_REGEX = new RegExp(
  `^(${PAYMENT_PREFIXES.map((p) => p.replace(/[/\\]/g, '\\$&')).join('|')})\\s+`,
  'i',
);

export function inferGstCategory(
  category: string,
  amount: number,
): { gstCategory: string; gstAmount: number } {
  if (INPUT_TAXED_CATEGORIES.has(category)) {
    return { gstCategory: 'input_taxed', gstAmount: 0 };
  }
  if (GST_FREE_CATEGORIES.has(category)) {
    return { gstCategory: 'gst_free', gstAmount: 0 };
  }
  return {
    gstCategory: 'taxable_10',
    gstAmount: calculateGstFromInclusive(amount),
  };
}

export function stripPaymentPrefix(description: string): string {
  return description.replace(PREFIX_REGEX, '').trim();
}
