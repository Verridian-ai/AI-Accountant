// ============================================================================
// INSIGHT HELPERS — Stateless factory and utility functions
// ============================================================================

import { randomUUID } from 'crypto';
import type { CrossModuleInsight, TimeRange } from './types.js';
import type { CrossModuleInsightRow } from './db-types.js';

/**
 * Factory function: build a CrossModuleInsight with generated ID and timestamps.
 */
export function buildInsight(
  type: string,
  title: string,
  description: string,
  evidence: Record<string, unknown>,
  modules: string[],
  confidence: number,
  severity: string,
  userId: string,
  timeRange?: TimeRange,
  recommendedAction?: string,
): CrossModuleInsight {
  return {
    id: randomUUID(),
    userId,
    insightType: type,
    title,
    description,
    severity: severity as CrossModuleInsight['severity'],
    sourceModules: modules,
    relatedEntities: [],
    timeRangeStart: timeRange?.start,
    timeRangeEnd: timeRange?.end,
    confidence: Math.round(confidence * 1000) / 1000,
    evidence,
    recommendedAction,
    status: 'new',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  };
}

/**
 * Remove near-duplicate insights by comparing type + modules + time range.
 */
export function deduplicateInsights(insights: CrossModuleInsight[]): CrossModuleInsight[] {
  const seen = new Set<string>();
  const deduped: CrossModuleInsight[] = [];

  for (const insight of insights) {
    const key = [
      insight.insightType,
      insight.sourceModules.sort().join(','),
      insight.timeRangeStart ?? '',
      insight.timeRangeEnd ?? '',
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(insight);
    }
  }

  return deduped;
}

/** Convert a raw DB row into a CrossModuleInsight object. */
export function rowToInsight(r: CrossModuleInsightRow): CrossModuleInsight {
  return {
    id: r.id,
    userId: r.userId,
    insightType: r.insightType,
    title: r.title,
    description: r.description,
    severity: r.severity as CrossModuleInsight['severity'],
    sourceModules: parseJson(r.sourceModules, [] as string[]),
    relatedEntities: parseJson(
      r.relatedEntities,
      [] as Array<{ type: string; id: string; module: string }>,
    ),
    timeRangeStart: r.timeRangeStart ?? undefined,
    timeRangeEnd: r.timeRangeEnd ?? undefined,
    confidence: Number(r.confidence ?? 0.5),
    evidence: parseJson(r.evidence, {} as Record<string, unknown>),
    recommendedAction: r.recommendedAction ?? undefined,
    status: r.status,
    actedOnAt: r.actedOnAt ?? undefined,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt ?? undefined,
  };
}

/** Safe JSON parse with fallback. */
export function parseJson<T>(value: string | T, fallback: T): T {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
