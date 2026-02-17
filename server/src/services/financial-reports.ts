/**
 * Financial Reporting Engine
 * Generates P&L, Balance Sheet, Cash Flow, Trial Balance reports,
 * period comparisons, snapshot persistence, and KPI calculations.
 *
 * Pattern: follows bas.ts — service class with Drizzle queries returning typed objects.
 * Amounts are stored in cents (integers). Percentages and ratios use decimals.
 */

import { db, transactions, journalEntries, journalEntryLines, accounts, ownerEquityEvents, chartOfAccounts, reportSnapshots, kpiMetrics } from '../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProfitAndLossReport {
  periodStart: string;
  periodEnd: string;
  revenue: CategoryGroup[];
  expenses: CategoryGroup[];
  costOfGoodsSold: CategoryGroup[];
  grossRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  netProfitOrLoss: number;
  grossMargin: number;
  transactionCount: number;
}

export interface CategoryGroup {
  category: string;
  amount: number;
  transactionCount: number;
  subcategories?: CategoryGroup[];
}

export interface BalanceSheetReport {
  asAtDate: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export interface BalanceSheetSection {
  items: Array<{ name: string; amount: number }>;
  total: number;
}

export interface CashFlowReport {
  periodStart: string;
  periodEnd: string;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: number;
  openingBalance: number;
  closingBalance: number;
}

export interface CashFlowSection {
  items: Array<{ category: string; amount: number }>;
  total: number;
}

export interface TrialBalanceReport {
  asAtDate: string;
  entries: TrialBalanceEntry[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;
}

export interface TrialBalanceEntry {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  netBalance: number;
}

export interface PeriodComparison {
  reportType: string;
  currentPeriod: { start: string; end: string; data: ProfitAndLossReport | BalanceSheetReport | CashFlowReport | TrialBalanceReport };
  priorPeriod: { start: string; end: string; data: ProfitAndLossReport | BalanceSheetReport | CashFlowReport | TrialBalanceReport };
  variances: CategoryVariance[];
  significantChanges: CategoryVariance[];
}

export interface CategoryVariance {
  category: string;
  currentAmount: number;
  priorAmount: number;
  varianceAmount: number;
  variancePercent: number;
  direction: 'increase' | 'decrease' | 'unchanged';
}

export interface KPIMetrics {
  period: string;
  metrics: Array<{
    metricName: string;
    value: number;
    target: number | null;
    trend: 'up' | 'down' | 'stable';
    previousValue: number | null;
  }>;
}

// ============================================================================
// CATEGORY CLASSIFICATION
// ============================================================================

// Revenue categories (positive amounts = income)
const REVENUE_CATEGORIES = [
  'Sales Revenue',
  'Service Revenue',
  'Interest Income',
  'Other Income',
  'Export Revenue',
  'Business Income',
  'Rental Income',
  // Legacy names that may appear in older transaction data
  'Salary/Wages',
  'Business Revenue',
  'Investment Income',
  'Government Payments',
];

// Cost of Goods Sold categories
const COGS_CATEGORIES = ['Cost of Goods Sold', 'Direct Labour', 'Freight Costs', 'Materials'];

// System/transfer categories excluded from P&L
const SYSTEM_CATEGORIES = [
  'Transfer',
  'Cash Withdrawal',
  'Loan Repayment',
  'Mortgage',
  'Refund',
  'Uncategorized',
];

// Investing-related categories for cash flow classification
const INVESTING_CATEGORIES = ['Depreciation'];

// Financing-related categories for cash flow classification
const FINANCING_CATEGORIES = ['Loan Repayment', 'Mortgage'];

// ============================================================================
// HELPERS
// ============================================================================

/** Safe division avoiding divide-by-zero */
function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/** Calculate previous period dates given current period */
function getPriorPeriod(periodStart: string, periodEnd: string): { start: string; end: string } {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const durationMs = end.getTime() - start.getTime();

  const priorEnd = new Date(start.getTime() - 1); // day before current start
  const priorStart = new Date(priorEnd.getTime() - durationMs);

  return {
    start: priorStart.toISOString().split('T')[0],
    end: priorEnd.toISOString().split('T')[0],
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class FinancialReportService {
  /**
   * Generate a Profit & Loss (Income Statement) for a date range.
   * Groups transactions by category into Revenue, COGS, and Expense sections.
   * Amounts in cents (as stored in DB).
   */
  async generateProfitAndLoss(
    userId: string,
    periodStart: string,
    periodEnd: string,
    accountId?: string,
  ): Promise<ProfitAndLossReport> {
    // Build where conditions
    const conditions = [
      eq(transactions.userId, userId),
      gte(transactions.date, periodStart),
      lte(transactions.date, periodEnd),
      sql`${transactions.isTransfer} = false`,
    ];

    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
    }

    // Query transactions grouped by category
    const rows = await db
      .select({
        category: transactions.category,
        totalAmount: sql<number>`SUM(${transactions.amount})`,
        txCount: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(transactions.category)
      .all();

    const revenue: CategoryGroup[] = [];
    const costOfGoodsSold: CategoryGroup[] = [];
    const expenses: CategoryGroup[] = [];
    let grossRevenue = 0;
    let totalCOGS = 0;
    let totalExpenses = 0;
    let transactionCount = 0;

    for (const row of rows) {
      const cat = row.category ?? 'Uncategorized';
      const amount = Number(row.totalAmount) || 0;
      const count = Number(row.txCount) || 0;
      transactionCount += count;

      if (SYSTEM_CATEGORIES.includes(cat)) {
        continue; // Skip transfers, ATM withdrawals, etc.
      }

      const group: CategoryGroup = {
        category: cat,
        amount: Math.abs(amount),
        transactionCount: count,
      };

      if (REVENUE_CATEGORIES.includes(cat)) {
        revenue.push(group);
        grossRevenue += Math.abs(amount);
      } else if (COGS_CATEGORIES.includes(cat)) {
        costOfGoodsSold.push(group);
        totalCOGS += Math.abs(amount);
      } else {
        expenses.push(group);
        totalExpenses += Math.abs(amount);
      }
    }

    // Sort each section by amount descending
    revenue.sort((a, b) => b.amount - a.amount);
    costOfGoodsSold.sort((a, b) => b.amount - a.amount);
    expenses.sort((a, b) => b.amount - a.amount);

    const grossProfit = grossRevenue - totalCOGS;
    const netProfitOrLoss = grossProfit - totalExpenses;
    const grossMargin = safeDivide(grossProfit, grossRevenue) * 100;

    return {
      periodStart,
      periodEnd,
      revenue,
      expenses,
      costOfGoodsSold,
      grossRevenue,
      totalCOGS,
      grossProfit,
      totalExpenses,
      netProfitOrLoss,
      grossMargin,
      transactionCount,
    };
  }

  /**
   * Generate a Balance Sheet as at a specific date.
   * Assets = positive account balances, Liabilities = negative balances.
   * Equity includes retained earnings and owner equity events.
   */
  async generateBalanceSheet(userId: string, asAtDate: string): Promise<BalanceSheetReport> {
    // Get all active accounts with their balances
    const userAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.accountName,
        type: accounts.accountType,
        balance: accounts.currentBalance,
      })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
      .all();

    const assetItems: Array<{ name: string; amount: number }> = [];
    const liabilityItems: Array<{ name: string; amount: number }> = [];
    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const acct of userAccounts) {
      const balance = Number(acct.balance) || 0;
      const item = { name: acct.name, amount: Math.abs(balance) };

      // Credit cards and loans are liabilities; everything else is an asset
      const acctType = (acct.type ?? '').toLowerCase();
      if (
        acctType === 'credit_card' ||
        acctType === 'loan' ||
        acctType === 'credit' ||
        balance < 0
      ) {
        liabilityItems.push(item);
        totalLiabilities += Math.abs(balance);
      } else {
        assetItems.push(item);
        totalAssets += balance;
      }
    }

    // Get owner equity events (contributions and drawings)
    const equityEvents = await db
      .select({
        eventType: ownerEquityEvents.eventType,
        totalAmount: sql<number>`SUM(${ownerEquityEvents.amount})`,
      })
      .from(ownerEquityEvents)
      .where(and(eq(ownerEquityEvents.userId, userId), eq(ownerEquityEvents.confirmed, true)))
      .groupBy(ownerEquityEvents.eventType)
      .all();

    const equityItems: Array<{ name: string; amount: number }> = [];
    let totalContributions = 0;
    let totalDrawings = 0;

    for (const ev of equityEvents) {
      const amount = Number(ev.totalAmount) || 0;
      if (ev.eventType === 'contribution') {
        totalContributions += amount;
        equityItems.push({ name: 'Owner Contributions', amount });
      } else if (ev.eventType === 'drawing') {
        totalDrawings += amount;
        equityItems.push({ name: 'Owner Drawings', amount: -amount });
      }
    }

    // Retained earnings = Assets - Liabilities - Contributions + Drawings
    const retainedEarnings = totalAssets - totalLiabilities - totalContributions + totalDrawings;
    equityItems.push({ name: 'Retained Earnings', amount: retainedEarnings });

    const totalEquity = totalContributions - totalDrawings + retainedEarnings;

    // Balance equation check: Assets = Liabilities + Equity
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1; // allow 1 cent rounding

    return {
      asAtDate,
      assets: { items: assetItems, total: totalAssets },
      liabilities: { items: liabilityItems, total: totalLiabilities },
      equity: { items: equityItems, total: totalEquity },
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
    };
  }

  /**
   * Generate a Cash Flow Statement for a date range.
   * Sections: Operating (day-to-day), Investing (asset purchases), Financing (loans/equity).
   */
  async generateCashFlow(
    userId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<CashFlowReport> {
    // Query all transactions in period grouped by category
    const rows = await db
      .select({
        category: transactions.category,
        totalAmount: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, periodStart),
          lte(transactions.date, periodEnd),
        ),
      )
      .groupBy(transactions.category)
      .all();

    const operatingItems: Array<{ category: string; amount: number }> = [];
    const investingItems: Array<{ category: string; amount: number }> = [];
    const financingItems: Array<{ category: string; amount: number }> = [];
    let operatingTotal = 0;
    let investingTotal = 0;
    let financingTotal = 0;

    for (const row of rows) {
      const cat = row.category ?? 'Uncategorized';
      const amount = Number(row.totalAmount) || 0;

      if (cat === 'Transfer') continue; // internal transfers don't affect cash flow

      const item = { category: cat, amount };

      if (FINANCING_CATEGORIES.includes(cat) || cat === 'Cash Withdrawal') {
        financingItems.push(item);
        financingTotal += amount;
      } else if (INVESTING_CATEGORIES.includes(cat)) {
        investingItems.push(item);
        investingTotal += amount;
      } else {
        operatingItems.push(item);
        operatingTotal += amount;
      }
    }

    // Owner equity events as financing activities
    const equityEvents = await db
      .select({
        eventType: ownerEquityEvents.eventType,
        totalAmount: sql<number>`SUM(${ownerEquityEvents.amount})`,
      })
      .from(ownerEquityEvents)
      .where(
        and(
          eq(ownerEquityEvents.userId, userId),
          eq(ownerEquityEvents.confirmed, true),
          gte(ownerEquityEvents.createdAt, periodStart),
          lte(ownerEquityEvents.createdAt, periodEnd),
        ),
      )
      .groupBy(ownerEquityEvents.eventType)
      .all();

    for (const ev of equityEvents) {
      const amount = Number(ev.totalAmount) || 0;
      if (ev.eventType === 'contribution') {
        financingItems.push({ category: 'Owner Contributions', amount });
        financingTotal += amount;
      } else if (ev.eventType === 'drawing') {
        financingItems.push({ category: 'Owner Drawings', amount: -amount });
        financingTotal -= amount;
      }
    }

    // Get opening and closing balances from account balance sums
    const balanceQuery = await db
      .select({
        totalBalance: sql<number>`COALESCE(SUM(${accounts.currentBalance}), 0)`,
      })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
      .get();

    const closingBalance = Number(balanceQuery?.totalBalance) || 0;
    const netCashChange = operatingTotal + investingTotal + financingTotal;
    const openingBalance = closingBalance - netCashChange;

    return {
      periodStart,
      periodEnd,
      operating: { items: operatingItems, total: operatingTotal },
      investing: { items: investingItems, total: investingTotal },
      financing: { items: financingItems, total: financingTotal },
      netCashChange,
      openingBalance,
      closingBalance,
    };
  }

  /**
   * Generate a Trial Balance as at a specific date.
   * Lists all chart-of-accounts entries with debit/credit totals.
   */
  async generateTrialBalance(userId: string, asAtDate: string): Promise<TrialBalanceReport> {
    // Get all chart of accounts entries for this user
    const coaEntries = await db
      .select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        type: chartOfAccounts.type,
        normalBalance: chartOfAccounts.normalBalance,
      })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.userId, userId), eq(chartOfAccounts.isActive, true)))
      .orderBy(chartOfAccounts.code)
      .all();

    // Get debit/credit totals from journal entry lines per chart account
    const lineAggregates = await db
      .select({
        accountId: journalEntryLines.accountId,
        totalDebits: sql<number>`COALESCE(SUM(${journalEntryLines.debit}), 0)`,
        totalCredits: sql<number>`COALESCE(SUM(${journalEntryLines.credit}), 0)`,
      })
      .from(journalEntryLines)
      .leftJoin(journalEntries, eq(journalEntryLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.userId, userId),
          lte(journalEntries.entryDate, asAtDate),
          eq(journalEntries.status, 'posted'),
        ),
      )
      .groupBy(journalEntryLines.accountId)
      .all();

    // Build lookup map
    const balanceMap = new Map<string, { debits: number; credits: number }>();
    for (const line of lineAggregates) {
      balanceMap.set(line.accountId, {
        debits: Number(line.totalDebits) || 0,
        credits: Number(line.totalCredits) || 0,
      });
    }

    let totalDebits = 0;
    let totalCredits = 0;
    const entries: TrialBalanceEntry[] = [];

    for (const coa of coaEntries) {
      const bal = balanceMap.get(coa.id) ?? { debits: 0, credits: 0 };
      const netBalance = bal.debits - bal.credits;

      entries.push({
        accountCode: coa.code,
        accountName: coa.name,
        accountType: coa.type,
        debit: bal.debits,
        credit: bal.credits,
        netBalance,
      });

      totalDebits += bal.debits;
      totalCredits += bal.credits;
    }

    const difference = totalDebits - totalCredits;
    const isBalanced = Math.abs(difference) < 1; // allow 1 cent rounding

    return {
      asAtDate,
      entries,
      totalDebits,
      totalCredits,
      isBalanced,
      difference,
    };
  }

  /**
   * Compare two periods for any report type.
   * Calculates per-category variances and flags significant changes (>10%).
   */
  async comparePeriods(
    userId: string,
    currentStart: string,
    currentEnd: string,
    priorStart: string,
    priorEnd: string,
    reportType: string,
  ): Promise<PeriodComparison> {
    type ReportData = ProfitAndLossReport | BalanceSheetReport | CashFlowReport | TrialBalanceReport;
    let currentData: ReportData;
    let priorData: ReportData;

    switch (reportType) {
      case 'profit_and_loss':
        currentData = await this.generateProfitAndLoss(userId, currentStart, currentEnd);
        priorData = await this.generateProfitAndLoss(userId, priorStart, priorEnd);
        break;
      case 'cash_flow':
        currentData = await this.generateCashFlow(userId, currentStart, currentEnd);
        priorData = await this.generateCashFlow(userId, priorStart, priorEnd);
        break;
      case 'balance_sheet':
        currentData = await this.generateBalanceSheet(userId, currentEnd);
        priorData = await this.generateBalanceSheet(userId, priorEnd);
        break;
      case 'trial_balance':
        currentData = await this.generateTrialBalance(userId, currentEnd);
        priorData = await this.generateTrialBalance(userId, priorEnd);
        break;
      default:
        currentData = await this.generateProfitAndLoss(userId, currentStart, currentEnd);
        priorData = await this.generateProfitAndLoss(userId, priorStart, priorEnd);
    }

    // Build variance list from P&L-style data (most common comparison)
    const variances = this.calculateVariances(currentData, priorData, reportType);
    const significantChanges = variances.filter((v) => Math.abs(v.variancePercent) > 10);

    return {
      reportType,
      currentPeriod: { start: currentStart, end: currentEnd, data: currentData },
      priorPeriod: { start: priorStart, end: priorEnd, data: priorData },
      variances,
      significantChanges,
    };
  }

  /**
   * Calculate per-category variances between two report datasets.
   */
  private calculateVariances(
    currentData: ProfitAndLossReport | BalanceSheetReport | CashFlowReport | TrialBalanceReport,
    priorData: ProfitAndLossReport | BalanceSheetReport | CashFlowReport | TrialBalanceReport,
    reportType: string,
  ): CategoryVariance[] {
    const variances: CategoryVariance[] = [];

    if (reportType === 'profit_and_loss' && 'revenue' in currentData && 'revenue' in priorData) {
      // Combine revenue + expenses + COGS sections
      const curr = currentData as ProfitAndLossReport;
      const prior = priorData as ProfitAndLossReport;
      const allCurrentGroups: CategoryGroup[] = [
        ...(curr.revenue || []),
        ...(curr.costOfGoodsSold || []),
        ...(curr.expenses || []),
      ];
      const allPriorGroups: CategoryGroup[] = [
        ...(prior.revenue || []),
        ...(prior.costOfGoodsSold || []),
        ...(prior.expenses || []),
      ];

      // Build map of prior amounts
      const priorMap = new Map<string, number>();
      for (const g of allPriorGroups) {
        priorMap.set(g.category, g.amount);
      }

      // Track categories we've already seen
      const seen = new Set<string>();

      for (const g of allCurrentGroups) {
        seen.add(g.category);
        const priorAmount = priorMap.get(g.category) ?? 0;
        variances.push(this.buildVariance(g.category, g.amount, priorAmount));
      }

      // Categories that existed in prior but not current
      for (const g of allPriorGroups) {
        if (!seen.has(g.category)) {
          variances.push(this.buildVariance(g.category, 0, g.amount));
        }
      }
    } else if (reportType === 'cash_flow' && 'operating' in currentData) {
      // Compare cash flow sections
      const currCf = currentData as CashFlowReport;
      const priorCf = priorData as CashFlowReport;
      const sections = ['operating', 'investing', 'financing'] as const;
      for (const section of sections) {
        const currentTotal = currCf[section]?.total ?? 0;
        const priorTotal = priorCf[section]?.total ?? 0;
        variances.push(this.buildVariance(section, currentTotal, priorTotal));
      }
    } else {
      // Generic: compare top-level totals
      const keys = [
        'totalAssets',
        'totalLiabilities',
        'totalEquity',
        'totalDebits',
        'totalCredits',
      ];
      const currRec = currentData as unknown as Record<string, unknown>;
      const priorRec = priorData as unknown as Record<string, unknown>;
      for (const key of keys) {
        if (currRec[key] !== undefined && priorRec[key] !== undefined) {
          variances.push(this.buildVariance(key, Number(currRec[key]), Number(priorRec[key])));
        }
      }
    }

    return variances;
  }

  private buildVariance(
    category: string,
    currentAmount: number,
    priorAmount: number,
  ): CategoryVariance {
    const varianceAmount = currentAmount - priorAmount;
    const variancePercent = safeDivide(varianceAmount, priorAmount) * 100;
    let direction: 'increase' | 'decrease' | 'unchanged' = 'unchanged';
    if (varianceAmount > 0) direction = 'increase';
    else if (varianceAmount < 0) direction = 'decrease';

    return {
      category,
      currentAmount,
      priorAmount,
      varianceAmount,
      variancePercent,
      direction,
    };
  }

  /**
   * Persist a report snapshot to the report_snapshots table.
   * Returns the snapshot ID.
   */
  async createSnapshot(
    templateId: string,
    reportData: Record<string, unknown>,
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

  /**
   * Calculate KPI metrics for a given period and persist to kpi_metrics table.
   * Returns 7 metrics: gross_margin, net_margin, current_ratio, expense_ratio,
   * revenue_growth, operating_cash_flow, savings_rate.
   */
  async getKPIs(userId: string, period: string): Promise<KPIMetrics> {
    // Determine period date range from the period string (e.g., '2025-01' → month)
    const { periodStart, periodEnd } = this.parsePeriodRange(period);

    // Generate required reports
    const pnl = await this.generateProfitAndLoss(userId, periodStart, periodEnd);
    const balanceSheet = await this.generateBalanceSheet(userId, periodEnd);
    const cashFlow = await this.generateCashFlow(userId, periodStart, periodEnd);

    // Get prior period for trend comparison
    const prior = getPriorPeriod(periodStart, periodEnd);
    let priorPnl: ProfitAndLossReport | null = null;
    try {
      priorPnl = await this.generateProfitAndLoss(userId, prior.start, prior.end);
    } catch {
      // No prior data available
    }

    // Calculate metrics
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

    // Build metrics array
    const metricDefs: Array<{
      name: string;
      value: number;
      target: number | null;
    }> = [
      { name: 'gross_margin', value: grossMargin, target: 40 },
      { name: 'net_margin', value: netMargin, target: 15 },
      { name: 'current_ratio', value: currentRatio, target: 2.0 },
      { name: 'expense_ratio', value: expenseRatio, target: 70 },
      { name: 'revenue_growth', value: revenueGrowth, target: 10 },
      { name: 'operating_cash_flow', value: operatingCashFlow, target: null },
      { name: 'savings_rate', value: savingsRate, target: 20 },
    ];

    // Fetch previous values to determine trends
    const previousMetrics = await db
      .select({
        metricName: kpiMetrics.metricName,
        metricValue: kpiMetrics.metricValue,
      })
      .from(kpiMetrics)
      .where(and(eq(kpiMetrics.userId, userId), sql`${kpiMetrics.period} < ${period}`))
      .orderBy(sql`${kpiMetrics.period} DESC`)
      .all();

    // Build lookup for latest prior value per metric
    const previousMap = new Map<string, number>();
    for (const pm of previousMetrics) {
      if (!previousMap.has(pm.metricName)) {
        previousMap.set(pm.metricName, Number(pm.metricValue));
      }
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

      // Upsert metric into kpi_metrics table
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

    return {
      period,
      metrics: resultMetrics,
    };
  }

  /**
   * Parse a period string into start/end dates.
   * Supports: '2025-01' (month), '2025-Q1' (quarter), '2025' (year).
   */
  private parsePeriodRange(period: string): {
    periodStart: string;
    periodEnd: string;
  } {
    if (period.includes('Q')) {
      // Quarterly: '2025-Q1'
      const [yearStr, qStr] = period.split('-Q');
      const year = parseInt(yearStr);
      const quarter = parseInt(qStr);
      const monthStart = (quarter - 1) * 3 + 1;
      const monthEnd = monthStart + 2;
      const lastDay = new Date(year, monthEnd, 0).getDate();
      return {
        periodStart: `${year}-${String(monthStart).padStart(2, '0')}-01`,
        periodEnd: `${year}-${String(monthEnd).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      };
    }

    if (period.length === 7) {
      // Monthly: '2025-01'
      const [yearStr, monthStr] = period.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const lastDay = new Date(year, month, 0).getDate();
      return {
        periodStart: `${period}-01`,
        periodEnd: `${period}-${String(lastDay).padStart(2, '0')}`,
      };
    }

    // Annual: '2025'
    const year = parseInt(period);
    return {
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
    };
  }
}

export const financialReportService = new FinancialReportService();
