// ============================================================================
// CrossModuleIntelligenceService — thin shell delegating to sub-modules
// ============================================================================

import { db, crossModuleInsights, moduleConnections } from '../../schema.js';
import { eq, and, desc, gte, lte, sql, type SQL } from 'drizzle-orm';
import { calculatePearsonCorrelation } from './math-utils.js';
import { deduplicateInsights, rowToInsight } from './insight-helpers.js';
import { getModuleMetrics } from './module-metrics.js';
import {
  scanAnomalyCascades,
  scanTrendAlignments,
  scanComplianceRisks,
  scanForecastDeviations,
  scanTaxOpportunities,
  scanSpendingPatterns,
} from './scanners.js';
import { generateTimeline as generateTimelineFn } from './service-timeline.js';
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
import type { ModuleConnectionRow, CrossModuleInsightRow } from './db-types.js';

export class CrossModuleIntelligenceService {
  // --------------------------------------------------------------------------
  // PUBLIC: Scan & Discover
  // --------------------------------------------------------------------------

  async scanForInsights(
    userId: string,
    options: InsightScanOptions = {},
  ): Promise<CrossModuleInsight[]> {
    const { modules, timeRange, minConfidence = 0.5, severityFilter, maxInsights = 50 } = options;

    const range: TimeRange = timeRange ?? {
      start: new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
    };

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
      if (r.status === 'fulfilled') allInsights.push(...r.value);
    }

    if (modules?.length) {
      allInsights = allInsights.filter((i) => i.sourceModules.some((m) => modules.includes(m)));
    }
    allInsights = allInsights.filter((i) => i.confidence >= minConfidence);
    if (severityFilter?.length) {
      allInsights = allInsights.filter((i) => severityFilter.includes(i.severity));
    }

    allInsights = deduplicateInsights(allInsights);

    const severityOrder: Record<string, number> = {
      critical: 4,
      warning: 3,
      suggestion: 2,
      info: 1,
    };
    allInsights.sort((a, b) => {
      const sevDiff = (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
      return sevDiff !== 0 ? sevDiff : b.confidence - a.confidence;
    });

    allInsights = allInsights.slice(0, maxInsights);

    for (const insight of allInsights) {
      try {
        await db
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
        // Duplicate or DB error
      }
    }

    return allInsights;
  }

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

        const { coefficient, pValue } = calculatePearsonCorrelation(
          valuesA.slice(0, len),
          valuesB.slice(0, len),
        );

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
    const conditions: (SQL | undefined)[] = [];
    if (filters.sourceModule)
      conditions.push(eq(moduleConnections.sourceModule, filters.sourceModule));
    if (filters.targetModule)
      conditions.push(eq(moduleConnections.targetModule, filters.targetModule));
    if (filters.connectionType)
      conditions.push(eq(moduleConnections.connectionType, filters.connectionType));
    if (filters.minStrength != null)
      conditions.push(gte(moduleConnections.strength, filters.minStrength));

    const query = db.select().from(moduleConnections);
    const rows: ModuleConnectionRow[] =
      conditions.length > 0 ? await query.where(and(...conditions)).all() : await query.all();

    return rows.map((r) => ({
      id: r.id,
      sourceModule: r.sourceModule,
      targetModule: r.targetModule,
      connectionType: r.connectionType,
      description: r.description,
      strength: r.strength,
      isBidirectional: Boolean(r.isBidirectional),
      activityCount: r.activityCount ?? 0,
      lastActivityAt: r.lastActivityAt ?? null,
    }));
  }

  async updateConnectionActivity(
    sourceModule: string,
    targetModule: string,
    connectionType: string,
  ): Promise<void> {
    await db
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
  // PUBLIC: Unified Timeline (delegated)
  // --------------------------------------------------------------------------

  async generateTimeline(userId: string, timeRange: TimeRange): Promise<TimelineEntry[]> {
    return generateTimelineFn(userId, timeRange);
  }

  // --------------------------------------------------------------------------
  // PUBLIC: Insight CRUD
  // --------------------------------------------------------------------------

  async getInsights(
    userId: string,
    filters: InsightFilters = {},
  ): Promise<{ items: CrossModuleInsight[]; total: number }> {
    const { limit = 20, offset = 0 } = filters;
    const conditions: (SQL | undefined)[] = [eq(crossModuleInsights.userId, userId)];

    if (filters.insightType)
      conditions.push(eq(crossModuleInsights.insightType, filters.insightType));
    if (filters.severity) conditions.push(eq(crossModuleInsights.severity, filters.severity));
    if (filters.status) conditions.push(eq(crossModuleInsights.status, filters.status));
    if (filters.minConfidence != null)
      conditions.push(gte(crossModuleInsights.confidence, filters.minConfidence));
    if (filters.dateFrom) conditions.push(gte(crossModuleInsights.createdAt, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(crossModuleInsights.createdAt, filters.dateTo));

    const whereClause = and(...conditions);

    const countResult = await db
      .select({ count: sql`count(*)` })
      .from(crossModuleInsights)
      .where(whereClause)
      .get();
    const total = Number(countResult?.count ?? 0);

    const rows: CrossModuleInsightRow[] = await db
      .select()
      .from(crossModuleInsights)
      .where(whereClause)
      .orderBy(desc(crossModuleInsights.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    let items = rows.map((r) => rowToInsight(r));
    if (filters.sourceModules?.length) {
      items = items.filter((i) => i.sourceModules.some((m) => filters.sourceModules!.includes(m)));
      return { items, total: items.length };
    }

    return { items, total };
  }

  async getInsightById(insightId: string): Promise<CrossModuleInsight | null> {
    const row = await db
      .select()
      .from(crossModuleInsights)
      .where(eq(crossModuleInsights.id, insightId))
      .get();
    return row ? rowToInsight(row) : null;
  }

  async markInsightViewed(insightId: string): Promise<void> {
    await db
      .update(crossModuleInsights)
      .set({ status: 'viewed' })
      .where(eq(crossModuleInsights.id, insightId))
      .run();
  }

  async actOnInsight(insightId: string, _action?: string): Promise<void> {
    await db
      .update(crossModuleInsights)
      .set({ status: 'acted_on', actedOnAt: new Date().toISOString() })
      .where(eq(crossModuleInsights.id, insightId))
      .run();
  }

  async dismissInsight(insightId: string): Promise<void> {
    await db
      .update(crossModuleInsights)
      .set({ status: 'dismissed' })
      .where(eq(crossModuleInsights.id, insightId))
      .run();
  }
}

// Re-exports for backward compatibility
export { buildInsight, deduplicateInsights, rowToInsight } from './insight-helpers.js';
export { calculatePearsonCorrelation } from './math-utils.js';
