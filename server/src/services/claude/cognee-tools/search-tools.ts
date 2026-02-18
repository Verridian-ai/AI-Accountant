/**
 * Cognee Tools — Core CogneeTools Class (Search & Indexing)
 *
 * Base class with constructor, factory methods, core search/index/cognify,
 * cross-module search, temporal search, feedback, and dataset prefixing.
 */

import { cogneeClient, CogneeClient } from '../../cognee_client.js';
import type { CogneeSearchType, CogneeSearchResult } from '../../cognee_client.js';
import {
  type CogneeToolConfig,
  DEFAULT_CONFIG,
  SHARED_DATASETS,
  ROW_FILTERED_DATASETS,
  COGNEE_DATASETS,
} from './types.js';

export class CogneeToolsBase {
  protected config: CogneeToolConfig;
  protected client: CogneeClient;

  constructor(config: Partial<CogneeToolConfig> = {}, client?: CogneeClient) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = client ?? cogneeClient;
  }

  /**
   * Create a CogneeTools instance scoped to a specific user (Wave 3).
   */
  static forUser(userId: string, client?: CogneeClient): CogneeToolsBase {
    return new CogneeToolsBase(
      {
        datasetPrefix: `user_${userId}`,
        userId,
      },
      client,
    );
  }

  /**
   * Create a CogneeTools instance scoped to a specific tenant (Wave 23).
   */
  static forTenant(tenantId: string, userId?: string, client?: CogneeClient): CogneeToolsBase {
    return new CogneeToolsBase(
      {
        datasetPrefix: userId ? `user_${userId}` : '',
        userId,
        tenantId,
      },
      client,
    );
  }

  /**
   * Search Cognee knowledge graph for relevant context.
   */
  async search(
    query: string,
    dataset: string,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    sessionId?: string,
  ): Promise<CogneeSearchResult[]> {
    if (sessionId) {
      return this.client.searchWithSession(
        query,
        this.prefixDataset(dataset),
        sessionId,
        this.config.searchTopK,
        searchType,
        this.config.userId,
        this.config.tenantId,
      );
    }
    return this.client.searchRich(
      query,
      this.prefixDataset(dataset),
      this.config.searchTopK,
      searchType,
      this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Index data into a Cognee dataset.
   */
  async index(data: string[], dataset: string): Promise<void> {
    if (ROW_FILTERED_DATASETS.has(dataset) && this.config.userId) {
      for (let i = 0; i < data.length; i += this.config.indexBatchSize) {
        const batch = data.slice(i, i + this.config.indexBatchSize);
        await this.addWithUserMetadata(batch, dataset);
      }
    } else {
      for (let i = 0; i < data.length; i += this.config.indexBatchSize) {
        const batch = data.slice(i, i + this.config.indexBatchSize);
        await this.client.add(
          batch,
          this.prefixDataset(dataset),
          this.config.userId,
          this.config.tenantId,
        );
      }
    }
  }

  /**
   * Build knowledge graph from indexed data.
   */
  async cognify(dataset: string): Promise<void> {
    await this.client.cognify(
      [this.prefixDataset(dataset)],
      true,
      undefined,
      this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Index data and then trigger cognify in one step.
   */
  async indexAndCognify(data: string[], dataset: string): Promise<void> {
    await this.index(data, dataset);
    await this.cognify(dataset);
  }

  /**
   * Search using a DataPoint-structured entity query.
   */
  async searchWithDataPoint(
    query: string,
    dataPointType: string,
    sessionId?: string,
  ): Promise<CogneeSearchResult[]> {
    const dataset = `datapoint_${dataPointType.toLowerCase()}`;
    return this.search(query, dataset, 'CHUNKS', sessionId);
  }

  /**
   * Search with ontology-based context.
   */
  async searchWithOntology(
    query: string,
    ontologyType: string,
    sessionId?: string,
  ): Promise<CogneeSearchResult[]> {
    const dataset = `ontology_${ontologyType.toLowerCase()}`;
    return this.search(query, dataset, 'GRAPH_COMPLETION', sessionId);
  }

  /**
   * Submit feedback on a search result for Cognee learning loop.
   */
  async submitSearchFeedback(
    query: string,
    resultId: string,
    feedback: 'relevant' | 'partial' | 'irrelevant',
    context?: string,
  ): Promise<void> {
    const feedbackText = `Feedback: query="${query}" resultId=${resultId} feedback=${feedback}${context ? ` context="${context}"` : ''}`;
    try {
      await this.index([feedbackText], 'search_feedback');
    } catch {
      // Non-fatal: don't break caller flow
    }
  }

  /**
   * Temporal search — search within a time range on a specific dataset.
   */
  async temporalSearch(
    query: string,
    dataset: string,
    timeRange: { start: string; end: string },
    sessionId?: string,
  ): Promise<CogneeSearchResult[]> {
    const augmented = `${query} [period: ${timeRange.start} to ${timeRange.end}]`;
    return this.search(augmented, dataset, 'CHUNKS', sessionId);
  }

  /**
   * Cross-module search — search across multiple datasets and merge results.
   */
  async crossModuleSearch(query: string, modules: string[]): Promise<CogneeSearchResult[]> {
    const allResults: CogneeSearchResult[] = [];
    for (const mod of modules) {
      try {
        const results = await this.search(query, mod, 'CHUNKS');
        allResults.push(...results);
      } catch {
        // Non-fatal: skip unavailable modules
      }
    }
    return allResults;
  }

  /**
   * Search timeline — search for events within a date range across specified modules.
   */
  async searchTimeline(
    query: string,
    timeRange: { start: string; end: string },
    modules: string[],
  ): Promise<CogneeSearchResult[]> {
    const augmented = `${query} [timeline: ${timeRange.start} to ${timeRange.end}]`;
    return this.crossModuleSearch(augmented, modules);
  }

  /**
   * Wave 3: Apply dataset prefix with pooling strategy.
   */
  prefixDataset(dataset: string): string {
    if (SHARED_DATASETS.has(dataset)) {
      return dataset;
    }
    if (ROW_FILTERED_DATASETS.has(dataset)) {
      return dataset;
    }
    if (this.config.datasetPrefix) {
      return `${this.config.datasetPrefix}_${dataset}`;
    }
    return dataset;
  }

  /**
   * Wave 3: When adding data to row-filtered datasets, include user_id in metadata.
   */
  private async addWithUserMetadata(data: string[], dataset: string): Promise<void> {
    const userId = this.config.userId;
    const taggedData = data.map((item) => `[user:${userId}] ${item}`);
    await this.client.add(taggedData, dataset, userId, this.config.tenantId);
  }

  /**
   * Map a logical module name to its Cognee dataset name (Wave 4+).
   */
  _moduleToDataset(module: string): string {
    switch (module) {
      case 'transactions':
        return COGNEE_DATASETS.bankTransactions;
      case 'merchants':
        return COGNEE_DATASETS.merchantMappings;
      case 'gst':
        return COGNEE_DATASETS.gstRules;
      case 'tax':
        return COGNEE_DATASETS.taxTables;
      case 'forecasting':
        return COGNEE_DATASETS.forecastPatterns;
      case 'compliance':
        return COGNEE_DATASETS.complianceRulings;
      case 'anomalies':
        return COGNEE_DATASETS.anomalyHistory;
      case 'reports':
        return COGNEE_DATASETS.financialReports;
      case 'budgets':
        return COGNEE_DATASETS.budgetTemplates;
      case 'customers':
        return COGNEE_DATASETS.customerProfiles;
      case 'invoicing':
        return COGNEE_DATASETS.invoiceHistory;
      case 'suppliers':
        return COGNEE_DATASETS.supplierProfiles;
      case 'bills':
        return COGNEE_DATASETS.billPatterns;
      case 'inventory':
        return COGNEE_DATASETS.inventoryCatalog;
      case 'reconciliation':
        return COGNEE_DATASETS.reconPatterns;
      case 'payroll':
      case 'employees':
        return COGNEE_DATASETS.employeeProfiles;
      case 'pay_structures':
      case 'pay':
        return COGNEE_DATASETS.payStructures;
      default:
        return module;
    }
  }
}
