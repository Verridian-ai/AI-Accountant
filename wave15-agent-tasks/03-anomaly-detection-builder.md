# Agent W15-03: Anomaly Detection Builder

## Role
Build the anomaly detection service with duplicate payment detection, statistical outliers, velocity spikes, and category drift analysis.

## Priority: WAVE 15 (After W15-01 completes schema)

## Wait Condition
Check for `.agent-done-W15-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/anomaly-detection.ts`
**Purpose**: Multi-strategy anomaly detection engine for financial transactions
**Pattern**: Follow existing service pattern from `server/src/services/bas.ts`

- [ ] Create `AnomalyDetectionService` class with the following methods:

  - `scanTransactions(userId: string, options: AnomalyScanOptions): Promise<AnomalyAlert[]>` -- Main entry point. Runs all enabled detectors against transaction set. Options: `{ accountId?, dateFrom?, dateTo?, detectors: ('duplicates' | 'amounts' | 'velocity' | 'category_drift' | 'merchant' | 'schedule')[], severityThreshold?: 'low' | 'medium' | 'high' }`. Returns de-duplicated, severity-ranked alerts.

  - `detectDuplicatePayments(transactions: Transaction[]): Promise<AnomalyAlert[]>` -- Finds potential duplicate payments: same amount + same merchant/description within 3 days. Configurable tolerance window. Severity: 'high' if exact match within 24h, 'medium' if fuzzy match (amount within 1%) within 3 days.

  - `detectAmountAnomalies(transactions: Transaction[], category?: string): Promise<AnomalyAlert[]>` -- Statistical outlier detection. Calculates mean and standard deviation per category. Flags transactions >3 std deviations from category mean. Also flags transactions >2x the user's historical max for that merchant. Severity: 'critical' if >5 std dev, 'high' if >3 std dev.

  - `detectVelocitySpikes(transactions: Transaction[], windowDays: number): Promise<AnomalyAlert[]>` -- Detects unusual transaction frequency. Calculates rolling average transaction count per window. Flags periods where count exceeds 2x rolling average. Also detects rapid successive transactions (<5 min apart) at same merchant. Severity: 'high' for >3x average velocity, 'medium' for >2x.

  - `detectCategoryDrift(userId: string, months: number): Promise<AnomalyAlert[]>` -- Monitors category spending proportions over time. Compares recent period category split vs historical average. Flags categories where proportion shifted >15% from norm. Severity: 'medium' for 15-30% drift, 'high' for >30%.

  - `detectUnusualMerchant(transactions: Transaction[]): Promise<AnomalyAlert[]>` -- Flags first-time merchants with high transaction amounts (>$500). Flags merchants not seen in 6+ months with changed pricing patterns. Severity: 'low' for new merchants, 'medium' for changed patterns.

  - `detectScheduleDeviation(userId: string): Promise<AnomalyAlert[]>` -- Identifies recurring payments that are late, missed, or changed in amount. Uses historical payment patterns (same merchant, similar amount, regular interval). Flags missed expected payments and amount changes >10%. Severity: 'high' for missed, 'medium' for amount change.

  - `getAlerts(userId: string, filters?: AlertFilters): Promise<AnomalyAlert[]>` -- Query persisted alerts with filters for status, severity, type, date range.

  - `acknowledgeAlert(alertId: string): Promise<void>` -- Set status to 'acknowledged'.

  - `resolveAlert(alertId: string, resolvedBy: string): Promise<void>` -- Set status to 'resolved' with resolver info.

  - `dismissAlert(alertId: string, reason: string): Promise<void>` -- Set status to 'dismissed'. Feeds back into detection tuning.

  - `getAlertStats(userId: string): Promise<AlertStats>` -- Aggregate counts by type, severity, status. Includes trend (more/fewer alerts than last period).

- [ ] Implement private helper methods:
  - `_calculateStats(values: number[]): { mean: number; stdDev: number; median: number; q1: number; q3: number }` -- Descriptive statistics
  - `_findRecurringPatterns(transactions: Transaction[]): RecurringPattern[]` -- Identify regular payment patterns by merchant/amount/interval
  - `_fuzzyAmountMatch(a: number, b: number, tolerance: number): boolean` -- Amount comparison within tolerance %
  - `_merchantSimilarity(a: string, b: string): number` -- Levenshtein-based merchant name matching (0-1)

- [ ] Define TypeScript interfaces:
  ```typescript
  interface AnomalyScanOptions {
    accountId?: string;
    dateFrom?: string;
    dateTo?: string;
    detectors: AnomalyDetectorType[];
    severityThreshold?: 'low' | 'medium' | 'high';
  }
  type AnomalyDetectorType = 'duplicates' | 'amounts' | 'velocity' | 'category_drift' | 'merchant' | 'schedule';
  interface AnomalyAlert {
    id: string;
    alertType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    details: Record<string, unknown>;
    transactionId?: string;
    accountId?: string;
  }
  interface AlertFilters {
    status?: string;
    severity?: string;
    alertType?: string;
    dateFrom?: string;
    dateTo?: string;
  }
  interface AlertStats {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    trend: 'increasing' | 'stable' | 'decreasing';
  }
  interface RecurringPattern {
    merchant: string;
    averageAmount: number;
    intervalDays: number;
    lastOccurrence: string;
    nextExpected: string;
  }
  ```

- [ ] Wire Drizzle ORM queries against `anomalyAlerts` table (from schema.ts)
- [ ] Wire transaction queries for historical data analysis

## Files to MODIFY

None -- this service is standalone. Types added by W15-02 agent.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `AnomalyDetectionService` can be instantiated without errors
- [ ] `detectDuplicatePayments()` correctly identifies two transactions with same amount/merchant within 3 days
- [ ] `detectAmountAnomalies()` flags a $10,000 transaction in a category averaging $50
- [ ] `detectVelocitySpikes()` flags 20 transactions in 1 hour when average is 2/day
- [ ] `_calculateStats()` returns correct mean/stdDev for known data
- [ ] Create marker file: `.agent-done-W15-03`

## Dependencies
- **Requires**: W15-01 (`.agent-done-W15-01`) -- anomalyAlerts table must exist in schema
- **Reuses**: schema.ts (anomalyAlerts, transactions), existing Transaction type
