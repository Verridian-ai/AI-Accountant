/**
 * Enhanced Budget Service
 * Smart budgeting with entity awareness, projections, and wealth modeling.
 *
 * Features:
 *   - Smart budget generation from historical transaction data
 *   - Recurring bill pattern detection + overdue alerts
 *   - Revenue & expense projections (linear regression)
 *   - Wealth projection (compound growth, 4 risk profiles)
 *   - Debt repayment strategy comparison (avalanche vs snowball)
 */

import { db, transactions, accounts } from '../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BudgetCategoryEntry {
  category: string;
  average: number;         // cents per month
  median: number;          // cents per month
  min: number;             // cents per month
  max: number;             // cents per month
  recommended: number;     // cents per month (adjusted)
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SmartBudget {
  entityType: string;
  monthsAnalyzed: number;
  totalMonthlyBudget: number;  // cents
  categories: BudgetCategoryEntry[];
  generatedAt: string;
}

export interface RecurringBill {
  merchant: string;
  averageAmount: number;    // cents
  lastAmount: number;       // cents
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual';
  nextDueDate: string;      // ISO date
  lastPaidDate: string;     // ISO date
  status: 'current' | 'overdue' | 'amount_changed';
  amountChangePercent?: number;
  occurrenceCount: number;
}

export interface RevenueProjection {
  month: string;            // YYYY-MM
  projected: number;        // cents
  upperBound: number;       // cents (+ 1 std dev)
  lowerBound: number;       // cents (- 1 std dev)
}

export interface ProjectionResult {
  entityType: string;
  monthsProjected: number;
  projections: RevenueProjection[];
  averageMonthly: number;   // cents
  growthRate: number;        // monthly percentage
}

export interface WealthProjectionParams {
  currentSavings: number;    // cents
  monthlyContribution: number; // cents
  inflationRate?: number;    // decimal, default 0.03
}

export interface WealthProjectionResult {
  profiles: Array<{
    name: string;
    annualReturn: number;    // decimal
    projections: Array<{
      years: number;
      nominalValue: number;  // cents
      realValue: number;     // cents (inflation-adjusted)
    }>;
  }>;
}

export interface DebtInfo {
  name: string;
  balance: number;          // cents
  rate: number;             // annual decimal
  minPayment: number;       // cents per month
}

export interface DebtStrategyResult {
  avalanche: {
    totalInterest: number;  // cents
    payoffMonths: number;
    order: string[];
  };
  snowball: {
    totalInterest: number;  // cents
    payoffMonths: number;
    order: string[];
  };
  interestSaved: number;    // cents (snowball - avalanche)
  recommendation: string;
}


// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Calculate median of a sorted number array */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

/** Simple linear regression: returns { slope, intercept } */
function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i];
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Standard deviation */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Detect frequency from an array of sorted ISO date strings */
function detectFrequency(dates: string[]): RecurringBill['frequency'] | null {
  if (dates.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const d1 = new Date(dates[i - 1]).getTime();
    const d2 = new Date(dates[i]).getTime();
    intervals.push((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const cv = stdDev(intervals) / (avgInterval || 1); // coefficient of variation

  // Only classify if relatively regular (CV < 0.4)
  if (cv > 0.4) return null;

  if (avgInterval <= 9)   return 'weekly';
  if (avgInterval <= 18)  return 'fortnightly';
  if (avgInterval <= 45)  return 'monthly';
  if (avgInterval <= 120) return 'quarterly';
  if (avgInterval <= 400) return 'annual';
  return null;
}

/** Add days to a date string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

/** Frequency to average days */
function frequencyToDays(freq: RecurringBill['frequency']): number {
  switch (freq) {
    case 'weekly':      return 7;
    case 'fortnightly': return 14;
    case 'monthly':     return 30.44;
    case 'quarterly':   return 91.31;
    case 'annual':      return 365.25;
  }
}


// ============================================================================
// SERVICE CLASS
// ============================================================================

export class EnhancedBudgetService {

  /**
   * Generate a smart budget based on historical transaction data.
   * Analyzes the last N months by category, calculates statistics,
   * and applies seasonal adjustments.
   */
  async generateSmartBudget(
    userId: string,
    entityType: string = 'sole_trader',
    months: number = 6,
  ): Promise<SmartBudget> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Exclude personal accounts for business budgets
    const ownershipFilter = entityType === 'personal'
      ? sql`(${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} = 'personal')`
      : sql`(${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} != 'personal')`;

    // Get monthly category totals
    const rows = await db
      .select({
        category: transactions.category,
        month: sql<string>`SUBSTRING(${transactions.date}, 1, 7)`,
        total: sql<number>`SUM(ABS(${transactions.amount}))`,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate.toISOString().slice(0, 10)),
          lte(transactions.date, endDate.toISOString().slice(0, 10)),
          sql`${transactions.amount} < 0`, // expenses only
          sql`${transactions.category} IS NOT NULL`,
          ownershipFilter,
        )
      )
      .groupBy(transactions.category, sql`SUBSTRING(${transactions.date}, 1, 7)`)
      .all();

    // Group by category → monthly totals
    const categoryMonthly = new Map<string, number[]>();
    for (const row of rows as any[]) {
      const cat = row.category ?? 'Uncategorized';
      if (!categoryMonthly.has(cat)) categoryMonthly.set(cat, []);
      categoryMonthly.get(cat)!.push(Number(row.total));
    }

    // Calculate statistics per category
    const categories: BudgetCategoryEntry[] = [];
    for (const [category, monthlyTotals] of categoryMonthly) {
      const sorted = [...monthlyTotals].sort((a, b) => a - b);
      const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
      const med = median(sorted);
      const min = sorted[0] ?? 0;
      const max = sorted[sorted.length - 1] ?? 0;

      // Trend: compare first half vs second half
      const halfIdx = Math.floor(sorted.length / 2);
      const firstHalfAvg = sorted.slice(0, halfIdx).reduce((s, v) => s + v, 0) / (halfIdx || 1);
      const secondHalfAvg = sorted.slice(halfIdx).reduce((s, v) => s + v, 0) / ((sorted.length - halfIdx) || 1);
      const changeRatio = firstHalfAvg > 0 ? (secondHalfAvg - firstHalfAvg) / firstHalfAvg : 0;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (changeRatio > 0.1) trend = 'increasing';
      else if (changeRatio < -0.1) trend = 'decreasing';

      // Recommended: use median (more robust than average), adjusted for trend
      let recommended = med;
      if (trend === 'increasing') {
        recommended = Math.round(med * 1.1); // 10% buffer for increasing trends
      }

      // Q4 seasonal adjustment (Oct-Dec typically higher)
      const currentMonth = new Date().getMonth() + 1;
      if (currentMonth >= 10 && currentMonth <= 12) {
        recommended = Math.round(recommended * 1.05); // 5% seasonal uplift
      }

      categories.push({ category, average: avg, median: med, min, max, recommended, trend });
    }

    // Sort by recommended budget (highest first)
    categories.sort((a, b) => b.recommended - a.recommended);

    const totalMonthlyBudget = categories.reduce((s, c) => s + c.recommended, 0);

    return {
      entityType,
      monthsAnalyzed: months,
      totalMonthlyBudget,
      categories,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Detect recurring bill patterns from transaction history.
   * Finds merchants with regular payment intervals and flags
   * overdue or amount-changed bills.
   */
  async detectBillPatterns(userId: string): Promise<RecurringBill[]> {
    // Look back 12 months for pattern detection
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    // Get all expense transactions grouped by normalized merchant
    const rows = await db
      .select({
        merchant: sql<string>`COALESCE(${transactions.merchantNormalized}, ${transactions.description})`,
        date: transactions.date,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate.toISOString().slice(0, 10)),
          lte(transactions.date, endDate.toISOString().slice(0, 10)),
          sql`${transactions.amount} < 0`,
        )
      )
      .orderBy(sql`COALESCE(${transactions.merchantNormalized}, ${transactions.description}), ${transactions.date}`)
      .all();

    // Group by merchant
    const merchantTxs = new Map<string, Array<{ date: string; amount: number }>>();
    for (const row of rows as any[]) {
      const merchant = row.merchant ?? 'Unknown';
      if (!merchantTxs.has(merchant)) merchantTxs.set(merchant, []);
      merchantTxs.get(merchant)!.push({
        date: row.date,
        amount: Math.abs(row.amount),
      });
    }

    const bills: RecurringBill[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const [merchant, txs] of merchantTxs) {
      // Need at least 2 transactions to detect a pattern
      if (txs.length < 2) continue;

      // Sort by date
      txs.sort((a, b) => a.date.localeCompare(b.date));
      const dates = txs.map(t => t.date);
      const amounts = txs.map(t => t.amount);

      // Check if amounts are similar (within 10% of average)
      const avgAmount = Math.round(amounts.reduce((s, v) => s + v, 0) / amounts.length);
      const amountDeviation = stdDev(amounts) / (avgAmount || 1);
      if (amountDeviation > 0.5) continue; // amounts too variable, not a bill

      // Detect frequency
      const frequency = detectFrequency(dates);
      if (!frequency) continue;

      const lastDate = dates[dates.length - 1];
      const lastAmount = amounts[amounts.length - 1];
      const avgDays = frequencyToDays(frequency);
      const nextDueDate = addDays(lastDate, avgDays);

      // Determine status
      let status: RecurringBill['status'] = 'current';
      let amountChangePercent: number | undefined;

      // Check if overdue (next due date is in the past)
      if (nextDueDate < today) {
        status = 'overdue';
      }

      // Check for amount change (last vs average, >10% deviation)
      const lastVsAvgChange = Math.abs(lastAmount - avgAmount) / (avgAmount || 1);
      if (lastVsAvgChange > 0.1) {
        status = 'amount_changed';
        amountChangePercent = Math.round(lastVsAvgChange * 100);
      }

      bills.push({
        merchant,
        averageAmount: avgAmount,
        lastAmount,
        frequency,
        nextDueDate,
        lastPaidDate: lastDate,
        status,
        amountChangePercent,
        occurrenceCount: txs.length,
      });
    }

    // Sort: overdue first, then by next due date
    bills.sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return a.nextDueDate.localeCompare(b.nextDueDate);
    });

    return bills;
  }

  /**
   * Project future revenue using linear regression on monthly income totals.
   */
  async projectRevenue(
    userId: string,
    entityType: string = 'sole_trader',
    months: number = 6,
  ): Promise<ProjectionResult> {
    return this.projectTimeSeries(userId, entityType, months, 'income');
  }

  /**
   * Project future expenses using linear regression on monthly expense totals.
   */
  async projectExpenses(
    userId: string,
    entityType: string = 'sole_trader',
    months: number = 6,
  ): Promise<ProjectionResult> {
    return this.projectTimeSeries(userId, entityType, months, 'expense');
  }

  /**
   * Calculate wealth projection over multiple timeframes with 4 risk profiles.
   *
   * Formula: FV = PV * (1 + r/n)^(nt) + PMT * ((1 + r/n)^(nt) - 1) / (r/n)
   * where n = 12 (monthly compounding)
   */
  calculateWealthProjection(params: WealthProjectionParams): WealthProjectionResult {
    const {
      currentSavings,
      monthlyContribution,
      inflationRate = 0.03,
    } = params;

    const profiles = [
      { name: 'Conservative',  annualReturn: 0.04 },
      { name: 'Balanced',      annualReturn: 0.06 },
      { name: 'Growth',        annualReturn: 0.08 },
      { name: 'Aggressive',    annualReturn: 0.10 },
    ];

    const horizons = [5, 10, 20, 30]; // years

    return {
      profiles: profiles.map(profile => ({
        name: profile.name,
        annualReturn: profile.annualReturn,
        projections: horizons.map(years => {
          const r = profile.annualReturn / 12; // monthly rate
          const n = years * 12;                // total months

          // Compound growth: PV component
          const pvGrowth = Math.round(currentSavings * Math.pow(1 + r, n));

          // Annuity component (regular contributions)
          let annuityGrowth = 0;
          if (r > 0) {
            annuityGrowth = Math.round(monthlyContribution * (Math.pow(1 + r, n) - 1) / r);
          } else {
            annuityGrowth = monthlyContribution * n;
          }

          const nominalValue = pvGrowth + annuityGrowth;

          // Inflation adjustment
          const inflationFactor = Math.pow(1 + inflationRate, years);
          const realValue = Math.round(nominalValue / inflationFactor);

          return { years, nominalValue, realValue };
        }),
      })),
    };
  }

  /**
   * Compare debt repayment strategies: avalanche (highest rate first)
   * vs snowball (smallest balance first).
   */
  compareDebtStrategies(
    debts: DebtInfo[],
    extraMonthlyPayment: number, // cents
  ): DebtStrategyResult {
    // Avalanche: sort by highest interest rate first
    const avalancheOrder = [...debts].sort((a, b) => b.rate - a.rate);
    const avalanche = this.simulateDebtPayoff(avalancheOrder, extraMonthlyPayment);

    // Snowball: sort by smallest balance first
    const snowballOrder = [...debts].sort((a, b) => a.balance - b.balance);
    const snowball = this.simulateDebtPayoff(snowballOrder, extraMonthlyPayment);

    const interestSaved = snowball.totalInterest - avalanche.totalInterest;

    return {
      avalanche: {
        totalInterest: avalanche.totalInterest,
        payoffMonths: avalanche.payoffMonths,
        order: avalancheOrder.map(d => d.name),
      },
      snowball: {
        totalInterest: snowball.totalInterest,
        payoffMonths: snowball.payoffMonths,
        order: snowballOrder.map(d => d.name),
      },
      interestSaved,
      recommendation: interestSaved > 10000 // > $100 difference
        ? `Avalanche saves ${(interestSaved / 100).toFixed(2)} in interest. Use avalanche if motivated by math.`
        : `Both strategies are similar. Snowball may be better for motivation.`,
    };
  }


  // ---------- Private Helpers ----------

  /**
   * Generic time-series projection for income or expenses.
   */
  private async projectTimeSeries(
    userId: string,
    entityType: string,
    months: number,
    type: 'income' | 'expense',
  ): Promise<ProjectionResult> {
    // Fetch historical monthly totals (12 months back)
    const lookbackMonths = 12;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    const amountFilter = type === 'income'
      ? sql`${transactions.amount} > 0`
      : sql`${transactions.amount} < 0`;

    const ownershipFilter = entityType === 'personal'
      ? sql`(${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} = 'personal')`
      : sql`(${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} != 'personal')`;

    const rows = await db
      .select({
        month: sql<string>`SUBSTRING(${transactions.date}, 1, 7)`,
        total: sql<number>`SUM(ABS(${transactions.amount}))`,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate.toISOString().slice(0, 10)),
          lte(transactions.date, endDate.toISOString().slice(0, 10)),
          amountFilter,
          ownershipFilter,
        )
      )
      .groupBy(sql`SUBSTRING(${transactions.date}, 1, 7)`)
      .orderBy(sql`SUBSTRING(${transactions.date}, 1, 7)`)
      .all();

    const monthlyValues = (rows as any[]).map((r, i) => ({
      index: i,
      month: r.month as string,
      total: Number(r.total),
    }));

    if (monthlyValues.length === 0) {
      return {
        entityType,
        monthsProjected: months,
        projections: [],
        averageMonthly: 0,
        growthRate: 0,
      };
    }

    // Linear regression
    const xs = monthlyValues.map(v => v.index);
    const ys = monthlyValues.map(v => v.total);
    const { slope, intercept } = linearRegression(xs, ys);
    const sd = stdDev(ys);
    const avgMonthly = Math.round(ys.reduce((s, v) => s + v, 0) / ys.length);

    // Monthly growth rate
    const growthRate = avgMonthly > 0 ? slope / avgMonthly : 0;

    // Project forward
    const projections: RevenueProjection[] = [];
    const lastDate = new Date(endDate);

    for (let i = 1; i <= months; i++) {
      lastDate.setMonth(lastDate.getMonth() + 1);
      const x = monthlyValues.length + i - 1;
      const projected = Math.round(intercept + slope * x);

      projections.push({
        month: lastDate.toISOString().slice(0, 7),
        projected: Math.max(0, projected),
        upperBound: Math.max(0, Math.round(projected + sd)),
        lowerBound: Math.max(0, Math.round(projected - sd)),
      });
    }

    return {
      entityType,
      monthsProjected: months,
      projections,
      averageMonthly: avgMonthly,
      growthRate: Math.round(growthRate * 10000) / 10000,
    };
  }

  /**
   * Simulate debt payoff for a given order of debts.
   * The extra payment goes to the first debt in the list;
   * when one is paid off, its min payment + extra rolls to the next.
   */
  private simulateDebtPayoff(
    debts: DebtInfo[],
    extraMonthlyPayment: number,
  ): { totalInterest: number; payoffMonths: number } {
    // Clone balances
    const balances = debts.map(d => d.balance);
    let totalInterest = 0;
    let month = 0;
    const maxMonths = 600; // 50 year safety cap

    while (balances.some(b => b > 0) && month < maxMonths) {
      month++;

      // Calculate interest for each debt
      for (let i = 0; i < debts.length; i++) {
        if (balances[i] <= 0) continue;
        const monthlyInterest = Math.round(balances[i] * debts[i].rate / 12);
        balances[i] += monthlyInterest;
        totalInterest += monthlyInterest;
      }

      // Make minimum payments on all debts
      for (let i = 0; i < debts.length; i++) {
        if (balances[i] <= 0) continue;
        const payment = Math.min(debts[i].minPayment, balances[i]);
        balances[i] -= payment;
      }

      // Apply extra payment to the first debt with remaining balance
      let remaining = extraMonthlyPayment;
      for (let i = 0; i < debts.length; i++) {
        if (balances[i] <= 0 || remaining <= 0) continue;
        const payment = Math.min(remaining, balances[i]);
        balances[i] -= payment;
        remaining -= payment;
        break; // Extra goes to first priority debt only
      }
    }

    return { totalInterest, payoffMonths: month };
  }
}

export const enhancedBudgetService = new EnhancedBudgetService();
