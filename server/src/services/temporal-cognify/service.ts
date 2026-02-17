/**
 * Temporal Cognify Service
 *
 * Time-aware intelligence layer on top of Cognee. Handles temporal metadata
 * enrichment, time-range search, query management, and Australian FY/BAS
 * quarter logic.
 */

import { db, transactions, temporalQueries } from '../../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { CogneeClient, type CogneeSearchType } from '../cognee_client.js';
import { randomUUID } from 'crypto';
import { logger } from '../../lib/logger.js';
import type {
  TemporalCognifyOptions,
  TemporalCognifyResult,
  TimeSearchOptions,
  TemporalSearchResult,
  TemporalQueryInput,
  TemporalQueryResult,
  TimelineEvent,
  TemporalQueryRow,
} from './types.js';
import { AUSTRALIAN_SEASONS } from './types.js';

export class TemporalCognifyService {
  private client: CogneeClient;

  constructor(client?: CogneeClient) {
    this.client = client ?? new CogneeClient();
  }

  async temporalCognify(
    datasetName: string,
    options: TemporalCognifyOptions,
  ): Promise<TemporalCognifyResult> {
    const prompt = this._buildTemporalPrompt(options);
    try {
      await this.client.cognify([datasetName], true, prompt);
      return {
        dataset: datasetName,
        entitiesProcessed: 0,
        temporalMetadataAdded: 0,
        timeRange: { start: '', end: '' },
        granularityUsed: options.timeGranularity,
        status: 'in_progress',
      };
    } catch (err) {
      logger.warn({ err: err }, '[TemporalCognify] cognify failed:');
      return {
        dataset: datasetName,
        entitiesProcessed: 0,
        temporalMetadataAdded: 0,
        timeRange: { start: '', end: '' },
        granularityUsed: options.timeGranularity,
        status: 'failed',
      };
    }
  }

  async timeAwareSearch(
    query: string,
    timeOptions: TimeSearchOptions,
  ): Promise<TemporalSearchResult[]> {
    const enrichedQuery = this._enrichQueryWithTimeContext(query, timeOptions);
    const searchType = (timeOptions.searchType ?? 'GRAPH_COMPLETION') as CogneeSearchType;
    const topK = timeOptions.topK ?? 10;
    const results = await this.client.searchRich(
      enrichedQuery,
      timeOptions.dataset,
      topK,
      searchType,
    );
    return results.map((r) => {
      const meta = r.metadata ?? {};
      return {
        content: r.text,
        score: r.score ?? 0,
        temporalMetadata: {
          date: meta.date as string | undefined,
          period: meta.period as string | undefined,
          quarter: meta.quarter as string | undefined,
          financialYear: meta.financial_year as string | undefined,
        },
        source: (meta.source as string) ?? timeOptions.dataset,
      };
    });
  }

  addTimeMetadata(
    entities: Array<Record<string, unknown>>,
    timeField: string,
  ): Array<Record<string, unknown>> {
    return entities.map((entity) => {
      const raw = entity[timeField];
      if (!raw) return entity;
      const date = new Date(String(raw));
      if (isNaN(date.getTime())) return entity;
      const month = date.getMonth() + 1;
      const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      const jan4 = new Date(date.getFullYear(), 0, 4);
      const daysSinceJan4 = Math.floor((date.getTime() - jan4.getTime()) / 86400000);
      const weekNumber = Math.ceil((daysSinceJan4 + jan4.getDay() + 1) / 7);
      return {
        ...entity,
        _year: date.getFullYear(),
        _quarter: `Q${Math.ceil(month / 3)}`,
        _month: month,
        _week: Math.min(weekNumber, 52),
        _day_of_week: dayOfWeek,
        _financial_year: this._parseAustralianFinancialYear(date),
        _bas_quarter: this._getBasQuarter(date),
        _is_eofy: month === 6,
        _is_christmas_period: month === 12 || month === 1,
        _season: AUSTRALIAN_SEASONS[month],
      };
    });
  }

  async executeTemporalQuery(
    userId: string,
    query: TemporalQueryInput,
  ): Promise<TemporalQueryResult> {
    const startMs = Date.now();
    const queryId = randomUUID();
    if (query.useCache !== false) {
      const cached = await this._checkCache(queryId);
      if (cached) return cached;
    }
    const timeOptions: TimeSearchOptions = {
      dataset: (query.parameters.cogneeDataset as string) ?? 'bank_transactions',
      timeStart: query.timeStart,
      timeEnd: query.timeEnd,
      timeGranularity: query.timeGranularity,
      searchType: this._queryTypeToSearchType(query.queryType),
      topK: (query.parameters.topK as number) ?? 10,
    };
    const searchQuery = this._buildSearchQuery(query);
    const results = await this.timeAwareSearch(searchQuery, timeOptions);
    const executionMs = Date.now() - startMs;
    const result: TemporalQueryResult = {
      queryId,
      results,
      summary: `Found ${results.length} results for ${query.queryType} query on ${query.targetEntity}`,
      timeRange: { start: query.timeStart, end: query.timeEnd ?? query.timeStart },
      fromCache: false,
      executionMs,
    };
    await this._updateCache(queryId, result, 30);
    return result;
  }

  async saveQuery(
    userId: string,
    query: TemporalQueryInput & { name: string; description?: string },
  ): Promise<TemporalQueryRow> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const row = {
      id,
      userId,
      name: query.name,
      description: query.description ?? null,
      queryType: query.queryType,
      targetEntity: query.targetEntity,
      timeStart: query.timeStart,
      timeEnd: query.timeEnd ?? null,
      timeGranularity: query.timeGranularity ?? 'monthly',
      queryParameters: JSON.stringify(query.parameters),
      cogneeDataset: (query.parameters.cogneeDataset as string) ?? null,
      cogneeSearchType: this._queryTypeToSearchType(query.queryType),
      resultCache: null,
      cacheExpiresAt: null,
      executionCount: 0,
      lastExecutedAt: null,
      averageExecutionMs: null,
      isSaved: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(temporalQueries).values(row).run();
    return row as unknown as TemporalQueryRow;
  }

  async listSavedQueries(
    userId: string,
    filters?: { queryType?: string; targetEntity?: string },
  ): Promise<TemporalQueryRow[]> {
    const conditions = [eq(temporalQueries.userId, userId), eq(temporalQueries.isSaved, true)];
    if (filters?.queryType) conditions.push(eq(temporalQueries.queryType, filters.queryType));
    if (filters?.targetEntity)
      conditions.push(eq(temporalQueries.targetEntity, filters.targetEntity));
    const rows = await db
      .select()
      .from(temporalQueries)
      .where(and(...conditions))
      .orderBy(desc(temporalQueries.updatedAt))
      .all();
    return rows as TemporalQueryRow[];
  }

  async getQueryById(queryId: string): Promise<TemporalQueryRow | null> {
    const row = await db
      .select()
      .from(temporalQueries)
      .where(eq(temporalQueries.id, queryId))
      .get();
    return (row as TemporalQueryRow) ?? null;
  }

  async deleteQuery(queryId: string): Promise<void> {
    await db.delete(temporalQueries).where(eq(temporalQueries.id, queryId)).run();
  }

  async getTemporalTimeline(
    userId: string,
    entityType: string,
    timeRange: { start: string; end: string },
  ): Promise<TimelineEvent[]> {
    const rows: any[] = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          sql`${transactions.date} >= ${timeRange.start}`,
          sql`${transactions.date} <= ${timeRange.end}`,
        ),
      )
      .orderBy(transactions.date)
      .all();

    const events: TimelineEvent[] = rows.map((tx: any) => ({
      date: tx.date,
      type: tx.category ?? 'transaction',
      module: 'transactions',
      title: tx.description,
      description: `${tx.description} — $${((tx.amount ?? 0) / 100).toFixed(2)}`,
      severity: undefined,
      amount: tx.amount,
      relatedEntityId: tx.accountId ?? undefined,
    }));
    events.sort((a, b) => a.date.localeCompare(b.date));
    return events;
  }

  // --- Private helpers ---

  private _buildTemporalPrompt(options: TemporalCognifyOptions): string {
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

  private _enrichQueryWithTimeContext(query: string, options: TimeSearchOptions): string {
    const parts: string[] = [query];
    if (options.timeStart) {
      const startDate = new Date(options.timeStart);
      const fy = this._parseAustralianFinancialYear(startDate);
      const basQ = this._getBasQuarter(startDate);
      parts.push(`(time range: from ${options.timeStart}`);
      if (options.timeEnd) parts.push(`to ${options.timeEnd}`);
      parts.push(`financial year: ${fy}, BAS quarter: ${basQ})`);
    }
    if (options.timeGranularity) parts.push(`[granularity: ${options.timeGranularity}]`);
    if (options.includeAdjacentPeriods) parts.push('[include adjacent periods for context]');
    return parts.join(' ');
  }

  _parseAustralianFinancialYear(date: Date): string {
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

  _getBasQuarter(date: Date): string {
    const month = date.getMonth() + 1;
    if (month >= 7 && month <= 9) return 'Q1';
    if (month >= 10 && month <= 12) return 'Q2';
    if (month >= 1 && month <= 3) return 'Q3';
    return 'Q4';
  }

  private async _checkCache(queryId: string): Promise<TemporalQueryResult | null> {
    try {
      const row: any = await db
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

  private async _updateCache(
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

  private _queryTypeToSearchType(queryType: string): string {
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

  private _buildSearchQuery(query: TemporalQueryInput): string {
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
}

export const temporalCognifyService = new TemporalCognifyService();
