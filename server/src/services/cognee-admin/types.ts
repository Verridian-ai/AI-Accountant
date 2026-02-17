/**
 * Cognee Admin Module — Type Definitions
 */

import type { CogneeSearchType } from '../cognee_client.js';

export type DatasetCategory = 'transactions' | 'merchants' | 'tax' | 'cdr' | 'market' | 'general';

export interface DatasetInfo {
  name: string;
  id: string;
  documentCount: number;
  status: string;
  category: DatasetCategory;
  lastCognified: string | null;
  sizeEstimate: string;
}

export interface DatasetDetail {
  name: string;
  documentCount: number;
  nodeCount: number;
  edgeCount: number;
  status: string;
  graphSummary: {
    entityTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
    avgDegree: number;
  };
}

export interface ReindexOptions {
  customPrompt?: string;
  runInBackground?: boolean;
}

export interface ReindexResult {
  datasetName: string;
  status: 'started' | 'completed' | 'failed';
  nodesCreated: number;
  edgesCreated: number;
  durationMs: number;
  error?: string;
}

export interface PruneResult {
  datasetName: string;
  nodesRemoved: number;
  edgesRemoved: number;
  criteria: string;
}

export interface OrphanedNode {
  id: string;
  type: string;
  name: string;
}

export interface GraphStats {
  totalDatasets: number;
  totalNodes: number;
  totalEdges: number;
  totalDocuments: number;
  datasetBreakdown: Array<{
    name: string;
    category: string;
    nodes: number;
    edges: number;
    lastCognified: string | null;
  }>;
  entityTypeDistribution: Record<string, number>;
  relationshipTypeDistribution: Record<string, number>;
  topConnectedEntities: Array<{ name: string; type: string; connections: number }>;
  graphDensity: number;
  avgPathLength: number | null;
}

export interface SearchTestOptions {
  datasets?: string[];
  searchTypes?: CogneeSearchType[];
  topK?: number;
}

export interface SearchTestResult {
  query: string;
  results: Array<{
    searchType: string;
    dataset: string;
    resultCount: number;
    topResults: Array<{
      content: string;
      score: number | undefined;
      metadata: Record<string, unknown> | undefined;
    }>;
    latencyMs: number;
  }>;
  totalLatencyMs: number;
}

export interface DataQualityReport {
  datasetName: string;
  nodeCount: number;
  edgeCount: number;
  orphanedNodeCount: number;
  duplicateNodeCount: number;
  disconnectedComponents: number;
  largestComponent: number;
  graphDensity: number;
  avgDegree: number;
  recommendations: string[];
}

/** Maps known dataset names to their admin categories. */
export const DATASET_CATEGORY_MAP: Record<string, DatasetCategory> = {
  financial_transactions: 'transactions',
  bank_transactions: 'transactions',
  transfer_patterns: 'transactions',
  merchant_data: 'merchants',
  merchant_intelligence: 'merchants',
  merchant_mappings: 'merchants',
  merchant_corrections: 'merchants',
  tax_rulings: 'tax',
  gst_rulings: 'tax',
  gst_rules: 'tax',
  tax_strategies: 'tax',
  deduction_patterns: 'tax',
  cdr_products: 'cdr',
  cdr_rates: 'cdr',
  banking_product_knowledge: 'cdr',
  market_intelligence: 'market',
  market_sentiment: 'market',
  rba_statistics: 'market',
  abs_statistics: 'market',
  asx_market_data: 'market',
};
