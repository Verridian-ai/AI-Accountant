# Wave 15 — Predictive Analytics & Compliance Monitoring — Orchestration Prompt

You are the **Team Lead** for Wave 15: Predictive Analytics & Compliance Monitoring. You coordinate 10 specialized agents to add cash flow forecasting, anomaly detection, and ATO compliance monitoring to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts`

## Current State (After Wave 14)
- 21 Claude agents
- OCR and payment matching operational
- Financial reports and budgets available as data sources
- 16 migrations (0009–0026) applied

## Dependencies
- **Requires**: Wave 13 (financial reports for trend data), Wave 14 (matching for completeness)
- **Estimated Complexity**: HIGH

## Database Schema Changes

### New Tables (6 tables)
| Table | Columns |
|-------|---------|
| `cash_flow_forecasts` | id, userId, entityId, name, horizonMonths, methodology (linear/seasonal/ml_weighted), startDate, endDate, confidence, generatedAt |
| `cash_flow_forecast_periods` | id, forecastId, periodStart, periodEnd, projectedInflows, projectedOutflows, projectedBalance, actualInflows, actualOutflows, actualBalance |
| `anomaly_alerts` | id, userId, entityId, alertType (unusual_amount/duplicate_payment/missing_expected/category_drift/velocity_spike), severity (info/warning/critical), transactionId, description, status (new/acknowledged/dismissed/resolved), detectedAt |
| `compliance_checks` | id, userId, entityId, checkType (bas_due/stp_filing/super_guarantee/payg_instalment/tfn_withholding/gst_threshold), dueDate, status (upcoming/due/overdue/completed/not_applicable), completedAt, notes |
| `compliance_schedules` | id, userId, entityId, obligation, frequency (monthly/quarterly/annually), nextDueDate, reminderDaysBefore, isActive |
| `audit_trails` | id, userId, entityId, module, action, entityType, entityId_ref, beforeState (JSON), afterState (JSON), ipAddress, userAgent, timestamp |

**Migration**: `docker/migrations/0027_predictive_compliance.sql`

## API Endpoints (20 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/forecasts/cash-flow | Generate cash flow forecast |
| POST | /api/forecasts/cash-flow | Create saved forecast |
| GET | /api/forecasts/cash-flow/:id | Get forecast detail |
| POST | /api/forecasts/cash-flow/:id/recalculate | Update with latest data |
| GET | /api/forecasts/cash-flow/:id/accuracy | Forecast vs actual accuracy |
| GET | /api/anomalies | List anomaly alerts |
| POST | /api/anomalies/:id/acknowledge | Acknowledge alert |
| POST | /api/anomalies/:id/dismiss | Dismiss alert |
| POST | /api/anomalies/:id/resolve | Resolve alert |
| POST | /api/anomalies/scan | Trigger anomaly scan |
| GET | /api/compliance/checks | List compliance obligations |
| POST | /api/compliance/checks | Create compliance check |
| PATCH | /api/compliance/checks/:id | Update check status |
| GET | /api/compliance/calendar | Compliance calendar view |
| GET | /api/compliance/schedules | List compliance schedules |
| POST | /api/compliance/schedules | Create schedule |
| PATCH | /api/compliance/schedules/:id | Update schedule |
| GET | /api/compliance/upcoming | Next 30 days obligations |
| GET | /api/audit-trail | Audit trail log |
| GET | /api/audit-trail/:entityType/:entityId | Audit trail for specific entity |

## UI Components
### `client/src/features/forecasting/` — New feature folder
- ForecastDashboard.tsx — Cash flow forecast chart with confidence bands
- ForecastComparison.tsx — Forecast vs actual overlay chart
- ForecastSettings.tsx — Methodology and horizon configuration
- WhatIfScenarios.tsx — Scenario slider for variable adjustment

### `client/src/features/compliance/` — New feature folder
- ComplianceDashboard.tsx — Obligation status overview
- ComplianceCalendar.tsx — Calendar view of upcoming obligations
- AnomalyAlerts.tsx — Alert list with severity badges and actions
- AnomalyDetail.tsx — Detailed analysis of flagged transaction
- AuditTrail.tsx — Searchable audit log with filters
- ComplianceScheduleEditor.tsx — Schedule configuration

**Navigation**: Add `compliance` to TabId type

## New Claude Agents (2)
1. **`forecasting_agent`** — Generates cash flow forecasts using seasonal decomposition, explains trends, suggests optimizations. Tools: `generate_forecast`, `analyze_seasonality`, `compare_scenarios`, `explain_trend`.
2. **`compliance_monitoring_agent`** — Monitors ATO obligations, detects anomalies, generates compliance reminders. Tools: `check_obligations`, `detect_anomalies`, `generate_compliance_report`, `assess_risk`.

## Cognee Integration
- **New datasets**: `forecast_patterns`, `anomaly_history`, `compliance_rulings`
- Index forecast patterns for "When is my next cash crunch?"
- Index anomalies for "Show me suspicious transactions this quarter"
- Index compliance for "Am I up to date with ATO obligations?"
- Use `GRAPH_COMPLETION` for anomaly reasoning
- Use `RAG_COMPLETION` for ATO ruling queries

## Testing Criteria
- [ ] 12-month cash flow forecast generates from transaction history
- [ ] Seasonal methodology detects quarterly patterns
- [ ] Forecast accuracy metric calculated after actual data arrives
- [ ] Anomaly detection flags transactions >3 standard deviations
- [ ] Duplicate payment detection within 7-day window
- [ ] Compliance calendar shows correct due dates for BAS, STP, super
- [ ] Overdue obligations highlighted in red
- [ ] Audit trail logs all CRUD operations with before/after state
- [ ] Chat answers "When is my next BAS due?"
- [ ] Chat answers "Are there any unusual transactions this month?"
- [ ] `cd server && npx tsc --noEmit` passes clean

## Debate Findings Applied (D01–D05)

| Finding | Source | Resolution |
|---------|--------|------------|
| `audit_trails` table may conflict with existing `audit_log` | D04 S03 | RESOLVED: Wave 15's `audit_trails` REPLACES the existing `audit_log` table. `audit_log` is formally deprecated. Migrate existing audit_log data to audit_trails format |
| Audit trail must be append-only (no UPDATE/DELETE) | D02 FIN-05 | MANDATORY: `audit_trails` table must have a trigger or application constraint preventing UPDATE/DELETE. Redact sensitive fields (TFN, passwords, tokens) from beforeState/afterState JSON |
| Forecast pre-computation, not on every request | D03 §Wave15 | Cash flow forecasts should be computed nightly or on-demand (POST /api/forecasts/cash-flow triggers computation), then served cached via GET |
| Anomaly detection should be incremental | D03 §Wave15 | POST /api/anomalies/scan should only scan transactions since last scan, not full table scan. Store last_scan_date per user |
| Audit trail partitioning needed | D03 §2.3 | This table grows fastest (~36K rows/year/user). MUST use PostgreSQL range partitioning by month from day one |
| Dual schema rule reminder | D04 S02 | ENFORCED: Every table in BOTH schema.ts AND postgres-schema.ts |

## Team Structure — 10 Agents

### Agent 1: predictive-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave15-agent-tasks/01-predictive-schema-builder.md`

### Agent 2: forecast-engine-builder [PRIORITY: WAVE 1]
**Task file**: `wave15-agent-tasks/02-forecast-engine-builder.md`
**Creates**: server/src/services/cash-flow-forecast.ts

### Agent 3: anomaly-detection-builder [PRIORITY: WAVE 1]
**Task file**: `wave15-agent-tasks/03-anomaly-detection-builder.md`
**Creates**: server/src/services/anomaly-detection.ts

### Agent 4: forecasting-agent-builder [DEPENDS ON: Agent 2]
**Task file**: `wave15-agent-tasks/04-forecasting-agent-builder.md`
**Creates**: server/src/services/claude/agents/forecasting-agent.ts

### Agent 5: compliance-agent-builder [DEPENDS ON: Agent 3]
**Task file**: `wave15-agent-tasks/05-compliance-agent-builder.md`
**Creates**: server/src/services/claude/agents/compliance-monitoring-agent.ts

### Agent 6: cognee-datasets-builder [DEPENDS ON: Agent 1]
**Task file**: `wave15-agent-tasks/06-cognee-datasets-builder.md`

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Task file**: `wave15-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-forecasting-builder [DEPENDS ON: Agent 7]
**Task file**: `wave15-agent-tasks/08-ui-forecasting-builder.md`

### Agent 9: ui-compliance-builder [DEPENDS ON: Agent 7]
**Task file**: `wave15-agent-tasks/09-ui-compliance-builder.md`

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave15-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave15-agent-tasks/`.
