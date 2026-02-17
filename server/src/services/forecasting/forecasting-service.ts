/**
 * Forecasting Service
 * Multi-scenario financial forecasting with confidence intervals
 * and seasonal decomposition.
 */

import { db, forecastScenarios, forecastPeriods } from '../../schema.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type { CreateScenarioParams, ScenarioComparison } from './types.js';
import { SCENARIO_DEFAULTS } from './types.js';
import { generateForecast as generateForecastImpl } from './forecast-generator.js';

// ============================================================================
// FORECASTING SERVICE
// ============================================================================

export class ForecastingService {
  // --------------------------------------------------------------------------
  // Scenario Management
  // --------------------------------------------------------------------------

  async createScenario(userId: string, params: CreateScenarioParams) {
    if (params.forecastMonths < 1 || params.forecastMonths > 60) {
      throw new Error('forecastMonths must be between 1 and 60');
    }

    const now = new Date().toISOString();
    const scenarioId = crypto.randomUUID();

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

    return scenarios.map((s: any) => ({
      ...s,
      assumptions: typeof s.assumptions === 'string' ? JSON.parse(s.assumptions) : s.assumptions,
    }));
  }

  async deleteScenario(scenarioId: string): Promise<void> {
    await db.delete(forecastScenarios).where(eq(forecastScenarios.id, scenarioId));
  }

  // --------------------------------------------------------------------------
  // Forecast Generation (delegated)
  // --------------------------------------------------------------------------

  async generateForecast(scenarioId: string) {
    return generateForecastImpl(scenarioId);
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

    const factors = new Map<number, number>();
    for (const [month, avg] of monthAverages) {
      factors.set(month, overallAvg > 0 ? avg / overallAvg : 1.0);
    }

    return factors;
  }
}
