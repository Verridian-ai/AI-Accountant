/**
 * Temporal Cognify — Query management (save, list, get, delete, execute, timeline)
 */

import { db, transactions, temporalQueries } from '../../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { CogneeClient } from '../cognee_client.js';
import type {
  TemporalQueryInput,
  TemporalQueryResult,
  TemporalQueryRow,
  TimeSearchOptions,
  TimelineEvent,
} from './types.js';
import {
  checkCache,
  updateCache,
  queryTypeToSearchType,
  buildSearchQuery,
} from './temporal-helpers.js';
import { timeAwareSearch } from './temporal-search.js';

export async function executeTemporalQuery(
  client: CogneeClient,
  userId: string,
  query: TemporalQueryInput,
): Promise<TemporalQueryResult> {
  const startMs = Date.now();
  const queryId = randomUUID();
  if (query.useCache !== false) {
    const cached = await checkCache(queryId);
    if (cached) return cached;
  }
  const timeOptions: TimeSearchOptions = {
    dataset: (query.parameters.cogneeDataset as string) ?? 'bank_transactions',
    timeStart: query.timeStart,
    timeEnd: query.timeEnd,
    timeGranularity: query.timeGranularity,
    searchType: queryTypeToSearchType(query.queryType),
    topK: (query.parameters.topK as number) ?? 10,
  };
  const searchQuery = buildSearchQuery(query);
  const results = await timeAwareSearch(client, searchQuery, timeOptions);
  const executionMs = Date.now() - startMs;
  const result: TemporalQueryResult = {
    queryId,
    results,
    summary: `Found ${results.length} results for ${query.queryType} query on ${query.targetEntity}`,
    timeRange: { start: query.timeStart, end: query.timeEnd ?? query.timeStart },
    fromCache: false,
    executionMs,
  };
  await updateCache(queryId, result, 30);
  return result;
}

export async function saveQuery(
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
    cogneeSearchType: queryTypeToSearchType(query.queryType),
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

export async function listSavedQueries(
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

export async function getQueryById(queryId: string): Promise<TemporalQueryRow | null> {
  const row = await db.select().from(temporalQueries).where(eq(temporalQueries.id, queryId)).get();
  return (row as TemporalQueryRow) ?? null;
}

export async function deleteQuery(queryId: string): Promise<void> {
  await db.delete(temporalQueries).where(eq(temporalQueries.id, queryId)).run();
}

type TxRow = {
  date: string;
  description: string;
  amount: number | null;
  category: string | null;
  accountId: string | null;
};

export async function getTemporalTimeline(
  userId: string,
  entityType: string,
  timeRange: { start: string; end: string },
): Promise<TimelineEvent[]> {
  const rows = (await db
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
    .all()) as TxRow[];

  const events: TimelineEvent[] = rows.map((tx) => ({
    date: tx.date,
    type: tx.category ?? 'transaction',
    module: 'transactions',
    title: tx.description,
    description: `${tx.description} — $${((tx.amount ?? 0) / 100).toFixed(2)}`,
    severity: undefined,
    amount: tx.amount ?? undefined,
    relatedEntityId: tx.accountId ?? undefined,
  }));
  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
