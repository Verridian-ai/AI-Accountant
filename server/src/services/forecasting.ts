/**
 * Forecasting Service
 * Multi-scenario financial forecasting with confidence intervals
 * and seasonal decomposition.
 */

import { db, forecastScenarios, forecastPeriods, transactions } from '../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CreateScenarioParams {
  name: string;
  scenarioType: 'optimistic' | 'realistic' | 'pessimistic' | 'custom';
  basePeriodStart: string;
  basePeriodEnd: string;
  forecastMonths: number;
  assumptions?: Record<string, any>;
}

export interface ScenarioComparison {
  months: Array<{ period: string; scenarios: Record<string, number> }>;
  totals: Record<string, number>;
}

/** Default assumptions per scenario type */
const SCENARIO_DEFAULTS: Record<string, Record<string, any>> = {
  optimistic: { growthRate: 0.1, inflationAdjust: true, seasonalWeight: 0.8 },
  realistic: { growthRate: 0.03, inflationAdjust: true, seasonalWeight: 1.0 },
  pessimistic: { growthRate: -0.05, inflationAdjust: true, seasonalWeight: 1.2 },
};

// ============================================================================
// FORECASTING SERVICE
// ============================================================================

export class ForecastingService {
  // --------------------------------------------------------------------------
  // Scenario Management
  // --------------------------------------------------------------------------

  async createScenario(userId: string, params: CreateScenarioParams) {
    // Validate forecast months
    if (params.forecastMonths < 1 || params.forecastMonths > 60) {
      throw new Error('forecastMonths must be between 1 and 60');
    }

    const now = new Date().toISOString();
    const scenarioId = crypto.randomUUID();

    // Merge defaults with user-provided assumptions
    const defaults = SCENARIO_DEFAULTS[params.scenarioType] ?? {};
    const assumptions = { ...defaults, ...(params.assumptions ?? {}) };

    const newScenario = {
      id: scenarioId,
      userId,
      name: params.name,
      scenarioType: params.scenarioType,
      basePeriodStart: params.basePeriodStart,
      basePeriodEnd: params.basePeriodEnd,
      forecastMonths: params.forecastMonths,
      assumptions: JSON.stringify(assumptions),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(forecastScenarios).values(newScenario);

    return { ...newScenario, assumptions };
  }

  async getScenario(scenarioId: string) {
    const scenario = await db
      .select()
      .from(forecastScenarios)
      .where(eq(forecastScenarios.id, scenarioId))
      .get();

    if (!scenario) return null;

    const periods = await db
      .select()
      .from(forecastPeriods)
      .where(eq(forecastPeriods.scenarioId, scenarioId))
      .orderBy(sql`${forecastPeriods.period} ASC`)
      .all();

    return {
      ...scenario,
      assumptions:
        typeof scenario.assumptions === 'string'
          ? JSON.parse(scenario.assumptions)
          : scenario.assumptions,
      periods,
    };
  }

  async listScenarios(userId: string) {
    const scenarios = await db
      .select()
      .from(forecastScenarios)
      .where(eq(forecastScenarios.userId, userId))
      .orderBy(sql`${forecastScenarios.createdAt} DESC`)
      .all();

    return scenarios.map((s: Record<string, unknown>) => ({
      ...s,
      assumptions: typeof s.assumptions === 'string' ? JSON.parse(s.assumptions) : s.assumptions,
    }));
  }

  async deleteScenario(scenarioId: string): Promise<void> {
    // CASCADE delete handles forecast_periods
    await db.delete(forecastScenarios).where(eq(forecastScenarios.id, scenarioId));
  }

  // --------------------------------------------------------------------------
  // Forecast Generation
  // --------------------------------------------------------------------------

  async generateForecast(scenarioId: string) {
    const scenario = await db
      .select()
      .from(forecastScenarios)
      .where(eq(forecastScenarios.id, scenarioId))
      .get();

    if (!scenario) throw new Error(`Scenario not found: ${scenarioId}`);

    const assumptions =
      typeof scenario.assumptions === 'string'
        ? JSON.parse(scenario.assumptions)
        : scenario.assumptions;

    const growthRate: number = assumptions.growthRate ?? 0.03;
    const seasonalWeight: number = assumptions.seasonalWeight ?? 1.0;

    // Fetch historical transactions for the base period
    const historicalTx = await db
      .select({
        category: transactions.category,
        date: transactions.date,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, scenario.userId),
          gte(transactions.date, scenario.basePeriodStart),
          lte(transactions.date, scenario.basePeriodEnd),
          sql`${transactions.category} IS NOT NULL`,
        ),
      )
      .all();

    // Group by category → month → amounts
    const categoryData = new Map<string, Map<string, number[]>>();

    for (const tx of historicalTx) {
      const cat = tx.category as string;
      const month = tx.date.substring(0, 7); // YYYY-MM

      if (!categoryData.has(cat)) {
        categoryData.set(cat, new Map());
      }
      const monthMap = categoryData.get(cat)!;
      if (!monthMap.has(month)) {
        monthMap.set(month, []);
      }
      monthMap.get(month)!.push(Math.abs(tx.amount));
    }

    // Calculate seasonal factors per category
    const categorySeasonalFactors = new Map<string, Map<number, number>>();
    const categoryStats = new Map<
      string,
      { mean: number; stddev: number; monthlyAmounts: number[] }
    >();

    for (const [category, monthMap] of categoryData) {
      // Monthly totals
      const monthlyTotals: number[] = [];
      const calMonthTotals = new Map<number, number[]>();

      for (const [monthStr, amounts] of monthMap) {
        const monthTotal = amounts.reduce((s, v) => s + v, 0);
        monthlyTotals.push(monthTotal);

        const calMonth = parseInt(monthStr.split('-')[1]);
        if (!calMonthTotals.has(calMonth)) {
          calMonthTotals.set(calMonth, []);
        }
        calMonthTotals.get(calMonth)!.push(monthTotal);
      }

      const mean =
        monthlyTotals.length > 0
          ? monthlyTotals.reduce((s, v) => s + v, 0) / monthlyTotals.length
          : 0;

      const stddev = calculateStdDev(monthlyTotals);

      categoryStats.set(category, { mean, stddev, monthlyAmounts: monthlyTotals });

      // Seasonal factors
      const factors = new Map<number, number>();
      for (const [calMonth, totals] of calMonthTotals) {
        const monthAvg = totals.reduce((s, v) => s + v, 0) / totals.length;
        factors.set(calMonth, mean > 0 ? monthAvg / mean : 1.0);
      }
      categorySeasonalFactors.set(category, factors);
    }

    // Generate forecast periods
    const forecastStart = new Date(scenario.basePeriodEnd);
    forecastStart.setMonth(forecastStart.getMonth() + 1);
    const generatedPeriods: Record<string, unknown>[] = [];

    // Clear existing forecast periods for this scenario
    await db.delete(forecastPeriods).where(eq(forecastPeriods.scenarioId, scenarioId));

    for (const [category, stats] of categoryStats) {
      const seasonalFactors = categorySeasonalFactors.get(category)!;

      // Check seasonal variance to determine method
      const factorValues = Array.from(seasonalFactors.values());
      const factorVariance =
        factorValues.length > 1
          ? calculateStdDev(factorValues) /
            (factorValues.reduce((s, v) => s + v, 0) / factorValues.length)
          : 0;
      const useSeasonalDecomp = factorVariance > 0.2;

      for (let i = 0; i < scenario.forecastMonths; i++) {
        const forecastDate = new Date(forecastStart);
        forecastDate.setMonth(forecastDate.getMonth() + i);
        const periodStr = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
        const calMonth = forecastDate.getMonth() + 1;

        // 1. Base amount from historical average
        let forecastAmount = stats.mean;

        // 2. Apply growth rate: base * (1 + growthRate) ^ monthIndex
        forecastAmount *= Math.pow(1 + growthRate, i);

        // 3. Apply seasonal factor (weighted)
        const rawFactor = seasonalFactors.get(calMonth) ?? 1.0;
        const blendedFactor = 1.0 + (rawFactor - 1.0) * seasonalWeight;
        forecastAmount *= blendedFactor;

        forecastAmount = Math.round(forecastAmount);

        // 4. Confidence interval: mean ± (1.96 * stddev) for 95% CI
        const ci = calculateConfidenceInterval(stats.monthlyAmounts, 0.95);

        // Scale CI with growth
        const growthMultiplier = Math.pow(1 + growthRate, i);
        const confidenceLower = Math.round(ci.lower * growthMultiplier * blendedFactor);
        const confidenceUpper = Math.round(ci.upper * growthMultiplier * blendedFactor);

        const method = useSeasonalDecomp ? 'seasonal_decomposition' : 'linear_trend';

        const periodRecord = {
          id: crypto.randomUUID(),
          scenarioId,
          period: periodStr,
          category,
          forecastAmount,
          confidenceLower,
          confidenceUpper,
          method,
        };

        await db.insert(forecastPeriods).values(periodRecord);
        generatedPeriods.push(periodRecord);
      }
    }

    // Update scenario status
    await db
      .update(forecastScenarios)
      .set({ status: 'active', updatedAt: new Date().toISOString() })
      .where(eq(forecastScenarios.id, scenarioId));

    return generatedPeriods;
  }

  // --------------------------------------------------------------------------
  // Comparison
  // --------------------------------------------------------------------------

  async compareScenarios(scenarioIds: string[]): Promise<ScenarioComparison> {
    const monthTotals = new Map<string, Record<string, number>>();
    const scenarioTotals: Record<string, number> = {};

    for (const scenarioId of scenarioIds) {
      const periods = await db
        .select()
        .from(forecastPeriods)
        .where(eq(forecastPeriods.scenarioId, scenarioId))
        .all();

      let total = 0;

      for (const period of periods) {
        if (!monthTotals.has(period.period)) {
          monthTotals.set(period.period, {});
        }
        const existing = monthTotals.get(period.period)![scenarioId] ?? 0;
        monthTotals.get(period.period)![scenarioId] = existing + period.forecastAmount;
        total += period.forecastAmount;
      }

      scenarioTotals[scenarioId] = total;
    }

    // Sort months chronologically
    const sortedMonths = Array.from(monthTotals.keys()).sort();

    return {
      months: sortedMonths.map((period) => ({
        period,
        scenarios: monthTotals.get(period) ?? {},
      })),
      totals: scenarioTotals,
    };
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  calculateSeasonalFactors(
    txData: Array<{ date: string; amount: number }>,
    _months: number,
  ): Map<number, number> {
    const monthTotals = new Map<number, number[]>();

    for (const tx of txData) {
      const calMonth = parseInt(tx.date.substring(5, 7));
      if (!monthTotals.has(calMonth)) {
        monthTotals.set(calMonth, []);
      }
      monthTotals.get(calMonth)!.push(Math.abs(tx.amount));
    }

    // Calculate average per calendar month
    const monthAverages = new Map<number, number>();
    let overallTotal = 0;
    let overallCount = 0;

    for (const [month, amounts] of monthTotals) {
      const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      monthAverages.set(month, avg);
      overallTotal += amounts.reduce((s, v) => s + v, 0);
      overallCount += amounts.length;
    }

    const overallAvg = overallCount > 0 ? overallTotal / overallCount : 1;

    // Seasonal factor = month average / overall average
    const factors = new Map<number, number>();
    for (const [month, avg] of monthAverages) {
      factors.set(month, overallAvg > 0 ? avg / overallAvg : 1.0);
    }

    return factors;
  }
}

// ============================================================================
// STATISTICAL UTILITY FUNCTIONS
// ============================================================================

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((s, v) => s + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Calculate confidence interval: mean ± (z-score × stddev / sqrt(n)) */
export function calculateConfidenceInterval(
  values: number[],
  confidenceLevel: number,
): { lower: number; upper: number } {
  if (values.length === 0) return { lower: 0, upper: 0 };
  if (values.length === 1) return { lower: values[0], upper: values[0] };

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const stddev = calculateStdDev(values);

  // z-score lookup
  let zScore: number;
  if (confidenceLevel >= 0.99) {
    zScore = 2.576;
  } else if (confidenceLevel >= 0.95) {
    zScore = 1.96;
  } else if (confidenceLevel >= 0.9) {
    zScore = 1.645;
  } else {
    zScore = 1.28; // ~80%
  }

  const marginOfError = (zScore * stddev) / Math.sqrt(values.length);

  return {
    lower: Math.round(mean - marginOfError),
    upper: Math.round(mean + marginOfError),
  };
}

export const forecastingService = new ForecastingService();
