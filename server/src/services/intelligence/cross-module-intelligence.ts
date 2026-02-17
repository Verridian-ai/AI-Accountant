/**
 * Cross-Module Intelligence Service — Orchestrator
 *
 * Delegates scanning, CRUD, timeline, and correlations to sub-modules.
 */
import { db, crossModuleInsights, moduleConnections } from '../../schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import type {
  CrossModuleInsight,
  Correlation,
  ModuleConnection,
  TimelineEntry,
  InsightScanOptions,
  InsightFilters,
  ConnectionFilters,
  TimeRange,
} from './types.js';
import { deduplicateInsights } from './helpers.js';
import { calculatePearsonCorrelation, getModuleMetrics } from './correlation.js';
import { generateTimeline as generateTimelineImpl } from './timeline.js';
import {
  getInsights as getInsightsImpl,
  getInsightById as getInsightByIdImpl,
  markInsightViewed as markInsightViewedImpl,
  actOnInsight as actOnInsightImpl,
  dismissInsight as dismissInsightImpl,
} from './insight-crud.js';
import { scanAnomalyCascades } from './scanners/anomaly-cascade.js';
import { scanTrendAlignments } from './scanners/trend-alignment.js';
import { scanComplianceRisks } from './scanners/compliance-risk.js';
import { scanForecastDeviations } from './scanners/forecast-deviation.js';
import { scanTaxOpportunities } from './scanners/tax-opportunity.js';
import { scanSpendingPatterns } from './scanners/spending-pattern.js';

export class CrossModuleIntelligenceService {
  // --------------------------------------------------------------------------
  // PUBLIC: Scan & Discover
  // --------------------------------------------------------------------------

  /**
   * Run all 6 insight scanners, de-duplicate, rank, and persist new insights.
   */
  async scanForInsights(
    userId: string,
    options: InsightScanOptions = {},
  ): Promise<CrossModuleInsight[]> {
    const { modules, timeRange, minConfidence = 0.5, severityFilter, maxInsights = 50 } = options;

    const range: TimeRange = timeRange ?? {
      start: new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
    };

    // Run all scanners concurrently -- each returns [] on failure
    const results = await Promise.allSettled([
      scanAnomalyCascades(userId, range),
      scanTrendAlignments(userId, range),
      scanComplianceRisks(userId, range),
      scanForecastDeviations(userId, range),
      scanTaxOpportunities(userId, range),
      scanSpendingPatterns(userId, range),
    ]);

    let allInsights: CrossModuleInsight[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        allInsights.push(...r.value);
      }
    }

    // Filter by requested modules
    if (modules?.length) {
      allInsights = allInsights.filter((i) => i.sourceModules.some((m) => modules.includes(m)));
    }

    // Filter by confidence
    allInsights = allInsights.filter((i) => i.confidence >= minConfidence);

    // Filter by severity
    if (severityFilter?.length) {
      allInsights = allInsights.filter((i) => severityFilter.includes(i.severity));
    }

    // De-duplicate
    allInsights = deduplicateInsights(allInsights);

    // Rank: critical > warning > suggestion > info, then by confidence desc
    const severityOrder: Record<string, number> = {
      critical: 4,
      warning: 3,
      suggestion: 2,
      info: 1,
    };
    allInsights.sort((a, b) => {
      const sevDiff = (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return b.confidence - a.confidence;
    });

    // Trim to maxInsights
    allInsights = allInsights.slice(0, maxInsights);

    // Persist new insights
    for (const insight of allInsights) {
      try {
        await (db as any)
          .insert(crossModuleInsights)
          .values({
            id: insight.id,
            userId: insight.userId,
            insightType: insight.insightType,
            title: insight.title,
            description: insight.description,
            severity: insight.severity,
            sourceModules: JSON.stringify(insight.sourceModules),
            relatedEntities: JSON.stringify(insight.relatedEntities),
            timeRangeStart: insight.timeRangeStart,
            timeRangeEnd: insight.timeRangeEnd,
            confidence: insight.confidence,
            evidence: JSON.stringify(insight.evidence),
            recommendedAction: insight.recommendedAction,
            status: insight.status,
            createdAt: insight.createdAt,
            expiresAt: insight.expiresAt,
          })
          .run();
      } catch {
        // Duplicate or DB error -- skip silently
      }
    }

    return allInsights;
  }

  /**
   * Find statistical correlations between two modules' metrics.
   * Returns significant correlations where |r| > 0.6.
   */
  async findCorrelations(userId: string, moduleA: string, moduleB: string): Promise<Correlation[]> {
    const now = new Date();
    const range: TimeRange = {
      start: new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    };

    const metricsA = await getModuleMetrics(userId, moduleA, range);
    const metricsB = await getModuleMetrics(userId, moduleB, range);

    const correlations: Correlation[] = [];

    for (const [nameA, valuesA] of Object.entries(metricsA)) {
      for (const [nameB, valuesB] of Object.entries(metricsB)) {
        const len = Math.min(valuesA.length, valuesB.length);
        if (len < 5) continue;

        const x = valuesA.slice(0, len);
        const y = valuesB.slice(0, len);
        const { coefficient, pValue } = calculatePearsonCorrelation(x, y);

        if (Math.abs(coefficient) > 0.6 && pValue < 0.05) {
          const direction = coefficient > 0 ? 'positive' : 'negative';
          const strength =
            Math.abs(coefficient) > 0.9
              ? 'very strong'
              : Math.abs(coefficient) > 0.75
                ? 'strong'
                : 'moderate';

          correlations.push({
            moduleA,
            metricA: nameA,
            moduleB,
            metricB: nameB,
            coefficient: Math.round(coefficient * 1000) / 1000,
            pValue: Math.round(pValue * 10000) / 10000,
            sampleSize: len,
            timeRange: range,
            interpretation: `${strength} ${direction} correlation between ${nameA} (${moduleA}) and ${nameB} (${moduleB}): as one increases, the other ${direction === 'positive' ? 'also increases' : 'decreases'}.`,
          });
        }
      }
    }

    return correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  }

  // --------------------------------------------------------------------------
  // PUBLIC: Module Connections
  // --------------------------------------------------------------------------

  async getModuleConnections(filters: ConnectionFilters = {}): Promise<ModuleConnection[]> {
    const conditions: any[] = [];

    if (filters.sourceModule) {
      conditions.push(eq(moduleConnections.sourceModule, filters.sourceModule));
    }
    if (filters.targetModule) {
      conditions.push(eq(moduleConnections.targetModule, filters.targetModule));
    }
    if (filters.connectionType) {
      conditions.push(eq(moduleConnections.connectionType, filters.connectionType));
    }
    if (filters.minStrength != null) {
      conditions.push(gte(moduleConnections.strength, filters.minStrength));
    }

    const query = (db as any).select().from(moduleConnections);
    const rows: any[] =
      conditions.length > 0 ? await query.where(and(...conditions)).all() : await query.all();

    return rows.map((r: any) => ({
      id: r.id,
      sourceModule: r.sourceModule ?? r.source_module,
      targetModule: r.targetModule ?? r.target_module,
      connectionType: r.connectionType ?? r.connection_type,
      description: r.description,
      strength: r.strength,
      isBidirectional: Boolean(r.isBidirectional ?? r.is_bidirectional),
      activityCount: r.activityCount ?? r.activity_count ?? 0,
      lastActivityAt: r.lastActivityAt ?? r.last_activity_at ?? null,
    }));
  }

  async updateConnectionActivity(
    sourceModule: string,
    targetModule: string,
    connectionType: string,
  ): Promise<void> {
    await (db as any)
      .update(moduleConnections)
      .set({
        activityCount: sql`${moduleConnections.activityCount} + 1`,
        lastActivityAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(moduleConnections.sourceModule, sourceModule),
          eq(moduleConnections.targetModule, targetModule),
          eq(moduleConnections.connectionType, connectionType),
        ),
      )
      .run();
  }

  // --------------------------------------------------------------------------
  // PUBLIC: Delegated methods
  // --------------------------------------------------------------------------

  async generateTimeline(userId: string, timeRange: TimeRange): Promise<TimelineEntry[]> {
    return generateTimelineImpl(userId, timeRange);
  }

  async getInsights(
    userId: string,
    filters: InsightFilters = {},
  ): Promise<{ items: CrossModuleInsight[]; total: number }> {
    return getInsightsImpl(userId, filters);
  }

  async getInsightById(insightId: string): Promise<CrossModuleInsight | null> {
    return getInsightByIdImpl(insightId);
  }

  async markInsightViewed(insightId: string): Promise<void> {
    return markInsightViewedImpl(insightId);
  }

  async actOnInsight(insightId: string, _action?: string): Promise<void> {
    return actOnInsightImpl(insightId, _action);
  }

  async dismissInsight(insightId: string): Promise<void> {
    return dismissInsightImpl(insightId);
  }

  /**
   * Exposed for backward compatibility.
   * Delegates to the standalone calculatePearsonCorrelation function.
   */
  _calculatePearsonCorrelation(x: number[], y: number[]): { coefficient: number; pValue: number } {
    return calculatePearsonCorrelation(x, y);
  }
}
