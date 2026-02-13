# Agent W15-06: Cognee Datasets Builder

## Role
Configure 3 new Cognee datasets for forecast patterns, anomaly history, and compliance rulings. Wire indexing and search helpers.

## Priority: WAVE 15 (After W15-02 and W15-03 complete)

## Wait Condition
Check for `.agent-done-W15-02` and `.agent-done-W15-03` marker files before starting.

## Context
- Cognee client: `server/src/services/cognee_client.ts` -- HTTP wrapper for Cognee API at localhost:8000
- Cognee tools: `server/src/services/claude/cognee-tools.ts` -- Agent-facing wrapper with dataset prefix support
- Existing datasets: `COGNEE_DATASETS` constant in cognee-tools.ts (financial_insights, transaction_patterns, merchant_data, tax_strategies, tax_rulings, deduction_patterns, loan_products, interest_rates, economic_indicators, rba_data, budget_patterns, spending_insights)
- Search types: CHUNKS (fast vector), CHUNKS_LEXICAL (keyword), GRAPH_COMPLETION (LLM reasoning), RAG_COMPLETION (document retrieval), GRAPH_SUMMARY_COMPLETION

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`

- [ ] Add 3 new dataset constants to `COGNEE_DATASETS` object:
  ```typescript
  // Predictive Analytics domain (Wave 15)
  forecastPatterns: 'forecast_patterns',
  anomalyHistory: 'anomaly_history',
  complianceRulings: 'compliance_rulings',
  ```

- [ ] Add helper method for indexing forecast patterns:
  ```typescript
  async indexForecastPatterns(patterns: Array<{
    period: string;
    category: string;
    trend: string;
    seasonalIndex: number;
    accuracy: number;
  }>): Promise<void> {
    const texts = patterns.map(p =>
      `Forecast pattern: ${p.category} in ${p.period}. Trend: ${p.trend}. Seasonal index: ${p.seasonalIndex.toFixed(2)}. Historical accuracy: ${(p.accuracy * 100).toFixed(1)}%`
    );
    await this.index(texts, COGNEE_DATASETS.forecastPatterns);
  }
  ```

- [ ] Add helper method for indexing anomaly history:
  ```typescript
  async indexAnomalyHistory(anomalies: Array<{
    type: string;
    severity: string;
    description: string;
    resolution: string;
    wasValid: boolean;
  }>): Promise<void> {
    const texts = anomalies.map(a =>
      `Anomaly: ${a.type} (${a.severity}). ${a.description}. Resolution: ${a.resolution}. Valid alert: ${a.wasValid}`
    );
    await this.index(texts, COGNEE_DATASETS.anomalyHistory);
  }
  ```

- [ ] Add helper method for searching compliance rulings:
  ```typescript
  async searchComplianceRulings(query: string): Promise<string[]> {
    return this.search(query, COGNEE_DATASETS.complianceRulings, 'RAG_COMPLETION');
  }
  ```

- [ ] Add helper method for searching forecast context:
  ```typescript
  async searchForecastContext(query: string): Promise<string[]> {
    return this.search(query, COGNEE_DATASETS.forecastPatterns, 'GRAPH_COMPLETION');
  }
  ```

- [ ] Add helper method for searching anomaly precedents:
  ```typescript
  async searchAnomalyPrecedents(query: string): Promise<string[]> {
    return this.search(query, COGNEE_DATASETS.anomalyHistory, 'CHUNKS');
  }
  ```

### 2. `server/src/services/cognee_client.ts`

- [ ] Add JSDoc comments documenting search type recommendations for new datasets:
  - Forecast patterns: `GRAPH_COMPLETION` (relationship-aware trend analysis)
  - Anomaly history: `CHUNKS` (fast similarity matching against past anomalies)
  - Compliance rulings: `RAG_COMPLETION` (document retrieval for ATO rulings)

- [ ] Verify the `cognify()` method sends `custom_prompt` for domain-specific entity extraction (existing behavior -- just verify it works with new dataset names)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `COGNEE_DATASETS` constant includes all 3 new dataset names
- [ ] New helper methods compile without errors
- [ ] `indexForecastPatterns()` calls `this.index()` with correct dataset name
- [ ] `searchComplianceRulings()` calls `this.search()` with 'RAG_COMPLETION' type
- [ ] `searchAnomalyPrecedents()` calls `this.search()` with 'CHUNKS' type
- [ ] Create marker file: `.agent-done-W15-06`

## Dependencies
- **Requires**: W15-02 (`.agent-done-W15-02`), W15-03 (`.agent-done-W15-03`) -- services must exist for type references
- **No file conflicts**: Only W15-06 modifies cognee-tools.ts and cognee_client.ts in Wave 15
