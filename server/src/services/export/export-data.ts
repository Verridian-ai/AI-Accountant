/**
 * Export Service — Data Fetching Operations
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

  const exportData = txns.map((tx: any) => ({
    date: tx.date,
    description: tx.description,
    amount: (tx.amount / 100).toFixed(2),
    balance: tx.balance ? (tx.balance / 100).toFixed(2) : '',
    category: tx.category || '',
    gst_applicable: tx.gstApplicable ? 'Yes' : 'No',
    gst_amount: tx.gstAmount ? (tx.gstAmount / 100).toFixed(2) : '',
    gst_category: tx.gstCategory || '',
    is_transfer: tx.isTransfer ? 'Yes' : 'No',
    merchant: tx.merchantNormalized || '',
    confidence: tx.confidenceScore?.toFixed(2) || '',
    notes: tx.aiReasoningNotes || '',
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

  for (const period of periods) {
    const calcs = await db
      .select()
      .from(basCalculations)
      .where(eq(basCalculations.basPeriodId, period.id))
      .limit(1);

    const calc = calcs[0];

    exportData.push({
      financial_year: period.financialYear,
      quarter: `Q${period.quarter}`,
      start_date: period.startDate,
      end_date: period.endDate,
      status: period.status,
      lodgement_due: period.lodgementDue,
      lodgement_date: period.lodgementDate || '',
      g1_total_sales: calc ? (calc.labelG1 / 100).toFixed(2) : '0.00',
      g2_export_sales: calc ? (calc.labelG2 / 100).toFixed(2) : '0.00',
      g3_gst_free_sales: calc ? (calc.labelG3 / 100).toFixed(2) : '0.00',
      g10_capital_purchases: calc ? (calc.labelG10 / 100).toFixed(2) : '0.00',
      g11_non_capital_purchases: calc ? (calc.labelG11 / 100).toFixed(2) : '0.00',
      '1a_gst_on_sales': calc ? (calc.label1A / 100).toFixed(2) : '0.00',
      '1b_gst_on_purchases': calc ? (calc.label1B / 100).toFixed(2) : '0.00',
      w1_total_wages: calc ? (calc.labelW1 / 100).toFixed(2) : '0.00',
      w2_amounts_withheld: calc ? (calc.labelW2 / 100).toFixed(2) : '0.00',
      '5a_payg_instalment': calc ? (calc.label5A / 100).toFixed(2) : '0.00',
      net_gst: calc ? (calc.netGst / 100).toFixed(2) : '0.00',
      total_payable: calc ? (calc.totalPayable / 100).toFixed(2) : '0.00',
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
    tax_summaries: summaries.map((s: any) => ({
      tax_year: s.taxYear,
      gross_salary_wages: (s.grossSalaryWages / 100).toFixed(2),
      gross_business_income: (s.grossBusinessIncome / 100).toFixed(2),
      gross_investment_income: (s.grossInvestmentIncome / 100).toFixed(2),
      total_gross_income: (s.totalGrossIncome / 100).toFixed(2),
      work_related_deductions: (s.workRelatedDeductions / 100).toFixed(2),
      total_deductions: (s.totalDeductions / 100).toFixed(2),
      net_capital_gain: (s.netCapitalGain / 100).toFixed(2),
      taxable_income: (s.taxableIncome / 100).toFixed(2),
      tax_on_taxable_income: (s.taxOnTaxableIncome / 100).toFixed(2),
      medicare_levy: (s.medicareLevy / 100).toFixed(2),
      tax_offsets_total: (s.taxOffsetsTotal / 100).toFixed(2),
      total_tax_payable: (s.totalTaxPayable / 100).toFixed(2),
      tax_withheld: (s.taxWithheld / 100).toFixed(2),
      refund_or_payable: (s.refundOrPayable / 100).toFixed(2),
      effective_tax_rate: s.effectiveTaxRate?.toFixed(2) || '0.00',
      status: s.status,
    })),
    deductions: userDeductions.map((d: any) => ({
      tax_year: d.taxYear,
      category: d.category,
      subcategory: d.subcategory || '',
      description: d.description,
      amount: (d.amount / 100).toFixed(2),
      calculation_method: d.calculationMethod || '',
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
    transactions: userTransactions.map((tx: any) => ({
      ...tx,
      amount: tx.amount / 100,
      balance: tx.balance ? tx.balance / 100 : null,
      gstAmount: tx.gstAmount ? tx.gstAmount / 100 : null,
    })),
    accounts: userAccounts.map((acc: any) => ({
      ...acc,
      currentBalance: acc.currentBalance ? acc.currentBalance / 100 : null,
      creditLimit: acc.creditLimit ? acc.creditLimit / 100 : null,
      minimumPayment: acc.minimumPayment ? acc.minimumPayment / 100 : null,
    })),
    basPeriods: userBasPeriods,
    taxSummaries: userTaxSummaries.map((s: any) => ({
      ...s,
      grossSalaryWages: s.grossSalaryWages / 100,
      grossBusinessIncome: s.grossBusinessIncome / 100,
      totalGrossIncome: s.totalGrossIncome / 100,
      totalDeductions: s.totalDeductions / 100,
      taxableIncome: s.taxableIncome / 100,
      totalTaxPayable: s.totalTaxPayable / 100,
    })),
    deductions: userDeductions.map((d: any) => ({
      ...d,
      amount: d.amount / 100,
    })),
  };

  return generateFile(exportId, options, exportData, 'full_backup');
}
