# Agent 5: Cognee Admin Builder

## Role
Build an admin service for managing Cognee datasets, triggering reindex operations, pruning stale nodes, viewing graph statistics, and providing dataset-level operations via the Cognee API.

## Priority: WAVE 20 (After Agent 1)

## Wait Condition
Check for `.agent-done-W20-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/cognee-admin.ts`
**Purpose**: Cognee administration, dataset management, and graph operations
**Pattern**: Builds on `server/src/services/cognee_client.ts` CogneeClient

- [ ] Create `CogneeAdminService` class:
  ```typescript
  import { CogneeClient } from './cognee_client.js';

  class CogneeAdminService {
    private cogneeClient: CogneeClient;

    constructor(cogneeClient?: CogneeClient) {
      this.cogneeClient = cogneeClient ?? new CogneeClient();
    }
  }
  ```

- [ ] **Dataset Management**:

  `async listDatasets(): Promise<DatasetInfo[]>`
  ```typescript
  interface DatasetInfo {
    name: string;
    documentCount: number;
    status: string;
    createdAt: string;
    lastCognified: string | null;
    sizeEstimate: string;
    category: 'transactions' | 'merchants' | 'tax' | 'cdr' | 'market' | 'general';
  }
  ```
  - Call `cogneeClient.listDatasets()`
  - Enrich with document counts and status
  - Categorize known datasets:
    - transactions: `financial_transactions`
    - merchants: `merchant_data`, `merchant_intelligence`
    - tax: `tax_rulings`, `gst_rulings`
    - cdr: `cdr_products`, `cdr_rates`, `banking_product_knowledge`
    - market: `market_intelligence`, `market_sentiment`, `rba_statistics`, `abs_statistics`, `asx_market_data`
    - general: everything else

  `async getDatasetDetail(datasetName: string): Promise<DatasetDetail>`
  ```typescript
  interface DatasetDetail {
    name: string;
    documentCount: number;
    nodeCount: number;
    edgeCount: number;
    status: string;
    documents: Array<{ id: string; name: string; addedAt: string; size: number }>;
    graphSummary: {
      entityTypes: Record<string, number>;     // e.g. { merchant: 15, transaction: 200, category: 12 }
      relationshipTypes: Record<string, number>; // e.g. { categorized_as: 180, paid_to: 200 }
      avgDegree: number;
    };
  }
  ```
  - Call `cogneeClient.getDatasetStatus(datasetName)` and `cogneeClient.getDatasetGraph(datasetName)`
  - Parse graph response to count entity and relationship types

  `async createDataset(name: string): Promise<void>`
  - Call `cogneeClient.createDataset(name)`

  `async deleteDataset(datasetName: string): Promise<void>`
  - Delete all data in a Cognee dataset
  - Requires confirmation (admin-only operation)

- [ ] **Reindex Operations**:

  `async reindexDataset(datasetName: string, options?: ReindexOptions): Promise<ReindexResult>`
  ```typescript
  interface ReindexOptions {
    customPrompt?: string;
    runInBackground?: boolean;        // default true
  }

  interface ReindexResult {
    datasetName: string;
    status: 'started' | 'completed' | 'failed';
    documentsProcessed: number;
    nodesCreated: number;
    edgesCreated: number;
    durationMs: number;
    error?: string;
  }
  ```
  - Clear existing graph data for the dataset
  - Re-run `cogneeClient.cognify()` with custom prompt if provided
  - Track progress and report results

  `async reindexAll(): Promise<Record<string, ReindexResult>>`
  - Reindex all known datasets sequentially
  - Return per-dataset results
  - Emit SSE events: `cognee:reindex:progress`, `cognee:reindex:complete`

- [ ] **Node Pruning**:

  `async pruneStaleNodes(datasetName: string, olderThanDays: number): Promise<PruneResult>`
  ```typescript
  interface PruneResult {
    datasetName: string;
    nodesRemoved: number;
    edgesRemoved: number;
    criteria: string;
  }
  ```
  - Identify nodes not updated in `olderThanDays`
  - Remove orphaned nodes (no edges)
  - Remove duplicate nodes (same entity, different IDs)
  - Careful: only prune if node has no recent edges

  `async findOrphanedNodes(datasetName: string): Promise<Array<{ id: string; type: string; name: string }>>`
  - Find nodes with zero connections
  - Return for admin review before deletion

  `async mergeDuplicateNodes(datasetName: string): Promise<{ mergesPerformed: number }>`
  - Find nodes with same name and type
  - Merge by redirecting edges to single canonical node
  - Delete duplicate nodes

- [ ] **Graph Statistics**:

  `async getGraphStats(): Promise<GraphStats>`
  ```typescript
  interface GraphStats {
    totalDatasets: number;
    totalNodes: number;
    totalEdges: number;
    totalDocuments: number;
    datasetBreakdown: Array<{
      name: string;
      category: string;
      nodes: number;
      edges: number;
      documents: number;
      lastCognified: string | null;
    }>;
    entityTypeDistribution: Record<string, number>;
    relationshipTypeDistribution: Record<string, number>;
    topConnectedEntities: Array<{ name: string; type: string; connections: number }>;
    graphDensity: number;
    avgPathLength: number | null;
  }
  ```
  - Aggregate statistics across all datasets
  - Identify most connected entities (hubs)
  - Calculate graph density (edges / possible edges)

- [ ] **Search Testing**:

  `async testSearch(query: string, options: SearchTestOptions): Promise<SearchTestResult>`
  ```typescript
  interface SearchTestOptions {
    datasets?: string[];
    searchTypes?: string[];           // CHUNKS, CHUNKS_LEXICAL, GRAPH_COMPLETION, etc.
    topK?: number;
  }

  interface SearchTestResult {
    query: string;
    results: Array<{
      searchType: string;
      dataset: string;
      resultCount: number;
      topResults: Array<{ content: string; score: number; metadata: any }>;
      latencyMs: number;
    }>;
    totalLatencyMs: number;
  }
  ```
  - Run search across multiple datasets and search types
  - Compare result quality between search types
  - Useful for admin testing and debugging

- [ ] **Data Quality**:

  `async getDataQualityReport(datasetName: string): Promise<DataQualityReport>`
  ```typescript
  interface DataQualityReport {
    datasetName: string;
    documentCount: number;
    avgDocumentLength: number;
    orphanedNodeCount: number;
    duplicateNodeCount: number;
    disconnectedComponents: number;
    largestComponent: number;
    recommendations: string[];
  }
  ```
  - Analyze graph structure quality
  - Identify issues: orphans, duplicates, disconnected subgraphs
  - Generate recommendations for improvement

## Files to MODIFY

None.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `listDatasets()` returns all Cognee datasets with correct categorization
- [ ] `getDatasetDetail()` returns node/edge counts and entity type breakdown
- [ ] `reindexDataset()` successfully re-cognifies a dataset
- [ ] `findOrphanedNodes()` identifies nodes with zero connections
- [ ] `getGraphStats()` returns aggregated statistics across all datasets
- [ ] `testSearch()` runs search across multiple search types and reports results
- [ ] `getDataQualityReport()` generates actionable recommendations
- [ ] Create marker file: `.agent-done-W20-05`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W20-01`) for admin schema/tables
- **Reuses**: `server/src/services/cognee_client.ts` (CogneeClient class), SSE event patterns
