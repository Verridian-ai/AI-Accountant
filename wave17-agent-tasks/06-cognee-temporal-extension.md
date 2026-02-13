# Agent W17-06: Cognee Temporal Extension

## Role
Update cognee_client.ts and cognee-tools.ts with temporal search methods, time-aware indexing, and cross-module intelligence tools for agent consumption.

## Priority: WAVE 17 (After W17-02 and W17-03 complete)

## Wait Condition
Check for `.agent-done-W17-02` and `.agent-done-W17-03` marker files before starting.

## Context
- Cognee client: `server/src/services/cognee_client.ts` -- central HTTP wrapper
- Cognee tools: `server/src/services/claude/cognee-tools.ts` -- agent-facing wrapper
- Temporal service: `server/src/services/temporal-cognify.ts` (from W17-02)
- Cross-module service: `server/src/services/cross-module-intelligence.ts` (from W17-03)

## Files to MODIFY

### 1. `server/src/services/cognee_client.ts`
**Purpose**: Add temporal-aware API methods

- [ ] Add temporal search method:
  ```typescript
  async temporalSearch(query: string, options: {
    dataset: string;
    timeStart: string;
    timeEnd?: string;
    searchType?: string;
    topK?: number;
  }): Promise<unknown> {
    // Constructs time-enriched query for Cognee
    const enrichedQuery = `[TIME: ${options.timeStart}${options.timeEnd ? ' to ' + options.timeEnd : ''}] ${query}`;
    return this.search({
      query: enrichedQuery,
      search_type: options.searchType || 'GRAPH_COMPLETION',
      datasets: [options.dataset],
      top_k: options.topK || 5,
    });
  }
  ```

- [ ] Add temporal cognify method:
  ```typescript
  async temporalCognify(dataset: string, options: {
    customPrompt?: string;
    timeField?: string;
    addTemporalRelations?: boolean;
  }): Promise<unknown> {
    const prompt = options.customPrompt ||
      `Extract entities with temporal awareness. For each entity, identify: time period, sequence relationships (before/after/during), and temporal patterns (recurring, one-time, seasonal). Time field: ${options.timeField || 'date'}.`;
    return this.cognify({
      datasets: [dataset],
      run_in_background: true,
      custom_prompt: prompt,
    });
  }
  ```

- [ ] Add cross-dataset search method:
  ```typescript
  async crossDatasetSearch(query: string, datasets: string[], options?: {
    searchType?: string;
    topK?: number;
    mergeResults?: boolean;
  }): Promise<unknown[]> {
    // Search across multiple datasets and merge results
    const results = await Promise.all(
      datasets.map(dataset =>
        this.search({
          query,
          search_type: options?.searchType || 'CHUNKS',
          datasets: [dataset],
          top_k: options?.topK || 3,
        })
      )
    );
    return options?.mergeResults !== false ? results.flat() : results;
  }
  ```

### 2. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Add temporal and cross-module tools for agent consumption

- [ ] Add 3 new dataset constants to `COGNEE_DATASETS`:
  ```typescript
  // Temporal Intelligence domain (Wave 17)
  temporalPatterns: 'temporal_patterns',
  crossModuleInsights: 'cross_module_insights',
  moduleRelationships: 'module_relationships',
  ```

- [ ] Add temporal search helper:
  ```typescript
  async temporalSearch(
    query: string,
    dataset: string,
    timeRange: { start: string; end?: string },
    options?: { searchType?: string; topK?: number }
  ): Promise<string[]> {
    const temporalService = new TemporalCognifyService();
    const results = await temporalService.timeAwareSearch(query, {
      dataset,
      timeStart: timeRange.start,
      timeEnd: timeRange.end,
      searchType: options?.searchType,
      topK: options?.topK,
    });
    return results.map(r => r.content);
  }
  ```

- [ ] Add cross-module search helper:
  ```typescript
  async crossModuleSearch(
    query: string,
    modules: string[],
    options?: { topK?: number }
  ): Promise<string[]> {
    const datasets = modules.map(m => this._moduleToDataset(m));
    const client = new CogneeClient();
    const results = await client.crossDatasetSearch(query, datasets, {
      searchType: 'GRAPH_COMPLETION',
      topK: options?.topK || 3,
      mergeResults: true,
    });
    return Array.isArray(results) ? results.map(r => String(r)) : [];
  }

  private _moduleToDataset(module: string): string {
    const mapping: Record<string, string> = {
      'transactions': COGNEE_DATASETS.transactionPatterns,
      'forecasting': COGNEE_DATASETS.forecastPatterns,
      'compliance': COGNEE_DATASETS.complianceRulings,
      'anomaly_detection': COGNEE_DATASETS.anomalyHistory,
      'tax': COGNEE_DATASETS.taxStrategies,
      'knowledge': COGNEE_DATASETS.financialInsights,
      'merchant': COGNEE_DATASETS.merchantData,
    };
    return mapping[module] || COGNEE_DATASETS.financialInsights;
  }
  ```

- [ ] Add timeline search helper:
  ```typescript
  async searchTimeline(
    query: string,
    timeRange: { start: string; end: string },
    modules?: string[]
  ): Promise<string[]> {
    const targetModules = modules || ['transactions', 'forecasting', 'compliance', 'tax'];
    const datasets = targetModules.map(m => this._moduleToDataset(m));
    const client = new CogneeClient();
    const results = await client.crossDatasetSearch(
      `[TIMELINE: ${timeRange.start} to ${timeRange.end}] ${query}`,
      datasets,
      { searchType: 'GRAPH_COMPLETION', topK: 5, mergeResults: true }
    );
    return Array.isArray(results) ? results.map(r => String(r)) : [];
  }
  ```

- [ ] Add insight indexing helper:
  ```typescript
  async indexCrossModuleInsight(insight: {
    type: string;
    title: string;
    description: string;
    modules: string[];
    evidence: string;
  }): Promise<void> {
    const text = `Cross-module insight (${insight.type}): ${insight.title}. ${insight.description}. Modules: ${insight.modules.join(', ')}. Evidence: ${insight.evidence}`;
    await this.index([text], COGNEE_DATASETS.crossModuleInsights);
  }
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `temporalSearch()` on CogneeClient enriches query with time context
- [ ] `temporalCognify()` on CogneeClient sends temporal-aware custom prompt
- [ ] `crossDatasetSearch()` on CogneeClient searches multiple datasets and merges results
- [ ] `temporalSearch()` on cognee-tools calls TemporalCognifyService correctly
- [ ] `crossModuleSearch()` on cognee-tools maps module names to datasets
- [ ] `_moduleToDataset()` correctly maps all known module names
- [ ] `searchTimeline()` constructs timeline-enriched query
- [ ] `COGNEE_DATASETS` includes all Wave 17 dataset names
- [ ] Existing methods (add, search, cognify) still work unchanged
- [ ] Create marker file: `.agent-done-W17-06`

## Dependencies
- **Requires**: W17-02 (`.agent-done-W17-02`), W17-03 (`.agent-done-W17-03`) -- temporal and cross-module services
- **IMPORTANT**: Only W17-06 modifies cognee-tools.ts and cognee_client.ts in Wave 17
