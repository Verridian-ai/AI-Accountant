/**
 * Pipeline types, interfaces, and shared constants/helpers.
 */
import { logger } from '../../utils/logger.js';

// GST auto-calculation helpers
export const GST_RATE = 0.1; // 10% Australian GST

export function calculateGstAmount(amountCents: number): number {
  return Math.round((Math.abs(amountCents) * GST_RATE) / (1 + GST_RATE));
}

// Map transaction categories to GST categories
export const GST_FREE_CATEGORIES = new Set([
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

export const INPUT_TAXED_CATEGORIES = new Set(['Financial Services']);

export function inferGstCategory(category: string, gstApplicable: boolean): string {
  if (!gstApplicable) return 'gst_free';
  if (INPUT_TAXED_CATEGORIES.has(category)) return 'input_taxed';
  if (GST_FREE_CATEGORIES.has(category)) return 'gst_free';
  return 'taxable_10';
}

export interface AccountDetectionResult {
  accountId: string | null;
  isNewAccount: boolean;
  needsSetup: boolean;
  detectedInfo: {
    accountNumber: string | null;
    accountNumberMasked: string | null;
    bankName: string | null;
    accountType: string | null;
    openingBalance: number | null;
    closingBalance: number | null;
  };
}

export interface RawTransactionData {
  transactions: Array<{
    date: string;
    description: string;
    amount_cents: number;
    balance_cents?: number;
  }>;
}

export interface CategorizationResult {
  category: string;
  gst: boolean;
  notes: string;
  confidence: number;
  merchantNormalized: string;
  needsReview: boolean;
}

/** Compute statement metadata from parsed transactions */
export function computeStatementMetadata(
  txs: Array<{ date: string; amount_cents: number; balance_cents?: number }>,
  accountDetection: AccountDetectionResult,
) {
  const sortedDates = txs
    .map((t) => t.date)
    .filter(Boolean)
    .sort();
  const sortedByDate = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const openingBalance =
    accountDetection.detectedInfo.openingBalance ?? sortedByDate[0]?.balance_cents ?? null;
  const closingBalance =
    accountDetection.detectedInfo.closingBalance ??
    sortedByDate[sortedByDate.length - 1]?.balance_cents ??
    null;

  // Balance invariant validation: opening + sum(transactions) should equal closing
  if (openingBalance !== null && closingBalance !== null) {
    const txSum = txs.reduce((sum, tx) => sum + tx.amount_cents, 0);
    const expectedClosing = openingBalance + txSum;
    if (expectedClosing !== closingBalance) {
      logger.warn(
        `[Pipeline] Balance invariant failed: ${openingBalance} + ${txSum} = ${expectedClosing}, expected ${closingBalance}, diff=${expectedClosing - closingBalance}`,
      );
    }
  }

  return {
    periodStartDate: sortedDates[0] || null,
    periodEndDate: sortedDates[sortedDates.length - 1] || null,
    openingBalance,
    closingBalance,
    transactionCount: txs.length,
  };
}
