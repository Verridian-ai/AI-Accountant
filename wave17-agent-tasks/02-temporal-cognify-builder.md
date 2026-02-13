# Agent W17-02: Temporal Cognify Builder

## Role
Build the temporal cognify service that wires Cognee temporal features. Enable time-aware search, temporal metadata enrichment, and time-range cognification.

## Priority: WAVE 17 (After W17-01 completes schema)

## Wait Condition
Check for `.agent-done-W17-01` marker file before starting.

## Context
- Cognee client: `server/src/services/cognee_client.ts` -- HTTP wrapper for Cognee API
- Cognee cognify: POST /v1/cognify -- processes datasets with optional parameters
- Existing temporal data: transactions have `date` field, forecasts have period dates, compliance has due_date
- Cognee search: supports time-based filtering when metadata includes timestamps
- Schema: `temporalQueries` table (from W17-01)

## Files to CREATE

### 1. `server/src/services/temporal-cognify.ts`
**Purpose**: Temporal intelligence layer on top of Cognee -- time-aware indexing, search, and query management
**Pattern**: Follow `server/src/services/cognee_client.ts`

- [ ] Create `TemporalCognifyService` class with the following methods:

  - `temporalCognify(datasetName: string, options: TemporalCognifyOptions): Promise<TemporalCognifyResult>` -- Enriches dataset with temporal metadata before cognification. Adds time dimensions to entities (year, quarter, month, week, day_of_week, is_efy_period, is_bas_quarter). Triggers Cognee cognify with temporal-aware custom prompt. Stores temporal context as metadata on nodes.
    ```typescript
    interface TemporalCognifyOptions {
      timeField: string; // field name containing date (e.g., 'date', 'due_date')
      dateFormat?: string; // 'ISO' | 'AU_DATE' | 'US_DATE'
      timeGranularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      addSeasonalContext?: boolean; // add Australian seasonal markers (EOFY, Christmas, Easter)
      addBusinessCycleContext?: boolean; // add BAS quarter, tax period markers
      customPrompt?: string;
    }
    interface TemporalCognifyResult {
      dataset: string;
      entitiesProcessed: number;
      temporalMetadataAdded: number;
      timeRange: { start: string; end: string };
      granularityUsed: string;
      status: 'completed' | 'in_progress' | 'failed';
    }
    ```

  - `timeAwareSearch(query: string, timeOptions: TimeSearchOptions): Promise<TemporalSearchResult[]>` -- Searches Cognee with temporal context. Constructs time-enriched query (appends time range, period context). Uses GRAPH_COMPLETION for relationship-aware time search. Filters results by time range if Cognee returns broader results.
    ```typescript
    interface TimeSearchOptions {
      dataset: string;
      timeStart: string;
      timeEnd?: string;
      timeGranularity?: string;
      searchType?: string; // Cognee search type, default 'GRAPH_COMPLETION'
      includeAdjacentPeriods?: boolean; // also search +/- 1 period for context
      topK?: number;
    }
    interface TemporalSearchResult {
      content: string;
      score: number;
      temporalMetadata: {
        date?: string;
        period?: string;
        quarter?: string;
        financialYear?: string;
      };
      source: string;
    }
    ```

  - `addTimeMetadata(entities: Array<Record<string, unknown>>, timeField: string): Array<Record<string, unknown>>` -- Pure function that enriches entity records with temporal metadata fields. Adds: `_year`, `_quarter` (Q1-Q4), `_month` (1-12), `_week` (1-52), `_day_of_week` (Mon-Sun), `_financial_year` (e.g., '2024-25'), `_bas_quarter` (Jul-Sep=Q1, Oct-Dec=Q2, Jan-Mar=Q3, Apr-Jun=Q4), `_is_eofy` (June), `_is_christmas_period` (Dec-Jan), `_season` (Australian: summer Dec-Feb, autumn Mar-May, winter Jun-Aug, spring Sep-Nov).

  - `executeTemporalQuery(userId: string, query: TemporalQueryInput): Promise<TemporalQueryResult>` -- Executes a saved or ad-hoc temporal query. Translates query_type into Cognee search strategy. Caches results with configurable expiry. Updates execution stats.
    ```typescript
    interface TemporalQueryInput {
      queryType: 'point_in_time' | 'time_range' | 'trend_over_time' | 'comparison' | 'evolution';
      targetEntity: string;
      timeStart: string;
      timeEnd?: string;
      timeGranularity?: string;
      parameters: Record<string, unknown>;
      useCache?: boolean;
    }
    interface TemporalQueryResult {
      queryId: string;
      results: TemporalSearchResult[];
      summary: string;
      timeRange: { start: string; end: string };
      fromCache: boolean;
      executionMs: number;
    }
    ```

  - `saveQuery(userId: string, query: TemporalQueryInput & { name: string; description?: string }): Promise<TemporalQuery>` -- Persists query to `temporalQueries` table for reuse.

  - `listSavedQueries(userId: string, filters?: { queryType?: string; targetEntity?: string }): Promise<TemporalQuery[]>` -- List saved temporal queries.

  - `getQueryById(queryId: string): Promise<TemporalQuery>` -- Single query by ID.

  - `deleteQuery(queryId: string): Promise<void>` -- Remove saved query.

  - `getTemporalTimeline(userId: string, entityType: string, timeRange: { start: string; end: string }): Promise<TimelineEvent[]>` -- Generates a timeline of events for an entity type across a time range. Aggregates from multiple data sources (transactions, forecasts, compliance, anomalies). Returns chronologically ordered events.
    ```typescript
    interface TimelineEvent {
      date: string;
      type: string;
      module: string; // source module
      title: string;
      description: string;
      severity?: string;
      amount?: number;
      relatedEntityId?: string;
    }
    ```

- [ ] Implement private helper methods:
  - `_buildTemporalPrompt(options: TemporalCognifyOptions): string` -- Constructs cognify prompt with temporal awareness instructions
  - `_enrichQueryWithTimeContext(query: string, timeOptions: TimeSearchOptions): string` -- Adds time range and period context to search query string
  - `_parseAustralianFinancialYear(date: Date): string` -- Returns '2024-25' format for given date
  - `_getBasQuarter(date: Date): string` -- Returns 'Q1' through 'Q4' based on Australian BAS quarters (Jul-Sep=Q1)
  - `_checkCache(queryId: string): TemporalQueryResult | null` -- Check result cache validity
  - `_updateCache(queryId: string, result: TemporalQueryResult, ttlMinutes: number): void` -- Store in cache

- [ ] Wire Drizzle ORM queries against `temporalQueries` table
- [ ] Wire CogneeClient for cognify and search operations

## Files to MODIFY

None -- standalone service. Uses existing CogneeClient methods.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `TemporalCognifyService` can be instantiated without errors
- [ ] `addTimeMetadata()` correctly calculates Australian financial year (Jul 2024 -> '2024-25')
- [ ] `addTimeMetadata()` correctly identifies BAS quarters (Oct = Q2, Apr = Q3)
- [ ] `timeAwareSearch()` enriches query with temporal context before Cognee search
- [ ] `temporalCognify()` calls Cognee cognify with temporal custom prompt
- [ ] `executeTemporalQuery()` uses cache when available and cache not expired
- [ ] `saveQuery()` persists to temporalQueries table
- [ ] `getTemporalTimeline()` returns chronologically ordered events
- [ ] `_parseAustralianFinancialYear(new Date('2025-06-30'))` returns '2024-25'
- [ ] `_parseAustralianFinancialYear(new Date('2025-07-01'))` returns '2025-26'
- [ ] Create marker file: `.agent-done-W17-02`

## Dependencies
- **Requires**: W17-01 (`.agent-done-W17-01`) -- temporalQueries table must exist
- **Reuses**: schema.ts (temporalQueries), cognee_client.ts (cognify, search)
