# Agent W15-10: Testing & Validation Agent

## Role
Verify forecast accuracy, anomaly detection correctness, compliance date calculations, and full-stack integration for Wave 15.

## Priority: WAVE 15 (After ALL Wave 15 agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W15-01` through `.agent-done-W15-09` before starting.

## Verification Tasks

### Compilation
- [ ] Run `cd server && npx tsc --noEmit` -- zero errors
- [ ] Run `cd client && npx tsc --noEmit` -- zero errors
- [ ] Run `docker compose config` -- validates

### Schema Verification
- [ ] Run migration 0027 against PostgreSQL: `docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0027_predictive_analytics.sql`
- [ ] Verify 6 tables exist: `\dt cash_flow_forecasts`, `\dt cash_flow_forecast_periods`, `\dt anomaly_alerts`, `\dt compliance_checks`, `\dt compliance_schedules`, `\dt audit_trails`
- [ ] Verify all indexes created (at least 10 indexes across 6 tables)
- [ ] Verify foreign key constraints: insert anomaly_alert with invalid user_id should fail

### Forecast Engine Verification
- [ ] Test linear regression with known data:
  ```
  Input: 12 months of net cash flow [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100]
  Expected: slope ~100, next 3 months predict ~2200, 2300, 2400
  ```
- [ ] Test seasonal decomposition:
  ```
  Input: 24 months with Q4 spike pattern
  Expected: seasonal indices show December peak, January trough
  ```
- [ ] Test ML weighted forecast: verify it blends linear (0.3) + seasonal (0.5) + recent (0.2)
- [ ] Test confidence bands: verify upper/lower bounds widen for further-out predictions
- [ ] Test accuracy calculation: `curl -X POST localhost:3501/api/forecasts/{id}/accuracy` -- verify MAE, RMSE, MAPE returned
- [ ] Test forecast comparison: submit 2+ forecast IDs, verify side-by-side output with recommendation

### Anomaly Detection Verification
- [ ] Test duplicate detection:
  ```
  Create 2 transactions: same merchant "Officeworks", same amount $150.00, 1 day apart
  Expected: anomaly alert with type='duplicate_payment', severity='high'
  ```
- [ ] Test amount anomaly:
  ```
  Create 20 transactions in "Groceries" category averaging $80
  Create 1 transaction in "Groceries" for $5,000
  Expected: anomaly alert with type='amount_anomaly', severity='critical' (>5 std dev)
  ```
- [ ] Test velocity spike:
  ```
  Create 15 transactions in 1 hour for a user averaging 2/day
  Expected: anomaly alert with type='velocity_spike', severity='high'
  ```
- [ ] Test category drift:
  ```
  Historical: "Entertainment" = 5% of spending
  Recent: "Entertainment" = 25% of spending
  Expected: anomaly alert with type='category_drift', severity='high' (>30% drift)
  ```
- [ ] Test alert lifecycle: create alert -> acknowledge -> resolve -> verify status transitions
- [ ] Test alert stats: `curl localhost:3501/api/anomalies/stats/{userId}` -- verify counts by type/severity/status

### Compliance Verification
- [ ] Test schedule generation for sole trader 2024-25:
  ```
  Expected dates:
  - BAS Q1: 28 Oct 2024
  - BAS Q2: 28 Feb 2025
  - BAS Q3: 28 Apr 2025
  - BAS Q4: 28 Jul 2025 (actually lodged by 28 Aug for annual lodgers)
  - Tax return: 31 Oct 2025 (or tax agent deadline)
  - STP finalisation: 14 Jul 2025
  ```
- [ ] Test overdue detection: create obligation with due_date in the past, verify status='overdue'
- [ ] Test risk assessment: `curl localhost:3501/api/compliance/{userId}/risk` -- verify score 0-100 with contributing factors
- [ ] Test mark lodged: `curl -X PATCH localhost:3501/api/compliance/{checkId}/lodge` with reference number
- [ ] Test upcoming deadlines: verify sorted by due date, within requested day window

### Agent Verification
- [ ] Verify `forecasting_agent` registered in orchestrator and callable
- [ ] Verify `compliance_monitoring_agent` registered in orchestrator and callable
- [ ] Test forecasting agent `generate_forecast` tool returns valid forecast
- [ ] Test compliance agent `check_obligations` tool returns obligation status
- [ ] Verify agent model assignments: forecasting=Sonnet, compliance=Sonnet

### Cognee Datasets Verification
- [ ] Verify 3 new datasets in COGNEE_DATASETS: `forecast_patterns`, `anomaly_history`, `compliance_rulings`
- [ ] Test `indexForecastPatterns()` successfully indexes to Cognee
- [ ] Test `searchComplianceRulings()` returns results with RAG_COMPLETION type
- [ ] Test `searchAnomalyPrecedents()` returns results with CHUNKS type

### Frontend Verification
- [ ] Navigate to /forecasting -- verify ForecastDashboard loads
- [ ] Verify forecast chart renders with area chart and confidence bands
- [ ] Navigate to /compliance -- verify ComplianceDashboard loads with 5 tabs
- [ ] Verify obligation tracker displays with correct status colors
- [ ] Verify anomaly alert panel shows alerts in severity order
- [ ] Verify risk gauge renders with animated circle
- [ ] Verify compliance calendar shows month grid

### Generate Verification Report
```
GOLDLEDGER WAVE 15 VERIFICATION REPORT
=======================================
Date: [timestamp]
Schema:          [PASS/FAIL] - [details]
Forecast Engine: [PASS/FAIL] - [details]
Anomaly Detect:  [PASS/FAIL] - [details]
Compliance:      [PASS/FAIL] - [details]
Agents:          [PASS/FAIL] - [details]
Cognee Datasets: [PASS/FAIL] - [details]
Frontend:        [PASS/FAIL] - [details]
Build:           [PASS/FAIL] - [details]
API Routes:      [PASS/FAIL] - [details]
Integration:     [PASS/FAIL] - [details]
```

- [ ] Create marker file: `.agent-done-W15-10`

## Dependencies
- **Requires**: ALL Wave 15 agents (`.agent-done-W15-01` through `.agent-done-W15-09`)
- **Docker must be running**: `docker compose up -d`
