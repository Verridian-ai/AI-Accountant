/**
 * Cognee Cloud Client — TypeScript REST API Client
 *
 * Direct REST API client for Cognee Cloud Premium.
 * Replaces Python SDK wrapper due to Python version compatibility.
 *
 * API Key: 13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff
 * Base URL: https://api.cognee.ai
 */

import { logger } from '../../lib/logger.js';

const COGNEE_CLOUD_API_URL = 'https://api.cognee.ai';
const COGNEE_CLOUD_API_KEY =
  process.env.COGWIT_API_KEY || 'f056b134c9fe54f4adb59bf77b855af01a9ce5081886e3d7';

export type CogneeSearchType =
  | 'CHUNKS'
  | 'CHUNKS_LEXICAL'
  | 'GRAPH_COMPLETION'
  | 'RAG_COMPLETION'
  | 'GRAPH_SUMMARY_COMPLETION'
  | 'GRAPH_COMPLETION_COT'
  | 'NATURAL_LANGUAGE'
  | 'INSIGHTS'
  | 'SUMMARIES'
  | 'GRAPH_TRAVERSAL'
  | 'HYBRID'
  | 'SEMANTIC'
  | 'KEYWORD'
  | 'COMBINED';

export interface AddResponse {
  status: string;
  dataset_id: string;
  dataset_name: string;
}

export interface CognifyResponse {
  [datasetId: string]: {
    status: string;
    message?: string;
  };
}

export interface SearchResult {
  search_result: any;
  score?: number;
  metadata?: Record<string, any>;
}

export class CogneeCloudClient {
  private baseUrl: string;
  private apiKey: string;
  private datasetCache: Map<string, string> = new Map();

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || COGNEE_CLOUD_API_KEY;
    this.baseUrl = baseUrl || COGNEE_CLOUD_API_URL;
  }

  /**
   * Add data to a dataset in Cognee Cloud.
   */
  async addData(
    data: string | string[],
    datasetName: string,
    tenantId?: string,
  ): Promise<AddResponse> {
    const prefixedDataset = this.applyTenantPrefix(datasetName, tenantId);
    const dataStr = Array.isArray(data) ? data.join('\n\n') : data;

    const response = await fetch(`${this.baseUrl}/api/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({
        data: dataStr,
        dataset_name: prefixedDataset,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cognee Cloud add failed: ${response.status} ${error}`);
    }

    const result = (await response.json()) as AddResponse;

    // Cache dataset ID
    if (result.dataset_id) {
      this.datasetCache.set(prefixedDataset, result.dataset_id);
    }

    logger.info(`[CogneeCloud] Added data to dataset: ${prefixedDataset}`);
    return result;
  }

  /**
   * Build knowledge graph from added data.
   */
  async cognify(
    datasetNames?: string[],
    datasetIds?: string[],
    tenantId?: string,
  ): Promise<CognifyResponse> {
    // Resolve dataset IDs from names if needed
    let ids = datasetIds || [];

    if (datasetNames && !datasetIds) {
      ids = [];
      for (const name of datasetNames) {
        const prefixedName = this.applyTenantPrefix(name, tenantId);
        const cachedId = this.datasetCache.get(prefixedName);
        if (cachedId) {
          ids.push(cachedId);
        }
      }
    }

    if (ids.length === 0) {
      throw new Error('No dataset IDs provided or found in cache');
    }

    const response = await fetch(`${this.baseUrl}/api/cognify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({
        datasets: ids,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cognee Cloud cognify failed: ${response.status} ${error}`);
    }

    const result = (await response.json()) as CognifyResponse;
    logger.info(`[CogneeCloud] Cognify triggered for ${ids.length} datasets`);
    return result;
  }

  /**
   * Search the knowledge graph.
   */
  async search(
    queryText: string,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    datasetNames?: string[],
    topK: number = 5,
    tenantId?: string,
  ): Promise<SearchResult[]> {
    const prefixedDatasets = datasetNames?.map((name) => this.applyTenantPrefix(name, tenantId));

    const response = await fetch(`${this.baseUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({
        query: queryText,
        search_type: searchType,
        datasets: prefixedDatasets,
        top_k: topK,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cognee Cloud search failed: ${response.status} ${error}`);
    }

    const results = (await response.json()) as SearchResult[];
    logger.info(`[CogneeCloud] Search returned ${results.length} results`);
    return results;
  }

  /**
   * Apply tenant prefix to dataset name for multi-tenant isolation.
   */
  private applyTenantPrefix(datasetName: string, tenantId?: string): string {
    if (tenantId) {
      return `tenant_${tenantId}_${datasetName}`;
    }
    return datasetName;
  }
}

// Global client instance
let cogneeCloudClient: CogneeCloudClient | null = null;

export function getCogneeCloudClient(): CogneeCloudClient {
  if (!cogneeCloudClient) {
    cogneeCloudClient = new CogneeCloudClient();
  }
  return cogneeCloudClient;
}
