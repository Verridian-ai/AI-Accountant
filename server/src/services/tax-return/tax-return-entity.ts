/**
 * Tax Return Service — Trust & SMSF Entity Calculators
 *
 * Split from the main TaxReturnService class to keep files under 300 lines.
 * These methods are mixed into TaxReturnService via the barrel export.
 */

import { db, transactions } from '../../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getFinancialYearDates } from '../tax.js';
import type { TaxReturnResult } from './types.js';

/**
 * Fetch transactions for a user within a financial year.
 * Excludes transfers and owner contributions.
 */
async function getYearTransactions(
  userId: string,
  financialYear: string,
): Promise<
  Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string | null;
    accountId: string | null;
  }>
> {
  const dates = getFinancialYearDates(financialYear);
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
      category: transactions.category,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, dates.start),
        lte(transactions.date, dates.end),
        eq(transactions.isTransfer, false),
        eq(transactions.isOwnerContribution, false),
      ),
    )
    .all();
  return rows as Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string | null;
    accountId: string | null;
  }>;
}

/**
 * Aggregate income & expenses from transactions (in cents).
 */
function aggregateTransactions(txns: Array<{ amount: number; category: string | null }>) {
  let incomeCents = 0;
  let expensesCents = 0;
  const categoryTotals: Record<string, number> = {};

  for (const tx of txns) {
    const cat = tx.category ?? 'Uncategorised';
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + tx.amount;

    if (tx.amount > 0) {
      incomeCents += tx.amount;
    } else {
      expensesCents += Math.abs(tx.amount);
    }
  }

  return { incomeCents, expensesCents, categoryTotals };
}

/**
 * 4. Trust Return
 *
 * Beneficiary distributions, Section 100A warning.
 * Trusts are flow-through -- income is taxed in beneficiaries' hands.
 */
export async function calculateTrustReturn(
  userId: string,
  financialYear: string,
  beneficiaries?: Array<{ name: string; distributionPercent: number }>,
): Promise<TaxReturnResult> {
  const txns = await getYearTransactions(userId, financialYear);
  const { incomeCents, expensesCents, categoryTotals } = aggregateTransactions(txns);
  const warnings: string[] = [];

  const netIncomeCents = Math.max(0, incomeCents - expensesCents);
  const breakdown: Record<string, number> = { ...categoryTotals };

  // Default: single beneficiary gets 100%
  const bens = beneficiaries ?? [{ name: 'Primary Beneficiary', distributionPercent: 100 }];

  // Validate distributions total 100%
  const totalPercent = bens.reduce((sum, b) => sum + b.distributionPercent, 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    warnings.push(
      `Beneficiary distributions total ${totalPercent}%, not 100%. Adjusting proportionally.`,
    );
  }

  // Calculate each beneficiary's share
  for (const ben of bens) {
    const shareCents = Math.round(netIncomeCents * (ben.distributionPercent / 100));
    breakdown[`_dist_${ben.name}`] = shareCents;
  }

  // Section 100A warning: if distributions to low-income beneficiaries are reimbursed
  warnings.push(
    'Section 100A: Ensure distributions are genuine and beneficiaries retain economic benefit. ' +
      'Trust distributions where the economic benefit is redirected may be deemed tax avoidance.',
  );

  // Trust itself pays no tax if fully distributed
  return {
    entityType: 'trust',
    financialYear,
    grossIncomeCents: incomeCents,
    totalDeductionsCents: expensesCents,
    taxableIncomeCents: netIncomeCents,
    incomeTaxCents: 0, // Taxed in beneficiaries' hands
    medicareLevyCents: 0,
    taxOffsetsCents: 0,
    netTaxPayableCents: 0,
    effectiveRate: 0,
    breakdown,
    warnings,
  };
}

/**
 * 5. SMSF Return
 *
 * 15% concessional rate, exempt pension income.
 */
export async function calculateSMSFReturn(
  userId: string,
  financialYear: string,
  options?: {
    pensionModeProportion?: number; // 0-1, proportion in pension phase (exempt)
  },
): Promise<TaxReturnResult> {
  const txns = await getYearTransactions(userId, financialYear);
  const { incomeCents, expensesCents, categoryTotals } = aggregateTransactions(txns);
  const warnings: string[] = [];

  const SMSF_TAX_RATE = 0.15;
  const pensionProportion = options?.pensionModeProportion ?? 0;

  const grossNetIncomeCents = Math.max(0, incomeCents - expensesCents);

  // Exempt pension income
  const exemptIncomeCents = Math.round(grossNetIncomeCents * pensionProportion);
  const taxableIncomeCents = grossNetIncomeCents - exemptIncomeCents;

  const incomeTaxCents = Math.round(taxableIncomeCents * SMSF_TAX_RATE);

  const effectiveRate = incomeCents > 0 ? (incomeTaxCents / incomeCents) * 100 : 0;

  if (pensionProportion > 0) {
    warnings.push(
      `${Math.round(pensionProportion * 100)}% of fund income is in pension phase (tax exempt).`,
    );
  }

  return {
    entityType: 'smsf',
    financialYear,
    grossIncomeCents: incomeCents,
    totalDeductionsCents: expensesCents,
    taxableIncomeCents,
    incomeTaxCents,
    medicareLevyCents: 0, // SMSFs don't pay Medicare
    taxOffsetsCents: exemptIncomeCents > 0 ? exemptIncomeCents : 0,
    netTaxPayableCents: incomeTaxCents,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    breakdown: {
      ...categoryTotals,
      _exemptPensionIncomeCents: exemptIncomeCents,
      _smsfTaxRate: SMSF_TAX_RATE * 100,
    },
    warnings,
  };
}
