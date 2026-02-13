# Agent W17-10: Testing & Validation Agent

## Role
Verify temporal queries, cross-module correlations, Redis caching, subscription notifications, and full-stack integration for Wave 17.

## Priority: WAVE 17 (After ALL Wave 17 agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W17-01` through `.agent-done-W17-09` before starting.

## Verification Tasks

### Compilation
- [ ] Run `cd server && npx tsc --noEmit` -- zero errors
- [ ] Run `cd client && npx tsc --noEmit` -- zero errors
- [ ] Run `docker compose config` -- validates (includes Redis service)

### Schema Verification
- [ ] Run migration 0029 against PostgreSQL: `docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0029_temporal_intelligence.sql`
- [ ] Verify 4 tables exist: `\dt temporal_queries`, `\dt cross_module_insights`, `\dt intelligence_subscriptions`, `\dt module_connections`
- [ ] Verify indexes created (at least 12 indexes across 4 tables)
- [ ] Verify predefined module connections seeded: `SELECT count(*) FROM module_connections` returns 10
- [ ] Verify unique constraint on module_connections: inserting duplicate (source, target, type) should fail

### Redis Verification
- [ ] Docker Redis service starts: `docker compose up redis -d`
- [ ] Redis health check passes: `docker compose exec redis redis-cli ping` returns PONG
- [ ] CogneeSessionService connects successfully
- [ ] Session CRUD works:
  ```
  Create session -> getSession returns it -> updateSession modifies data -> destroySession removes it
  ```
- [ ] Session TTL works: create with 2s TTL, wait 3s, getSession returns null
- [ ] Cache CRUD works:
  ```
  cacheQueryResult('test-key', {data: 'test'}, 60) -> getCachedResult('test-key') returns {data: 'test'}
  ```
- [ ] Cache invalidation: `invalidateCache('cache:query:*')` clears all query caches
- [ ] Rate limiting:
  ```
  Set limit to 3 per 10 seconds
  Call checkRateLimit 3 times -> all return allowed: true
  Call 4th time -> returns allowed: false, retryAfter > 0
  ```
- [ ] Health status: `GET /api/intelligence/cache/health` returns connected=true with metrics

### Temporal Query Verification
- [ ] Test point-in-time query:
  ```
  curl -X POST localhost:3501/api/intelligence/temporal/query -H 'Content-Type: application/json' \
    -d '{"userId":"test","queryType":"point_in_time","targetEntity":"transactions","timeStart":"2025-01-15","parameters":{}}'
  Expected: results with temporal metadata
  ```
- [ ] Test time range query with cache:
  ```
  First call: returns fromCache=false, records executionMs
  Second call (same params): returns fromCache=true, executionMs near 0
  ```
- [ ] Test Australian financial year parsing:
  ```
  Date 2025-06-30 -> financial_year='2024-25'
  Date 2025-07-01 -> financial_year='2025-26'
  ```
- [ ] Test BAS quarter mapping:
  ```
  July -> Q1, October -> Q2, January -> Q3, April -> Q4
  ```
- [ ] Test save and list queries: save a query, list saved queries, verify it appears
- [ ] Test timeline generation:
  ```
  curl localhost:3501/api/intelligence/temporal/timeline/test?start=2025-01-01&end=2025-03-31
  Expected: chronologically ordered events from multiple modules
  ```

### Cross-Module Intelligence Verification
- [ ] Test insight scan:
  ```
  curl -X POST localhost:3501/api/intelligence/insights/scan -H 'Content-Type: application/json' \
    -d '{"userId":"test","minConfidence":0.3}'
  Expected: array of insights with type, severity, source_modules
  ```
- [ ] Test Pearson correlation:
  ```
  Perfectly correlated data [1,2,3,4,5] vs [2,4,6,8,10] -> coefficient ~1.0
  Perfectly anti-correlated [1,2,3,4,5] vs [5,4,3,2,1] -> coefficient ~-1.0
  Uncorrelated data -> coefficient near 0
  ```
- [ ] Test module connections: `GET /api/intelligence/connections` returns 10 predefined connections
- [ ] Test insight status transitions: new -> viewed -> acted_on (verify each transition works)
- [ ] Test insight de-duplication: scan twice with same data, verify no duplicate insights

### Subscription & Notification Verification
- [ ] Test create subscription:
  ```
  curl -X POST localhost:3501/api/intelligence/subscriptions -H 'Content-Type: application/json' \
    -d '{"userId":"test","name":"Critical Alerts","subscriptionType":"insight_type","filterCriteria":{"insightTypes":["anomaly_cascade"],"severityMin":"warning"},"notificationChannel":"in_app"}'
  Expected: 200 with subscription ID
  ```
- [ ] Test subscription trigger: create insight matching filter -> verify notification generated
- [ ] Test cooldown: trigger twice within cooldown period -> second trigger should be skipped
- [ ] Test severity filtering: subscription with severityMin='warning' should not trigger for 'info' insights
- [ ] Test confidence filtering: subscription with confidenceMin=0.7 should not trigger for 0.5 confidence insights
- [ ] Test unsubscribe: sets is_active=false, no longer triggers
- [ ] Test reactivate: sets is_active=true, triggers again
- [ ] Test list subscriptions with filters

### Agent Temporal Tools Verification
- [ ] Verify forecasting-agent has `temporal_forecast_search` and `cross_module_forecast_context` tools
- [ ] Verify compliance-monitoring-agent has `temporal_compliance_search` and `compliance_timeline` tools
- [ ] Verify tax-strategy agent has `temporal_tax_search` and `cross_module_tax_impact` tools
- [ ] Verify gst-calculator has `temporal_gst_search` tool
- [ ] Verify transaction-categorizer has `temporal_categorization_search` tool
- [ ] Verify merchant-intelligence has `merchant_timeline` tool
- [ ] Verify financial-planner has `temporal_financial_search` and `cross_module_planning_context` tools
- [ ] Verify cross-account-tracer has `temporal_transfer_search` tool
- [ ] Test that temporal tools correctly convert financial years and BAS quarters to date ranges
- [ ] Verify no existing tools broken by modifications

### Cognee Client Verification
- [ ] Verify `temporalSearch()` method exists on CogneeClient
- [ ] Verify `temporalCognify()` method exists on CogneeClient
- [ ] Verify `crossDatasetSearch()` method exists on CogneeClient
- [ ] Verify cognee-tools has `temporalSearch()`, `crossModuleSearch()`, `searchTimeline()`, `indexCrossModuleInsight()`
- [ ] Verify COGNEE_DATASETS includes Wave 17 datasets: temporal_patterns, cross_module_insights, module_relationships
- [ ] Verify existing methods still work unchanged

### Frontend Verification
- [ ] Navigate to /intelligence -- verify IntelligenceDashboard loads with 5 tabs
- [ ] Verify InsightFeed displays insights with severity-colored left borders
- [ ] Verify IntelligenceTimeline shows chronological events with module colors
- [ ] Verify TemporalQueryBuilder form submits and shows results (cached/uncached indicator)
- [ ] Verify ModuleConnectionMap renders network diagram with 10 connections
- [ ] Verify SubscriptionManager lists subscriptions with channel icons
- [ ] Verify CorrelationExplorer shows module pair selector and results

### Integration Tests
- [ ] End-to-end flow: Create subscription -> Scan insights -> Subscription triggers -> Notification sent
- [ ] End-to-end flow: Execute temporal query -> Result cached -> Re-execute -> From cache
- [ ] End-to-end flow: Agent uses temporal tool -> Cognee search with time context -> Returns results
- [ ] Performance: temporal query with cache should respond in <100ms
- [ ] Performance: insight scan should complete within 10 seconds

### Generate Verification Report
```
GOLDLEDGER WAVE 17 VERIFICATION REPORT
=======================================
Date: [timestamp]
Schema:            [PASS/FAIL] - [details]
Redis:             [PASS/FAIL] - [details]
Temporal Queries:  [PASS/FAIL] - [details]
Cross-Module:      [PASS/FAIL] - [details]
Subscriptions:     [PASS/FAIL] - [details]
Agent Tools:       [PASS/FAIL] - [details]
Cognee Extension:  [PASS/FAIL] - [details]
Frontend:          [PASS/FAIL] - [details]
Build:             [PASS/FAIL] - [details]
API Routes:        [PASS/FAIL] - [details]
Integration:       [PASS/FAIL] - [details]
Performance:       [PASS/FAIL] - [details]
```

- [ ] Create marker file: `.agent-done-W17-10`

## Dependencies
- **Requires**: ALL Wave 17 agents (`.agent-done-W17-01` through `.agent-done-W17-09`)
- **Docker must be running**: `docker compose up -d` (includes Redis)
- **Cognee must be running**: verify Cognee API at localhost:8000 responds
- **Redis must be running**: verify `docker compose exec redis redis-cli ping` returns PONG
