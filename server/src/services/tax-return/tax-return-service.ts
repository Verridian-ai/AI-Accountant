/**
 * Tax Return Service — Sole Trader, Personal, Company calculators.
 * Trust & SMSF are in tax-return-entity.ts (delegated from this class).
 * All monetary values in CENTS (integer arithmetic).
 */

import { db, transactions, businessProfiles } from '../../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import {
  calculateIncomeTax,
  calculateMedicareLevy,
  calculateLITO,
  getFinancialYearDates,
} from '../tax.js';
import { DEDUCTION_RATES, calculateSBITO, type TaxReturnResult } from './types.js';
import { calculateTrustReturn, calculateSMSFReturn } from './tax-return-entity.js';

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

    // HELP repayment (calculated but reported separately -- not a "tax")
    let helpRepaymentCents = 0;
    if (options?.hasHelpDebt) {
      const { calculateAnnualHelpRepayment } = await import('../tax.js');
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

    const entityType = (profile as { entityType?: string } | undefined)?.entityType ?? 'company';
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
   * 4. Trust Return — delegated to tax-return-entity module.
   */
  async calculateTrustReturn(
    userId: string,
    financialYear: string,
    beneficiaries?: Array<{ name: string; distributionPercent: number }>,
  ): Promise<TaxReturnResult> {
    return calculateTrustReturn(userId, financialYear, beneficiaries);
  }

  /**
   * 5. SMSF Return — delegated to tax-return-entity module.
   */
  async calculateSMSFReturn(
    userId: string,
    financialYear: string,
    options?: { pensionModeProportion?: number },
  ): Promise<TaxReturnResult> {
    return calculateSMSFReturn(userId, financialYear, options);
  }
}
