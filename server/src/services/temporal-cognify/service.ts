/**
 * Temporal Cognify Service — thin orchestrator
 */

import { CogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type {
  TemporalCognifyOptions,
  TemporalCognifyResult,
  TimeSearchOptions,
  TemporalSearchResult,
  TemporalQueryInput,
  TemporalQueryResult,
  TemporalQueryRow,
  TimelineEvent,
} from './types.js';
import {
  buildTemporalPrompt,
  parseAustralianFinancialYear,
  getBasQuarter,
} from './temporal-helpers.js';
import { timeAwareSearch, addTimeMetadata } from './temporal-search.js';
import {
  executeTemporalQuery,
  saveQuery,
  listSavedQueries,
  getQueryById,
  deleteQuery,
  getTemporalTimeline,
} from './temporal-queries.js';

export class TemporalCognifyService {
  private client: CogneeClient;

  constructor(client?: CogneeClient) {
    this.client = client ?? new CogneeClient();
  }

  async temporalCognify(
    datasetName: string,
    options: TemporalCognifyOptions,
  ): Promise<TemporalCognifyResult> {
    const prompt = buildTemporalPrompt(options);
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
    return timeAwareSearch(this.client, query, timeOptions);
  }

  addTimeMetadata(
    entities: Array<Record<string, unknown>>,
    timeField: string,
  ): Array<Record<string, unknown>> {
    return addTimeMetadata(entities, timeField);
  }

  async executeTemporalQuery(
    userId: string,
    query: TemporalQueryInput,
  ): Promise<TemporalQueryResult> {
    return executeTemporalQuery(this.client, userId, query);
  }

  async saveQuery(
    userId: string,
    query: TemporalQueryInput & { name: string; description?: string },
  ): Promise<TemporalQueryRow> {
    return saveQuery(userId, query);
  }

  async listSavedQueries(
    userId: string,
    filters?: { queryType?: string; targetEntity?: string },
  ): Promise<TemporalQueryRow[]> {
    return listSavedQueries(userId, filters);
  }

  async getQueryById(queryId: string): Promise<TemporalQueryRow | null> {
    return getQueryById(queryId);
  }

  async deleteQuery(queryId: string): Promise<void> {
    return deleteQuery(queryId);
  }

  async getTemporalTimeline(
    userId: string,
    entityType: string,
    timeRange: { start: string; end: string },
  ): Promise<TimelineEvent[]> {
    return getTemporalTimeline(userId, entityType, timeRange);
  }

  // Expose AU calendar helpers for external use
  parseAustralianFinancialYear(date: Date): string {
    return parseAustralianFinancialYear(date);
  }

  getBasQuarter(date: Date): string {
    return getBasQuarter(date);
  }
}

export const temporalCognifyService = new TemporalCognifyService();
