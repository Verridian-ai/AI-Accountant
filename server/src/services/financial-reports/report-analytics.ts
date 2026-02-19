/**
 * Financial Reports Module — Report Analytics
 *
 * Period comparisons, snapshot persistence, KPI calculations,
 * and period-range parsing.
 */

import { db, reportSnapshots, kpiMetrics } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type { ProfitAndLossReport, PeriodComparison, KPIMetrics, ReportData } from './types.js';
import { safeDivide, getPriorPeriod, calculateVariances } from './constants.js';
import { FinancialReportService } from './report-service.js';

export class ReportAnalytics {
  private reports: FinancialReportService;

  constructor(reports: FinancialReportService) {
    this.reports = reports;
  }

  async comparePeriods(
    userId: string,
    currentStart: string,
    currentEnd: string,
    priorStart: string,
    priorEnd: string,
    reportType: string,
  ): Promise<PeriodComparison> {
    let currentData: ReportData, priorData: ReportData;
    switch (reportType) {
      case 'profit_and_loss':
        currentData = await this.reports.generateProfitAndLoss(userId, currentStart, currentEnd);
        priorData = await this.reports.generateProfitAndLoss(userId, priorStart, priorEnd);
        break;
      case 'cash_flow':
        currentData = await this.reports.generateCashFlow(userId, currentStart, currentEnd);
        priorData = await this.reports.generateCashFlow(userId, priorStart, priorEnd);
        break;
      case 'balance_sheet':
        currentData = await this.reports.generateBalanceSheet(userId, currentEnd);
        priorData = await this.reports.generateBalanceSheet(userId, priorEnd);
        break;
      case 'trial_balance':
        currentData = await this.reports.generateTrialBalance(userId, currentEnd);
        priorData = await this.reports.generateTrialBalance(userId, priorEnd);
        break;
      default:
        currentData = await this.reports.generateProfitAndLoss(userId, currentStart, currentEnd);
        priorData = await this.reports.generateProfitAndLoss(userId, priorStart, priorEnd);
    }

    const variances = calculateVariances(currentData, priorData, reportType);
    const significantChanges = variances.filter((v) => Math.abs(v.variancePercent) > 10);

    return {
      reportType,
      currentPeriod: { start: currentStart, end: currentEnd, data: currentData },
      priorPeriod: { start: priorStart, end: priorEnd, data: priorData },
      variances,
      significantChanges,
    };
  }

  async createSnapshot(
    templateId: string,
    reportData: ReportData,
    userId?: string,
    reportType?: string,
    periodStart?: string,
    periodEnd?: string,
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .insert(reportSnapshots)
      .values({
        id,
        templateId,
        userId: userId ?? 'system',
        reportType: reportType ?? 'custom',
        periodStart: periodStart ?? now.split('T')[0],
        periodEnd: periodEnd ?? now.split('T')[0],
        data: JSON.stringify(reportData),
        metadata: JSON.stringify({
          generatedAt: now,
          rowCount: Array.isArray(reportData) ? reportData.length : 1,
        }),
        generatedAt: now,
      })
      .run();
    return id;
  }

  async getKPIs(userId: string, period: string): Promise<KPIMetrics> {
    const { periodStart, periodEnd } = parsePeriodRange(period);
    const pnl = await this.reports.generateProfitAndLoss(userId, periodStart, periodEnd);
    const balanceSheet = await this.reports.generateBalanceSheet(userId, periodEnd);
    const cashFlow = await this.reports.generateCashFlow(userId, periodStart, periodEnd);

    const prior = getPriorPeriod(periodStart, periodEnd);
    let priorPnl: ProfitAndLossReport | null = null;
    try {
      priorPnl = await this.reports.generateProfitAndLoss(userId, prior.start, prior.end);
    } catch {
      /* no prior data */
    }

    const grossMargin = safeDivide(pnl.grossProfit, pnl.grossRevenue) * 100;
    const netMargin = safeDivide(pnl.netProfitOrLoss, pnl.grossRevenue) * 100;
    const currentRatio = safeDivide(balanceSheet.totalAssets, balanceSheet.totalLiabilities);
    const expenseRatio = safeDivide(pnl.totalExpenses, pnl.grossRevenue) * 100;
    const revenueGrowth = priorPnl
      ? safeDivide(pnl.grossRevenue - priorPnl.grossRevenue, priorPnl.grossRevenue) * 100
      : 0;
    const operatingCashFlow = cashFlow.operating.total;
    const totalIncome = pnl.grossRevenue;
    const totalSpend = pnl.totalExpenses + pnl.totalCOGS;
    const savingsRate = safeDivide(totalIncome - totalSpend, totalIncome) * 100;

    const metricDefs: Array<{ name: string; value: number; target: number | null }> = [
      { name: 'gross_margin', value: grossMargin, target: 40 },
      { name: 'net_margin', value: netMargin, target: 15 },
      { name: 'current_ratio', value: currentRatio, target: 2.0 },
      { name: 'expense_ratio', value: expenseRatio, target: 70 },
      { name: 'revenue_growth', value: revenueGrowth, target: 10 },
      { name: 'operating_cash_flow', value: operatingCashFlow, target: null },
      { name: 'savings_rate', value: savingsRate, target: 20 },
    ];

    const previousMetrics = await db
      .select({ metricName: kpiMetrics.metricName, metricValue: kpiMetrics.metricValue })
      .from(kpiMetrics)
      .where(and(eq(kpiMetrics.userId, userId), sql`${kpiMetrics.period} < ${period}`))
      .orderBy(sql`${kpiMetrics.period} DESC`)
      .all();

    const previousMap = new Map<string, number>();
    for (const pm of previousMetrics) {
      if (!previousMap.has(pm.metricName)) previousMap.set(pm.metricName, Number(pm.metricValue));
    }

    const resultMetrics: KPIMetrics['metrics'] = [];
    for (const def of metricDefs) {
      const prevValue = previousMap.get(def.name) ?? null;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (prevValue !== null) {
        if (def.value > prevValue) trend = 'up';
        else if (def.value < prevValue) trend = 'down';
      }
      resultMetrics.push({
        metricName: def.name,
        value: Math.round(def.value * 100) / 100,
        target: def.target,
        trend,
        previousValue: prevValue,
      });

      const existingMetric = await db
        .select()
        .from(kpiMetrics)
        .where(
          and(
            eq(kpiMetrics.userId, userId),
            eq(kpiMetrics.metricName, def.name),
            eq(kpiMetrics.period, period),
          ),
        )
        .get();

      if (existingMetric) {
        await db
          .update(kpiMetrics)
          .set({
            metricValue: Math.round(def.value * 100) / 100,
            targetValue: def.target,
            trendDirection: trend,
            previousValue: prevValue,
            calculatedAt: new Date().toISOString(),
          })
          .where(eq(kpiMetrics.id, existingMetric.id))
          .run();
      } else {
        await db
          .insert(kpiMetrics)
          .values({
            id: crypto.randomUUID(),
            userId,
            metricName: def.name,
            metricValue: Math.round(def.value * 100) / 100,
            period,
            targetValue: def.target,
            trendDirection: trend,
            previousValue: prevValue,
            calculatedAt: new Date().toISOString(),
          })
          .run();
      }
    }

    return { period, metrics: resultMetrics };
  }
}

export function parsePeriodRange(period: string): { periodStart: string; periodEnd: string } {
  // Australian Financial Year: FY2026 = 1 Jul 2025 – 30 Jun 2026
  if (period.toUpperCase().startsWith('FY')) {
    const fy = parseInt(period.slice(2), 10);
    return { periodStart: `${fy - 1}-07-01`, periodEnd: `${fy}-06-30` };
  }
  if (period.includes('Q')) {
    const [yearStr, qStr] = period.split('-Q');
    const year = parseInt(yearStr, 10);
    const quarter = parseInt(qStr, 10);
    const monthStart = (quarter - 1) * 3 + 1;
    const monthEnd = monthStart + 2;
    const lastDay = new Date(year, monthEnd, 0).getDate();
    return {
      periodStart: `${year}-${String(monthStart).padStart(2, '0')}-01`,
      periodEnd: `${year}-${String(monthEnd).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  if (period.length === 7) {
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      periodStart: `${period}-01`,
      periodEnd: `${period}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  const year = parseInt(period, 10);
  return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` };
}
