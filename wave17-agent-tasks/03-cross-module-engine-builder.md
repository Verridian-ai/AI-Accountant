# Agent W17-03: Cross-Module Intelligence Engine Builder

## Role
Build the cross-module intelligence engine that discovers correlations, cascading anomalies, and actionable insights across all platform modules.

## Priority: WAVE 17 (After W17-01 completes schema)

## Wait Condition
Check for `.agent-done-W17-01` marker file before starting.

## Context
- Modules: transactions, forecasting, compliance, anomaly_detection, tax, bas, knowledge, accounts, analytics
- Module connections: predefined in `moduleConnections` table (from W17-01 migration)
- Existing services: CashFlowForecastService, AnomalyDetectionService, ComplianceMonitorService, BAS service, Tax service
- Schema: `crossModuleInsights`, `moduleConnections` tables (from W17-01)

## Files to CREATE

### 1. `server/src/services/cross-module-intelligence.ts`
**Purpose**: Discover actionable insights by correlating data across all platform modules
**Pattern**: Follow `server/src/services/anomaly-detection.ts` for multi-strategy scanning

- [ ] Create `CrossModuleIntelligenceService` class with the following methods:

  - `scanForInsights(userId: string, options?: InsightScanOptions): Promise<CrossModuleInsight[]>` -- Main entry point. Runs all correlation scanners in sequence. De-duplicates similar insights. Ranks by severity and confidence. Persists new insights to DB.
    ```typescript
    interface InsightScanOptions {
      modules?: string[]; // limit to specific modules (default: all)
      timeRange?: { start: string; end: string };
      minConfidence?: number; // default 0.5
      severityFilter?: string[];
      maxInsights?: number; // default 50
    }
    ```

  - `findCorrelations(userId: string, moduleA: string, moduleB: string): Promise<Correlation[]>` -- Discovers statistical correlations between two modules. Fetches key metrics from each module for overlapping time periods. Calculates Pearson correlation coefficient. Returns significant correlations (|r| > 0.6).
    ```typescript
    interface Correlation {
      moduleA: string;
      metricA: string;
      moduleB: string;
      metricB: string;
      coefficient: number; // -1 to 1
      pValue: number;
      sampleSize: number;
      timeRange: { start: string; end: string };
      interpretation: string; // human-readable explanation
    }
    ```

  - `getModuleConnections(filters?: ConnectionFilters): Promise<ModuleConnection[]>` -- Retrieves module connections from DB. Can filter by source, target, or type. Returns with activity statistics.
    ```typescript
    interface ConnectionFilters {
      sourceModule?: string;
      targetModule?: string;
      connectionType?: string;
      minStrength?: number;
    }
    interface ModuleConnection {
      id: string;
      sourceModule: string;
      targetModule: string;
      connectionType: string;
      description: string;
      strength: number;
      isBidirectional: boolean;
      activityCount: number;
      lastActivityAt: string | null;
    }
    ```

  - `generateTimeline(userId: string, timeRange: { start: string; end: string }): Promise<TimelineEntry[]>` -- Aggregates events from all modules into a unified chronological timeline. Sources: transactions (payments, receipts), forecasts (generated, accuracy updates), compliance (deadlines, lodgements), anomalies (detected, resolved), tax (calculations, strategy changes), BAS (submissions). Groups by date, sorts chronologically.
    ```typescript
    interface TimelineEntry {
      date: string;
      module: string;
      eventType: string;
      title: string;
      description: string;
      severity: 'info' | 'suggestion' | 'warning' | 'critical';
      amount?: number;
      relatedInsights?: string[]; // insight IDs
      metadata?: Record<string, unknown>;
    }
    ```

  - `getInsights(userId: string, filters?: InsightFilters): Promise<{ items: CrossModuleInsight[]; total: number }>` -- Paginated insight list with filters.
    ```typescript
    interface InsightFilters {
      insightType?: string;
      severity?: string;
      status?: string;
      sourceModules?: string[];
      minConfidence?: number;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
      offset?: number;
    }
    ```

  - `getInsightById(insightId: string): Promise<CrossModuleInsight>` -- Single insight with full evidence detail.

  - `markInsightViewed(insightId: string): Promise<void>` -- Update status to 'viewed'.

  - `actOnInsight(insightId: string, action?: string): Promise<void>` -- Update status to 'acted_on' with optional action description.

  - `dismissInsight(insightId: string): Promise<void>` -- Update status to 'dismissed'.

  - `updateConnectionActivity(sourceModule: string, targetModule: string, connectionType: string): Promise<void>` -- Increment activity_count and update last_activity_at for a module connection. Called automatically when cross-module data flows occur.

- [ ] Implement private insight scanner methods:
  - `_scanAnomalyCascades(userId: string, timeRange: TimeRange): Promise<CrossModuleInsight[]>` -- Detects when anomalies in one module correlate with issues in another. Example: velocity spike in transactions + forecast deviation + missed BAS deadline = potential compliance risk cascade.

  - `_scanTrendAlignments(userId: string, timeRange: TimeRange): Promise<CrossModuleInsight[]>` -- Finds aligned trends across modules. Example: revenue trend up + forecast accuracy improving + tax liability increasing = growth pattern.

  - `_scanComplianceRisks(userId: string, timeRange: TimeRange): Promise<CrossModuleInsight[]>` -- Identifies compliance risks from cross-module signals. Example: overdue BAS + amount anomalies + missing GST categorizations = high compliance risk.

  - `_scanForecastDeviations(userId: string, timeRange: TimeRange): Promise<CrossModuleInsight[]>` -- Finds when forecasts diverge from reality and correlates with other module data. Example: forecast predicted $50k revenue but actual is $30k + category drift detected + new merchants appearing.

  - `_scanTaxOpportunities(userId: string, timeRange: TimeRange): Promise<CrossModuleInsight[]>` -- Discovers tax optimization opportunities from cross-module analysis. Example: high business expenses + approaching EOFY + unused deduction capacity + new asset purchases.

  - `_scanSpendingPatterns(userId: string, timeRange: TimeRange): Promise<CrossModuleInsight[]>` -- Identifies notable spending patterns across accounts/time. Example: recurring payment increases + seasonal spending spikes + merchant category shifts.

- [ ] Implement helper methods:
  - `_calculatePearsonCorrelation(x: number[], y: number[]): { coefficient: number; pValue: number }` -- Statistical correlation
  - `_buildInsight(type: string, title: string, description: string, evidence: Record<string, unknown>, modules: string[], confidence: number, severity: string): CrossModuleInsight` -- Insight factory
  - `_deduplicateInsights(insights: CrossModuleInsight[]): CrossModuleInsight[]` -- Remove near-duplicates by comparing type + modules + time range
  - `_getModuleMetrics(userId: string, module: string, timeRange: TimeRange): Promise<Record<string, number[]>>` -- Fetch time-series metrics from a specific module

- [ ] Wire Drizzle ORM queries against `crossModuleInsights` and `moduleConnections` tables

## Files to MODIFY

None -- standalone service.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `CrossModuleIntelligenceService` can be instantiated without errors
- [ ] `scanForInsights()` runs all 6 scanners and returns de-duplicated results
- [ ] `findCorrelations()` correctly calculates Pearson coefficient for known data
- [ ] `getModuleConnections()` returns predefined connections (10 rows)
- [ ] `generateTimeline()` returns chronologically ordered entries from multiple modules
- [ ] `_calculatePearsonCorrelation([1,2,3,4,5], [2,4,6,8,10])` returns coefficient ~1.0
- [ ] `_calculatePearsonCorrelation([1,2,3,4,5], [5,4,3,2,1])` returns coefficient ~-1.0
- [ ] Insight status transitions work: new -> viewed -> acted_on/dismissed
- [ ] Create marker file: `.agent-done-W17-03`

## Dependencies
- **Requires**: W17-01 (`.agent-done-W17-01`) -- crossModuleInsights, moduleConnections tables
- **Reuses**: schema.ts, existing service modules (forecast, anomaly, compliance, tax, bas)
