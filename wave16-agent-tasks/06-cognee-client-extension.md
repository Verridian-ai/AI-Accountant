# Agent W16-06: Cognee Client Extension

## Role
Update cognee_client.ts and cognee-tools.ts with DataPoint, ontology, feedback, memify, and NodeSet methods for agent consumption.

## Priority: WAVE 16 (After W16-02, W16-03, W16-04 complete)

## Wait Condition
Check for `.agent-done-W16-02`, `.agent-done-W16-03`, `.agent-done-W16-04` marker files before starting.

## Context
- Cognee client: `server/src/services/cognee_client.ts` -- central HTTP wrapper for all Cognee API calls
- Cognee tools: `server/src/services/claude/cognee-tools.ts` -- agent-facing wrapper with dataset prefix support
- New services: cognee-datapoints.ts (W16-02), cognee-ontologies.ts (W16-03), cognee-feedback.ts (W16-04)
- Note: W16-04 may have already added `submitFeedback()` and `triggerMemify()` to cognee_client.ts -- verify before adding duplicates

## Files to MODIFY

### 1. `server/src/services/cognee_client.ts`
**Purpose**: Add DataPoint, ontology, and NodeSet API methods

- [ ] Add DataPoint management methods (verify not already added by W16-04):
  ```typescript
  async createDataPoint(datasetName: string, schema: Record<string, unknown>): Promise<unknown> {
    return this.post(`/v1/datasets/${datasetName}/data_points`, schema);
  }

  async getDataPoints(datasetName: string): Promise<unknown> {
    return this.get(`/v1/datasets/${datasetName}/data_points`);
  }

  async deleteDataPoint(datasetName: string, datapointId: string): Promise<void> {
    await this.delete(`/v1/datasets/${datasetName}/data_points/${datapointId}`);
  }
  ```

- [ ] Add ontology management methods:
  ```typescript
  async applyOntology(datasetName: string, ontology: Record<string, unknown>): Promise<unknown> {
    return this.post(`/v1/datasets/${datasetName}/ontology`, ontology);
  }

  async getOntology(datasetName: string): Promise<unknown> {
    return this.get(`/v1/datasets/${datasetName}/ontology`);
  }
  ```

- [ ] Add NodeSet methods (for graph manipulation):
  ```typescript
  async getNodeSets(datasetName: string): Promise<unknown> {
    return this.get(`/v1/datasets/${datasetName}/node_sets`);
  }

  async createNodeSet(datasetName: string, nodeSet: { name: string; nodeIds: string[] }): Promise<unknown> {
    return this.post(`/v1/datasets/${datasetName}/node_sets`, nodeSet);
  }

  async deleteNodeSet(datasetName: string, nodeSetId: string): Promise<void> {
    await this.delete(`/v1/datasets/${datasetName}/node_sets/${nodeSetId}`);
  }
  ```

- [ ] Verify existing methods still work: `add()`, `search()`, `cognify()`, `listDatasets()`, `getDatasetStatus()`, `getDatasetGraph()`
- [ ] Add `delete()` HTTP helper if not present (for DELETE requests)

### 2. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Add DataPoint-aware tools and ontology tools for agent consumption

- [ ] Add 3 new dataset constants to `COGNEE_DATASETS`:
  ```typescript
  // Knowledge Graph domain (Wave 16)
  datapointSchemas: 'datapoint_schemas',
  ontologyDefinitions: 'ontology_definitions',
  feedbackHistory: 'feedback_history',
  ```

- [ ] Add DataPoint-aware search helper:
  ```typescript
  async searchWithDataPoint(
    query: string,
    datapointType: string,
    dataset?: string
  ): Promise<string[]> {
    // Uses the DataPoint schema to structure the search
    const targetDataset = dataset || this._getDefaultDataset(datapointType);
    return this.search(query, targetDataset, 'GRAPH_COMPLETION');
  }

  private _getDefaultDataset(datapointType: string): string {
    const mapping: Record<string, string> = {
      'FinancialTransaction': COGNEE_DATASETS.transactionPatterns,
      'BusinessRelationship': COGNEE_DATASETS.merchantData,
      'TaxEvent': COGNEE_DATASETS.taxStrategies,
      'MerchantProfile': COGNEE_DATASETS.merchantData,
      'RecurringPattern': COGNEE_DATASETS.transactionPatterns,
      'ComplianceObligation': COGNEE_DATASETS.complianceRulings,
    };
    return mapping[datapointType] || COGNEE_DATASETS.financialInsights;
  }
  ```

- [ ] Add ontology-aware search helper:
  ```typescript
  async searchWithOntology(
    query: string,
    ontologyType: string,
    options?: { searchType?: string; topK?: number }
  ): Promise<string[]> {
    const searchType = options?.searchType || 'GRAPH_COMPLETION';
    const dataset = this._getOntologyDataset(ontologyType);
    return this.search(query, dataset, searchType);
  }

  private _getOntologyDataset(ontologyType: string): string {
    const mapping: Record<string, string> = {
      'financial': COGNEE_DATASETS.financialInsights,
      'tax': COGNEE_DATASETS.taxStrategies,
      'relationship': COGNEE_DATASETS.merchantData,
      'compliance': COGNEE_DATASETS.complianceRulings,
      'merchant': COGNEE_DATASETS.merchantData,
    };
    return mapping[ontologyType] || COGNEE_DATASETS.financialInsights;
  }
  ```

- [ ] Add feedback submission helper:
  ```typescript
  async submitSearchFeedback(
    query: string,
    resultId: string,
    feedbackType: 'correct' | 'incorrect' | 'partial' | 'irrelevant',
    correctedValue?: string
  ): Promise<void> {
    const client = new CogneeClient();
    await client.submitFeedback({
      entity_id: resultId,
      feedback_type: feedbackType,
      original_value: query,
      corrected_value: correctedValue,
      context: { query, search_type: 'agent_search' },
    });
  }
  ```

- [ ] Add graph exploration helper:
  ```typescript
  async exploreGraph(
    datasetName: string,
    startNodeId?: string,
    depth?: number
  ): Promise<{ summary: string; nodeCount: number; edgeCount: number }> {
    const graphService = new CogneeGraphService();
    const stats = await graphService.getGraphStats(datasetName);
    return {
      summary: `Dataset "${datasetName}" contains ${stats.nodeCount} nodes and ${stats.edgeCount} edges with density ${stats.density.toFixed(3)}`,
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
    };
  }
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All new CogneeClient methods callable without errors
- [ ] `createDataPoint()` sends POST to correct endpoint
- [ ] `applyOntology()` sends POST to correct endpoint
- [ ] `searchWithDataPoint()` maps DataPoint types to correct datasets
- [ ] `searchWithOntology()` maps ontology types to correct datasets
- [ ] `submitSearchFeedback()` calls CogneeClient.submitFeedback()
- [ ] `COGNEE_DATASETS` includes all Wave 16 dataset names
- [ ] Existing methods (add, search, cognify) still work unchanged
- [ ] Create marker file: `.agent-done-W16-06`

## Dependencies
- **Requires**: W16-02 (`.agent-done-W16-02`), W16-03 (`.agent-done-W16-03`), W16-04 (`.agent-done-W16-04`)
- **IMPORTANT**: Only W16-06 modifies cognee-tools.ts in Wave 16. W16-04 may modify cognee_client.ts -- check for existing methods before adding duplicates
- **Reuses**: cognee_client.ts, cognee-datapoints.ts, cognee-ontologies.ts, cognee-feedback.ts, cognee-graph.ts
