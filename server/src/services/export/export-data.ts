/**
 * Export Service -- Data Fetching Operations
 * Retrieves data for each export type (transactions, BAS, tax, full backup).
 */

import {
  db,
  transactions,
  accounts,
  basPeriods,
  basCalculations,
  taxYearSummary,
  deductions,
} from '../../schema.js';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import type { ExportOptions, ExportResult } from './types.js';

type GenerateFileFn = (
  exportId: string,
  options: ExportOptions,
  data: unknown,
  baseName: string,
) => Promise<ExportResult>;

/** Safely read a numeric field from a DB row, defaulting to 0. */
function num(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  return typeof v === 'number' ? v : 0;
}

/** Safely read a string field from a DB row, defaulting to ''. */
function str(row: Record<string, unknown>, key: string, fallback = ''): string {
  const v = row[key];
  return typeof v === 'string' ? v : fallback;
}

/**
 * Export transactions
 */
export async function exportTransactions(
  exportId: string,
  options: ExportOptions,
  generateFile: GenerateFileFn,
): Promise<ExportResult> {
  const conditions = [eq(transactions.userId, options.userId)];

  if (options.dateRange) {
    conditions.push(gte(transactions.date, options.dateRange.start));
    conditions.push(lte(transactions.date, options.dateRange.end));
  }

  if (options.filters?.categories?.length) {
    conditions.push(inArray(transactions.category, options.filters.categories));
  }

  if (options.filters?.accountIds?.length) {
    conditions.push(inArray(transactions.accountId, options.filters.accountIds));
  }

  const txns = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date));

  const exportData = (txns as Record<string, unknown>[]).map((tx) => ({
    date: str(tx, 'date'),
    description: str(tx, 'description'),
    amount: (num(tx, 'amount') / 100).toFixed(2),
    balance: num(tx, 'balance') ? (num(tx, 'balance') / 100).toFixed(2) : '',
    category: str(tx, 'category'),
    gst_applicable: tx.gstApplicable ? 'Yes' : 'No',
    gst_amount: num(tx, 'gstAmount') ? (num(tx, 'gstAmount') / 100).toFixed(2) : '',
    gst_category: str(tx, 'gstCategory'),
    is_transfer: tx.isTransfer ? 'Yes' : 'No',
    merchant: str(tx, 'merchantNormalized'),
    confidence: typeof tx.confidenceScore === 'number' ? tx.confidenceScore.toFixed(2) : '',
    notes: str(tx, 'aiReasoningNotes'),
  }));

  return generateFile(exportId, options, exportData, 'transactions');
}

/**
 * Export BAS data
 */
export async function exportBAS(
  exportId: string,
  options: ExportOptions,
  generateFile: GenerateFileFn,
): Promise<ExportResult> {
  const periods = await db
    .select()
    .from(basPeriods)
    .where(eq(basPeriods.userId, options.userId))
    .orderBy(desc(basPeriods.startDate));

  const exportData = [];

  for (const period of periods as Record<string, unknown>[]) {
    const calcs = await db
      .select()
      .from(basCalculations)
      .where(eq(basCalculations.basPeriodId, str(period, 'id')))
      .limit(1);

    const calc = (calcs as Record<string, unknown>[])[0];

    exportData.push({
      financial_year: str(period, 'financialYear'),
      quarter: `Q${period.quarter}`,
      start_date: str(period, 'startDate'),
      end_date: str(period, 'endDate'),
      status: str(period, 'status'),
      lodgement_due: str(period, 'lodgementDue'),
      lodgement_date: str(period, 'lodgementDate'),
      g1_total_sales: calc ? (num(calc, 'labelG1') / 100).toFixed(2) : '0.00',
      g2_export_sales: calc ? (num(calc, 'labelG2') / 100).toFixed(2) : '0.00',
      g3_gst_free_sales: calc ? (num(calc, 'labelG3') / 100).toFixed(2) : '0.00',
      g10_capital_purchases: calc ? (num(calc, 'labelG10') / 100).toFixed(2) : '0.00',
      g11_non_capital_purchases: calc ? (num(calc, 'labelG11') / 100).toFixed(2) : '0.00',
      '1a_gst_on_sales': calc ? (num(calc, 'label1A') / 100).toFixed(2) : '0.00',
      '1b_gst_on_purchases': calc ? (num(calc, 'label1B') / 100).toFixed(2) : '0.00',
      w1_total_wages: calc ? (num(calc, 'labelW1') / 100).toFixed(2) : '0.00',
      w2_amounts_withheld: calc ? (num(calc, 'labelW2') / 100).toFixed(2) : '0.00',
      '5a_payg_instalment': calc ? (num(calc, 'label5A') / 100).toFixed(2) : '0.00',
      net_gst: calc ? (num(calc, 'netGst') / 100).toFixed(2) : '0.00',
      total_payable: calc ? (num(calc, 'totalPayable') / 100).toFixed(2) : '0.00',
    });
  }

  return generateFile(exportId, options, exportData, 'bas_report');
}

/**
 * Export tax summary
 */
export async function exportTaxSummary(
  exportId: string,
  options: ExportOptions,
  generateFile: GenerateFileFn,
): Promise<ExportResult> {
  const summaries = await db
    .select()
    .from(taxYearSummary)
    .where(eq(taxYearSummary.userId, options.userId))
    .orderBy(desc(taxYearSummary.taxYear));

  const userDeductions = await db
    .select()
    .from(deductions)
    .where(eq(deductions.userId, options.userId))
    .orderBy(desc(deductions.taxYear));

  const exportData = {
    tax_summaries: (summaries as Record<string, unknown>[]).map((s) => ({
      tax_year: str(s, 'taxYear'),
      gross_salary_wages: (num(s, 'grossSalaryWages') / 100).toFixed(2),
      gross_business_income: (num(s, 'grossBusinessIncome') / 100).toFixed(2),
      gross_investment_income: (num(s, 'grossInvestmentIncome') / 100).toFixed(2),
      total_gross_income: (num(s, 'totalGrossIncome') / 100).toFixed(2),
      work_related_deductions: (num(s, 'workRelatedDeductions') / 100).toFixed(2),
      total_deductions: (num(s, 'totalDeductions') / 100).toFixed(2),
      net_capital_gain: (num(s, 'netCapitalGain') / 100).toFixed(2),
      taxable_income: (num(s, 'taxableIncome') / 100).toFixed(2),
      tax_on_taxable_income: (num(s, 'taxOnTaxableIncome') / 100).toFixed(2),
      medicare_levy: (num(s, 'medicareLevy') / 100).toFixed(2),
      tax_offsets_total: (num(s, 'taxOffsetsTotal') / 100).toFixed(2),
      total_tax_payable: (num(s, 'totalTaxPayable') / 100).toFixed(2),
      tax_withheld: (num(s, 'taxWithheld') / 100).toFixed(2),
      refund_or_payable: (num(s, 'refundOrPayable') / 100).toFixed(2),
      effective_tax_rate:
        typeof s.effectiveTaxRate === 'number' ? s.effectiveTaxRate.toFixed(2) : '0.00',
      status: str(s, 'status'),
    })),
    deductions: (userDeductions as Record<string, unknown>[]).map((d) => ({
      tax_year: str(d, 'taxYear'),
      category: str(d, 'category'),
      subcategory: str(d, 'subcategory'),
      description: str(d, 'description'),
      amount: (num(d, 'amount') / 100).toFixed(2),
      calculation_method: str(d, 'calculationMethod'),
      is_substantiated: d.isSubstantiated ? 'Yes' : 'No',
    })),
  };

  return generateFile(exportId, options, exportData, 'tax_summary');
}

/**
 * Export full backup (all user data)
 */
export async function exportFullBackup(
  exportId: string,
  options: ExportOptions,
  generateFile: GenerateFileFn,
): Promise<ExportResult> {
  const userTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, options.userId));
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, options.userId));
  const userBasPeriods = await db
    .select()
    .from(basPeriods)
    .where(eq(basPeriods.userId, options.userId));
  const userTaxSummaries = await db
    .select()
    .from(taxYearSummary)
    .where(eq(taxYearSummary.userId, options.userId));
  const userDeductions = await db
    .select()
    .from(deductions)
    .where(eq(deductions.userId, options.userId));

  const exportData = {
    exportDate: new Date().toISOString(),
    exportVersion: '1.0',
    transactions: (userTransactions as Record<string, unknown>[]).map((tx) => ({
      ...tx,
      amount: num(tx, 'amount') / 100,
      balance: num(tx, 'balance') ? num(tx, 'balance') / 100 : null,
      gstAmount: num(tx, 'gstAmount') ? num(tx, 'gstAmount') / 100 : null,
    })),
    accounts: (userAccounts as Record<string, unknown>[]).map((acc) => ({
      ...acc,
      currentBalance: num(acc, 'currentBalance') ? num(acc, 'currentBalance') / 100 : null,
      creditLimit: num(acc, 'creditLimit') ? num(acc, 'creditLimit') / 100 : null,
      minimumPayment: num(acc, 'minimumPayment') ? num(acc, 'minimumPayment') / 100 : null,
    })),
    basPeriods: userBasPeriods,
    taxSummaries: (userTaxSummaries as Record<string, unknown>[]).map((s) => ({
      ...s,
      grossSalaryWages: num(s, 'grossSalaryWages') / 100,
      grossBusinessIncome: num(s, 'grossBusinessIncome') / 100,
      totalGrossIncome: num(s, 'totalGrossIncome') / 100,
      totalDeductions: num(s, 'totalDeductions') / 100,
      taxableIncome: num(s, 'taxableIncome') / 100,
      totalTaxPayable: num(s, 'totalTaxPayable') / 100,
    })),
    deductions: (userDeductions as Record<string, unknown>[]).map((d) => ({
      ...d,
      amount: num(d, 'amount') / 100,
    })),
  };

  return generateFile(exportId, options, exportData, 'full_backup');
}
