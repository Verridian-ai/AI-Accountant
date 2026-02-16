/**
 * Tax Return Service
 *
 * 5 entity-specific Australian tax return calculators:
 * Sole Trader, Personal, Company, Trust, SMSF.
 *
 * All monetary values are in CENTS (integer arithmetic) unless
 * explicitly noted. Dollar amounts are only used at the boundary
 * when calling tax.ts functions (which operate in dollars).
 */

import { db, transactions, businessProfiles } from '../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import {
  calculateIncomeTax,
  calculateMedicareLevy,
  calculateLITO,
  getFinancialYearDates,
} from './tax.js';

/** Deduction rates re-exported for agent consumption */
export const DEDUCTION_RATES = {
  wfhHourlyRate: 67, // 67 cents per hour
  motorVehicleCentsPerKm: 85,
  motorVehicleMaxKm: 5000,
  instantWriteOffThreshold: 2_000_000, // $20,000 in cents
  superContributionCapCents: 2_750_000, // $27,500 in cents
};

/** SBITO: 16% of net small business income, capped at $1,000 */
function calculateSBITO(netSmallBusinessIncomeCents: number): number {
  if (netSmallBusinessIncomeCents <= 0) return 0;
  const offset = Math.round(netSmallBusinessIncomeCents * 0.16);
  return Math.min(offset, 100_000); // $1,000 = 100,000 cents
}

export interface TaxReturnResult {
  entityType: string;
  financialYear: string;
  grossIncomeCents: number;
  totalDeductionsCents: number;
  taxableIncomeCents: number;
  incomeTaxCents: number;
  medicareLevyCents: number;
  taxOffsetsCents: number;
  netTaxPayableCents: number;
  effectiveRate: number;
  breakdown: Record<string, number>;
  warnings: string[];
}

export class TaxReturnService {
  /**
   * Fetch transactions for a user within a financial year.
   * Excludes transfers and owner contributions.
   */
  private async getYearTransactions(
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
  private aggregateTransactions(txns: Array<{ amount: number; category: string | null }>) {
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
   * 1. Sole Trader Return
   *
   * Business P&L, owner equity, SBITO, LITO.
   * Income and expenses flow through to the individual's personal return.
   */
  async calculateSoleTraderReturn(userId: string, financialYear: string): Promise<TaxReturnResult> {
    const txns = await this.getYearTransactions(userId, financialYear);
    const { incomeCents, expensesCents, categoryTotals } = this.aggregateTransactions(txns);
    const warnings: string[] = [];

    const netBusinessIncomeCents = incomeCents - expensesCents;
    const taxableIncomeDollars = Math.max(0, netBusinessIncomeCents) / 100;

    // Tax calculation in dollars
    const incomeTaxDollars = calculateIncomeTax(taxableIncomeDollars);
    const { levy: medicareDollars } = calculateMedicareLevy(taxableIncomeDollars);
    const litoDollars = calculateLITO(taxableIncomeDollars);
    const sbitoCents = calculateSBITO(Math.max(0, netBusinessIncomeCents));

    // Convert back to cents
    const incomeTaxCents = Math.round(incomeTaxDollars * 100);
    const medicareLevyCents = Math.round(medicareDollars * 100);
    const litoCents = Math.round(litoDollars * 100);
    const totalOffsetsCents = litoCents + sbitoCents;

    const netTaxCents = Math.max(0, incomeTaxCents + medicareLevyCents - totalOffsetsCents);
    const effectiveRate = incomeCents > 0 ? (netTaxCents / incomeCents) * 100 : 0;

    if (incomeCents === 0) {
      warnings.push('No income transactions found for this financial year.');
    }

    return {
      entityType: 'sole_trader',
      financialYear,
      grossIncomeCents: incomeCents,
      totalDeductionsCents: expensesCents,
      taxableIncomeCents: Math.max(0, netBusinessIncomeCents),
      incomeTaxCents,
      medicareLevyCents,
      taxOffsetsCents: totalOffsetsCents,
      netTaxPayableCents: netTaxCents,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      breakdown: {
        ...categoryTotals,
        _sbitoCents: sbitoCents,
        _litoCents: litoCents,
      },
      warnings,
    };
  }

  /**
   * 2. Personal Return
   *
   * Employment income + business income, WFH/car deductions, HELP.
   */
  async calculatePersonalReturn(
    userId: string,
    financialYear: string,
    options?: {
      wfhHoursPerWeek?: number;
      wfhWeeksWorked?: number;
      motorVehicleKm?: number;
      hasHelpDebt?: boolean;
      helpBalance?: number;
    },
  ): Promise<TaxReturnResult> {
    const txns = await this.getYearTransactions(userId, financialYear);
    const { incomeCents, expensesCents, categoryTotals } = this.aggregateTransactions(txns);
    const warnings: string[] = [];

    // Additional deductions from options
    let additionalDeductionsCents = 0;
    const breakdown: Record<string, number> = { ...categoryTotals };

    if (options?.wfhHoursPerWeek) {
      const weeks = options.wfhWeeksWorked ?? 48;
      const wfhCents = options.wfhHoursPerWeek * weeks * DEDUCTION_RATES.wfhHourlyRate;
      additionalDeductionsCents += Math.round(wfhCents);
      breakdown._wfhDeductionCents = Math.round(wfhCents);
    }

    if (options?.motorVehicleKm) {
      const claimableKm = Math.min(options.motorVehicleKm, DEDUCTION_RATES.motorVehicleMaxKm);
      const motorCents = claimableKm * DEDUCTION_RATES.motorVehicleCentsPerKm;
      additionalDeductionsCents += motorCents;
      breakdown._motorVehicleDeductionCents = motorCents;
    }

    const totalDeductionsCents = expensesCents + additionalDeductionsCents;
    const taxableIncomeCents = Math.max(0, incomeCents - totalDeductionsCents);
    const taxableIncomeDollars = taxableIncomeCents / 100;

    const incomeTaxDollars = calculateIncomeTax(taxableIncomeDollars);
    const { levy: medicareDollars } = calculateMedicareLevy(taxableIncomeDollars);
    const litoDollars = calculateLITO(taxableIncomeDollars);

    const incomeTaxCents = Math.round(incomeTaxDollars * 100);
    const medicareLevyCents = Math.round(medicareDollars * 100);
    const litoCents = Math.round(litoDollars * 100);

    // HELP repayment (calculated but reported separately — not a "tax")
    let helpRepaymentCents = 0;
    if (options?.hasHelpDebt) {
      const { calculateAnnualHelpRepayment } = await import('./tax.js');
      helpRepaymentCents = Math.round(calculateAnnualHelpRepayment(taxableIncomeDollars) * 100);
      breakdown._helpRepaymentCents = helpRepaymentCents;
    }

    const netTaxCents = Math.max(0, incomeTaxCents + medicareLevyCents - litoCents);
    const effectiveRate = incomeCents > 0 ? (netTaxCents / incomeCents) * 100 : 0;

    if (incomeCents === 0) {
      warnings.push('No income transactions found for this financial year.');
    }

    return {
      entityType: 'personal',
      financialYear,
      grossIncomeCents: incomeCents,
      totalDeductionsCents,
      taxableIncomeCents,
      incomeTaxCents,
      medicareLevyCents,
      taxOffsetsCents: litoCents,
      netTaxPayableCents: netTaxCents,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      breakdown,
      warnings,
    };
  }

  /**
   * 3. Company Return
   *
   * 25% base rate entity tax. Franking credits.
   */
  async calculateCompanyReturn(userId: string, financialYear: string): Promise<TaxReturnResult> {
    const txns = await this.getYearTransactions(userId, financialYear);
    const { incomeCents, expensesCents, categoryTotals } = this.aggregateTransactions(txns);
    const warnings: string[] = [];

    // Check entity type from business profile
    const profile = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))
      .get();

    const entityType = (profile as any)?.entityType ?? 'company';
    if (entityType !== 'company') {
      warnings.push(
        `Business profile entity type is '${entityType}', not 'company'. Using company tax rate regardless.`,
      );
    }

    const COMPANY_TAX_RATE = 0.25; // Base rate entity
    const taxableIncomeCents = Math.max(0, incomeCents - expensesCents);
    const incomeTaxCents = Math.round(taxableIncomeCents * COMPANY_TAX_RATE);

    // Franking credits available = tax paid
    const frankingCreditsCents = incomeTaxCents;

    const effectiveRate = incomeCents > 0 ? (incomeTaxCents / incomeCents) * 100 : 0;

    return {
      entityType: 'company',
      financialYear,
      grossIncomeCents: incomeCents,
      totalDeductionsCents: expensesCents,
      taxableIncomeCents,
      incomeTaxCents,
      medicareLevyCents: 0, // Companies don't pay Medicare
      taxOffsetsCents: 0,
      netTaxPayableCents: incomeTaxCents,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      breakdown: {
        ...categoryTotals,
        _frankingCreditsCents: frankingCreditsCents,
        _companyTaxRate: COMPANY_TAX_RATE * 100,
      },
      warnings,
    };
  }

  /**
   * 4. Trust Return
   *
   * Beneficiary distributions, Section 100A warning.
   * Trusts are flow-through — income is taxed in beneficiaries' hands.
   */
  async calculateTrustReturn(
    userId: string,
    financialYear: string,
    beneficiaries?: Array<{ name: string; distributionPercent: number }>,
  ): Promise<TaxReturnResult> {
    const txns = await this.getYearTransactions(userId, financialYear);
    const { incomeCents, expensesCents, categoryTotals } = this.aggregateTransactions(txns);
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
  async calculateSMSFReturn(
    userId: string,
    financialYear: string,
    options?: {
      pensionModeProportion?: number; // 0-1, proportion in pension phase (exempt)
    },
  ): Promise<TaxReturnResult> {
    const txns = await this.getYearTransactions(userId, financialYear);
    const { incomeCents, expensesCents, categoryTotals } = this.aggregateTransactions(txns);
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
}

export const taxReturnService = new TaxReturnService();
