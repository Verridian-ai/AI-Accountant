/**
 * Cross-Module Intelligence — Shared Helpers
 *
 * Factory and utility functions shared across scanners and the orchestrator.
 */

import { randomUUID } from 'crypto';
import type { CrossModuleInsight, TimeRange } from './types.js';

/** Factory method: build a CrossModuleInsight with generated ID and timestamps. */
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

/** Remove near-duplicate insights by comparing type + modules + time range. */
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
export function rowToInsight(r: Record<string, unknown>): CrossModuleInsight {
  return {
    id: r.id as string,
    userId: (r.userId ?? r.user_id) as string,
    insightType: (r.insightType ?? r.insight_type) as string,
    title: r.title as string,
    description: r.description as string,
    severity: r.severity as CrossModuleInsight['severity'],
    sourceModules: parseJson(r.sourceModules ?? r.source_modules, []) as string[],
    relatedEntities: parseJson(
      r.relatedEntities ?? r.related_entities,
      [],
    ) as CrossModuleInsight['relatedEntities'],
    timeRangeStart: (r.timeRangeStart ?? r.time_range_start) as string | undefined,
    timeRangeEnd: (r.timeRangeEnd ?? r.time_range_end) as string | undefined,
    confidence: Number(r.confidence ?? 0.5),
    evidence: parseJson(r.evidence, {}) as Record<string, unknown>,
    recommendedAction: (r.recommendedAction ?? r.recommended_action) as string | undefined,
    status: r.status as CrossModuleInsight['status'],
    actedOnAt: (r.actedOnAt ?? r.acted_on_at) as string | undefined,
    createdAt: (r.createdAt ?? r.created_at) as string,
    expiresAt: (r.expiresAt ?? r.expires_at) as string | undefined,
  };
}

/** Safe JSON parse with fallback. */
export function parseJson<T>(value: string | T, fallback: T): T {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
