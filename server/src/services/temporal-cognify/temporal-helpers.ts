/**
 * Temporal Cognify — Pure helper functions
 * Australian financial year / BAS quarter logic, query building, cache ops.
 */

import { db, temporalQueries } from '../../schema.js';
import { eq, sql } from 'drizzle-orm';
import type {
  TemporalCognifyOptions,
  TimeSearchOptions,
  TemporalQueryInput,
  TemporalQueryResult,
} from './types.js';

// ── Australian calendar helpers ───────────────────────────────────────────

export function parseAustralianFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 7) {
    const endYear = (year + 1) % 100;
    return `${year}-${endYear.toString().padStart(2, '0')}`;
  } else {
    const endYear = year % 100;
    return `${year - 1}-${endYear.toString().padStart(2, '0')}`;
  }
}

export function getBasQuarter(date: Date): string {
  const month = date.getMonth() + 1;
  if (month >= 7 && month <= 9) return 'Q1';
  if (month >= 10 && month <= 12) return 'Q2';
  if (month >= 1 && month <= 3) return 'Q3';
  return 'Q4';
}

// ── Prompt builders ───────────────────────────────────────────────────────

export function buildTemporalPrompt(options: TemporalCognifyOptions): string {
  const parts: string[] = [
    'Extract entities with full temporal context.',
    `Time field: "${options.timeField}".`,
    `Granularity: ${options.timeGranularity}.`,
  ];
  if (options.addSeasonalContext)
    parts.push(
      'Add Australian seasonal markers: EOFY (June), Christmas period (Dec-Jan), Easter period, tax time (Jul-Oct).',
    );
  if (options.addBusinessCycleContext)
    parts.push(
      'Add Australian business cycle markers: BAS quarters (Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun), financial year boundaries, lodgement due dates.',
    );
  parts.push(
    'For each entity, extract temporal relationships: when it occurred, what period it belongs to, seasonal patterns, and recurring schedule if applicable.',
  );
  if (options.customPrompt) parts.push(options.customPrompt);
  return parts.join(' ');
}

export function enrichQueryWithTimeContext(query: string, options: TimeSearchOptions): string {
  const parts: string[] = [query];
  if (options.timeStart) {
    const startDate = new Date(options.timeStart);
    const fy = parseAustralianFinancialYear(startDate);
    const basQ = getBasQuarter(startDate);
    parts.push(`(time range: from ${options.timeStart}`);
    if (options.timeEnd) parts.push(`to ${options.timeEnd}`);
    parts.push(`financial year: ${fy}, BAS quarter: ${basQ})`);
  }
  if (options.timeGranularity) parts.push(`[granularity: ${options.timeGranularity}]`);
  if (options.includeAdjacentPeriods) parts.push('[include adjacent periods for context]');
  return parts.join(' ');
}

export function queryTypeToSearchType(queryType: string): string {
  switch (queryType) {
    case 'point_in_time':
    case 'time_range':
      return 'CHUNKS';
    case 'trend_over_time':
      return 'GRAPH_COMPLETION';
    case 'comparison':
      return 'GRAPH_SUMMARY_COMPLETION';
    case 'evolution':
      return 'GRAPH_COMPLETION_COT';
    default:
      return 'GRAPH_COMPLETION';
  }
}

export function buildSearchQuery(query: TemporalQueryInput): string {
  const parts: string[] = [];
  switch (query.queryType) {
    case 'point_in_time':
      parts.push(`${query.targetEntity} at ${query.timeStart}`);
      break;
    case 'time_range':
      parts.push(
        `${query.targetEntity} from ${query.timeStart} to ${query.timeEnd ?? query.timeStart}`,
      );
      break;
    case 'trend_over_time':
      parts.push(
        `trend of ${query.targetEntity} from ${query.timeStart} to ${query.timeEnd ?? 'now'}`,
      );
      break;
    case 'comparison':
      parts.push(
        `compare ${query.targetEntity} between ${query.timeStart} and ${query.timeEnd ?? 'previous period'}`,
      );
      break;
    case 'evolution':
      parts.push(
        `evolution of ${query.targetEntity} from ${query.timeStart} to ${query.timeEnd ?? 'now'}`,
      );
      break;
  }
  const filters = query.parameters.filters;
  if (filters && typeof filters === 'string') parts.push(filters);
  return parts.join(' ');
}

// ── Cache operations ──────────────────────────────────────────────────────

export async function checkCache(queryId: string): Promise<TemporalQueryResult | null> {
  try {
    const row = await db
      .select()
      .from(temporalQueries)
      .where(eq(temporalQueries.id, queryId))
      .get();
    if (!row?.resultCache || !row.cacheExpiresAt) return null;
    const expiresAt = new Date(row.cacheExpiresAt);
    if (expiresAt <= new Date()) return null;
    return JSON.parse(row.resultCache) as TemporalQueryResult;
  } catch {
    return null;
  }
}

export async function updateCache(
  queryId: string,
  result: TemporalQueryResult,
  ttlMinutes: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  try {
    await db
      .update(temporalQueries)
      .set({
        resultCache: JSON.stringify(result),
        cacheExpiresAt: expiresAt,
        lastExecutedAt: now,
        executionCount: sql`${temporalQueries.executionCount} + 1`,
        updatedAt: now,
      })
      .where(eq(temporalQueries.id, queryId))
      .run();
  } catch {
    /* Cache update is best-effort */
  }
}
