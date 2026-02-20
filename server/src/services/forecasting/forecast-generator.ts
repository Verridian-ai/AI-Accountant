/**
 * Forecast Generation Logic
 * Extracted from ForecastingService to keep files under 300 lines.
 */

import { db, forecastScenarios, forecastPeriods, transactions } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { calculateStdDev, calculateConfidenceInterval } from './types.js';

export async function generateForecast(scenarioId: string) {
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

  // Group by category -> month -> amounts
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
    const monthlyTotals: number[] = [];
    const calMonthTotals = new Map<number, number[]>();

    for (const [monthStr, amounts] of monthMap) {
      const monthTotal = amounts.reduce((s, v) => s + v, 0);
      monthlyTotals.push(monthTotal);

      const calMonth = parseInt(monthStr.split('-')[1], 10);
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

      let forecastAmount = stats.mean;
      forecastAmount *= Math.pow(1 + growthRate, i);

      const rawFactor = seasonalFactors.get(calMonth) ?? 1.0;
      const blendedFactor = 1.0 + (rawFactor - 1.0) * seasonalWeight;
      forecastAmount *= blendedFactor;
      forecastAmount = Math.round(forecastAmount);

      const ci = calculateConfidenceInterval(stats.monthlyAmounts, 0.95);
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
