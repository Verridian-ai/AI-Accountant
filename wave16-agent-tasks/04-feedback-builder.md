# Agent W16-04: Cognee Feedback Service Builder

## Role
Build the Cognee feedback loop service. Wire POST /v1/feedback endpoint. Implement feedback submission, statistics aggregation, and memify trigger for learning.

## Priority: WAVE 16 (After W16-01 completes schema)

## Wait Condition
Check for `.agent-done-W16-01` marker file before starting.

## Context
- Cognee feedback API: POST /v1/feedback -- submits user corrections to Cognee for learning
- Cognee memify API: POST /v1/memify -- triggers knowledge consolidation from feedback
- Schema: `cogneeFeedback` table (from W16-01)
- DataPoint configs: `datapointConfigs` table (accuracy_score updated by feedback)

## Files to CREATE

### 1. `server/src/services/cognee-feedback.ts`
**Purpose**: Manage Cognee feedback loop for continuous learning improvement
**Pattern**: Follow `server/src/services/cognee_client.ts` for HTTP call patterns

- [ ] Create `CogneeFeedbackService` class with the following methods:

  - `submitFeedback(userId: string, feedback: FeedbackSubmission): Promise<CogneeFeedbackRecord>` -- Persists feedback to DB. Sends to Cognee API: `POST /v1/feedback` with body `{ entity_id, feedback_type, original_value, corrected_value, context }`. If `corrected_value` provided, marks as actionable correction. Returns persisted record.
    ```typescript
    interface FeedbackSubmission {
      entityType: 'datapoint' | 'search_result' | 'graph_node' | 'extraction';
      entityId: string;
      feedbackType: 'correct' | 'incorrect' | 'partial' | 'irrelevant' | 'missing';
      originalValue?: string;
      correctedValue?: string;
      context?: {
        query?: string;
        dataset?: string;
        searchType?: string;
      };
      datapointConfigId?: string;
    }
    ```

  - `getFeedbackStats(userId: string, filters?: FeedbackFilters): Promise<FeedbackStats>` -- Aggregates feedback data. Returns counts by type, accuracy rates per entity type, trend over time (improving/declining/stable), top corrected fields.
    ```typescript
    interface FeedbackFilters {
      entityType?: string;
      feedbackType?: string;
      datapointConfigId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
    interface FeedbackStats {
      total: number;
      byType: Record<string, number>;
      byEntityType: Record<string, number>;
      accuracyRate: number; // % correct out of total
      trend: 'improving' | 'declining' | 'stable';
      topCorrectedFields: Array<{ field: string; correctionCount: number }>;
      recentFeedback: CogneeFeedbackRecord[];
    }
    ```

  - `triggerMemify(userId: string, options?: MemifyOptions): Promise<MemifyResult>` -- Gathers unapplied feedback (where `applied_to_memify = false`). Groups corrections by dataset. Sends to Cognee: `POST /v1/memify` with `{ datasets, feedback_data, run_in_background: true }`. Marks processed feedback as `applied_to_memify = true`. Updates `accuracy_score` on related DataPoint configs.
    ```typescript
    interface MemifyOptions {
      datasetNames?: string[]; // limit to specific datasets
      minFeedbackCount?: number; // minimum corrections before triggering (default: 5)
      forceRun?: boolean; // bypass minimum count
    }
    interface MemifyResult {
      processed: number;
      datasets: string[];
      newAccuracyScores: Record<string, number>;
      status: 'triggered' | 'skipped' | 'insufficient_feedback';
    }
    ```

  - `listFeedback(userId: string, filters?: FeedbackFilters & { limit?: number; offset?: number }): Promise<{ items: CogneeFeedbackRecord[]; total: number }>` -- Paginated feedback list with filters.

  - `getFeedbackById(feedbackId: string): Promise<CogneeFeedbackRecord>` -- Single feedback record by ID.

  - `deleteFeedback(feedbackId: string): Promise<void>` -- Remove feedback record. Only allowed if not yet applied to memify.

  - `getDataPointAccuracy(datapointConfigId: string): Promise<DataPointAccuracy>` -- Calculates accuracy metrics for a specific DataPoint config based on feedback history.
    ```typescript
    interface DataPointAccuracy {
      datapointConfigId: string;
      totalFeedback: number;
      correctCount: number;
      incorrectCount: number;
      partialCount: number;
      accuracyScore: number; // 0-1
      trend: 'improving' | 'declining' | 'stable';
      lastUpdated: string;
    }
    ```

  - `autoTriggerMemify(userId: string): Promise<MemifyResult | null>` -- Checks if enough unapplied feedback exists (default threshold: 10 corrections). If so, triggers memify automatically. Called by pipeline after batch processing. Returns null if threshold not met.

- [ ] Wire Drizzle ORM queries against `cogneeFeedback` and `datapointConfigs` tables
- [ ] Wire HTTP calls to Cognee feedback and memify endpoints via `CogneeClient`

## Files to MODIFY

### 2. `server/src/services/cognee_client.ts`
- [ ] Add `submitFeedback(data: FeedbackPayload): Promise<void>` method:
  ```typescript
  async submitFeedback(data: {
    entity_id: string;
    feedback_type: string;
    original_value?: string;
    corrected_value?: string;
    context?: Record<string, string>;
  }): Promise<void> {
    await this.post('/v1/feedback', data);
  }
  ```

- [ ] Add `triggerMemify(data: MemifyPayload): Promise<void>` method:
  ```typescript
  async triggerMemify(data: {
    datasets: string[];
    feedback_data?: Record<string, unknown>[];
    run_in_background?: boolean;
  }): Promise<void> {
    await this.post('/v1/memify', { ...data, run_in_background: true });
  }
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `CogneeFeedbackService` can be instantiated without errors
- [ ] `submitFeedback()` persists to DB and calls Cognee API
- [ ] `getFeedbackStats()` returns correct aggregated counts
- [ ] `triggerMemify()` processes unapplied feedback and marks as applied
- [ ] `triggerMemify()` skips if fewer than minFeedbackCount corrections
- [ ] `getDataPointAccuracy()` calculates correct accuracy score
- [ ] `autoTriggerMemify()` returns null when under threshold
- [ ] `deleteFeedback()` rejects already-applied feedback
- [ ] Create marker file: `.agent-done-W16-04`

## Dependencies
- **Requires**: W16-01 (`.agent-done-W16-01`) -- cogneeFeedback table must exist
- **Reuses**: schema.ts (cogneeFeedback, datapointConfigs), cognee_client.ts
- **Note**: W16-04 and W16-06 both modify cognee_client.ts -- coordinate to avoid conflicts
