/**
 * Claude Agent Framework — Cognee RAG Tools
 *
 * Thin wrapper around cogneeClient (the single source of truth for Cognee HTTP).
 * Adds dataset-prefix support and batch chunking for agent use.
 */

import { cogneeClient } from '../cognee_client.js';
import type { CogneeSearchType } from '../cognee_client.js';

export interface CogneeToolConfig {
  searchTopK: number;
  indexBatchSize: number;
  datasetPrefix: string;
}

const DEFAULT_CONFIG: CogneeToolConfig = {
  searchTopK: 5,
  indexBatchSize: 50,
  datasetPrefix: '',
};

export class CogneeTools {
  private config: CogneeToolConfig;

  constructor(config: Partial<CogneeToolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Search Cognee knowledge graph for relevant context.
   * Supports configurable search type for different use cases.
   */
  async search(
    query: string,
    dataset: string,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION'
  ): Promise<string[]> {
    return cogneeClient.search(
      query,
      this.prefixDataset(dataset),
      this.config.searchTopK,
      searchType
    );
  }

  /**
   * Index data into a Cognee dataset.
   * Delegates to cogneeClient.add() which uses multipart FormData.
   */
  async index(data: string[], dataset: string): Promise<void> {
    for (let i = 0; i < data.length; i += this.config.indexBatchSize) {
      const batch = data.slice(i, i + this.config.indexBatchSize);
      await cogneeClient.add(batch, this.prefixDataset(dataset));
    }
  }

  /**
   * Build knowledge graph from indexed data.
   * Passes dataset name to cognify (required — empty body returns 400).
   */
  async cognify(dataset: string): Promise<void> {
    await cogneeClient.cognify([this.prefixDataset(dataset)], true);
  }

  /**
   * Index data and then trigger cognify in one step.
   */
  async indexAndCognify(data: string[], dataset: string): Promise<void> {
    await this.index(data, dataset);
    await this.cognify(dataset);
  }

  private prefixDataset(dataset: string): string {
    return this.config.datasetPrefix
      ? `${this.config.datasetPrefix}_${dataset}`
      : dataset;
  }
}

export const cogneeTools = new CogneeTools();
