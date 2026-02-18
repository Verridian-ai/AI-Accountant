/**
 * Cognee Admin Module — CogneeAdminService class (thin shell)
 *
 * Delegates to sub-modules: dataset-ops, reindex-ops, graph-maintenance,
 * graph-stats, search-tester, data-quality.
 */

import { CogneeClient } from '../cognee_client.js';
import type {
  DatasetInfo,
  DatasetDetail,
  ReindexOptions,
  ReindexResult,
  PruneResult,
  OrphanedNode,
  GraphStats,
  SearchTestOptions,
  SearchTestResult,
  DataQualityReport,
} from './types.js';
import { listDatasets, getDatasetDetail, createDataset, deleteDataset } from './dataset-ops.js';
import { reindexDataset, reindexAll } from './reindex-ops.js';
import { findOrphanedNodes, pruneStaleNodes, mergeDuplicateNodes } from './graph-maintenance.js';
import { getGraphStats } from './graph-stats.js';
import { testSearch } from './search-tester.js';
import { getDataQualityReport } from './data-quality.js';

export class CogneeAdminService {
  private cogneeClient: CogneeClient;

  constructor(cogneeClient?: CogneeClient) {
    this.cogneeClient = cogneeClient ?? new CogneeClient();
  }

  listDatasets(): Promise<DatasetInfo[]> {
    return listDatasets(this.cogneeClient);
  }

  getDatasetDetail(datasetName: string): Promise<DatasetDetail> {
    return getDatasetDetail(this.cogneeClient, datasetName);
  }

  createDataset(name: string): Promise<void> {
    return createDataset(this.cogneeClient, name);
  }

  deleteDataset(datasetName: string): Promise<{ deleted: boolean; error?: string }> {
    return deleteDataset(this.cogneeClient, datasetName);
  }

  reindexDataset(datasetName: string, options?: ReindexOptions): Promise<ReindexResult> {
    return reindexDataset(this.cogneeClient, datasetName, options);
  }

  reindexAll(): Promise<Record<string, ReindexResult>> {
    return reindexAll(this.cogneeClient);
  }

  findOrphanedNodes(datasetName: string): Promise<OrphanedNode[]> {
    return findOrphanedNodes(this.cogneeClient, datasetName);
  }

  pruneStaleNodes(datasetName: string, olderThanDays: number): Promise<PruneResult> {
    return pruneStaleNodes(this.cogneeClient, datasetName, olderThanDays);
  }

  mergeDuplicateNodes(
    datasetName: string,
  ): Promise<{ mergesPerformed: number; duplicatesFound: number }> {
    return mergeDuplicateNodes(this.cogneeClient, datasetName);
  }

  getGraphStats(): Promise<GraphStats> {
    return getGraphStats(this.cogneeClient);
  }

  testSearch(query: string, options: SearchTestOptions): Promise<SearchTestResult> {
    return testSearch(this.cogneeClient, query, options);
  }

  getDataQualityReport(datasetName: string): Promise<DataQualityReport> {
    return getDataQualityReport(this.cogneeClient, datasetName);
  }

  isHealthy(): Promise<boolean> {
    return this.cogneeClient.isHealthy();
  }
}
