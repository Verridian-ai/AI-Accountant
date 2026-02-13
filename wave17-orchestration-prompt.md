# Wave 17 — Temporal Queries & Cross-Module Intelligence — Orchestration Prompt

You are the **Team Lead** for Wave 17: Temporal Queries & Cross-Module Intelligence. You coordinate 10 specialized agents to add temporal cognify (time-aware knowledge processing), cross-module reasoning, and a unified intelligence dashboard to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Cognee research**: `wave0-research/R02-cognee-capabilities.md`
- **Existing Cognee client**: `server/src/services/cognee_client.ts`

## Current State (After Wave 16)
- 23 Claude agents
- Cognee custom DataPoints, ontologies, and feedback system active
- Graph visualization available
- ~22 Cognee datasets
- 18 migrations (0009–0028) applied

## Dependencies
- **Requires**: Wave 16 (custom DataPoints and ontology layer)
- **Estimated Complexity**: MEDIUM

## Database Schema Changes

### New Tables (4 tables)
| Table | Columns |
|-------|---------|
| `temporal_queries` | id, userId, query, timeRange (JSON: start, end, granularity), modules (JSON: array of module names), results (JSON), executedAt |
| `cross_module_insights` | id, userId, entityId, insightType (correlation/anomaly/trend/recommendation), sourceModules (JSON), description, data (JSON), confidence, severity, createdAt |
| `intelligence_subscriptions` | id, userId, insightType, frequency (realtime/daily/weekly), channels (JSON: email/in_app/push), isActive |
| `module_connections` | id, sourceModule, targetModule, connectionType (data_flow/dependency/correlation), weight, description |

**Migration**: `docker/migrations/0029_temporal_cross_module.sql`

## API Endpoints (14 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/intelligence/temporal-query | Execute temporal query across modules |
| GET | /api/intelligence/insights | List cross-module insights |
| GET | /api/intelligence/insights/:id | Get insight detail |
| POST | /api/intelligence/insights/:id/acknowledge | Acknowledge insight |
| POST | /api/intelligence/scan | Trigger cross-module analysis |
| GET | /api/intelligence/correlations | Find correlations between modules |
| GET | /api/intelligence/module-map | Get module connection map |
| GET | /api/intelligence/timeline | Unified timeline across all modules |
| GET | /api/intelligence/subscriptions | List insight subscriptions |
| POST | /api/intelligence/subscriptions | Create subscription |
| PATCH | /api/intelligence/subscriptions/:id | Update subscription |
| POST | /api/cognee/temporal-cognify | Trigger temporal cognify on dataset |
| GET | /api/cognee/temporal-query | Time-scoped Cognee search |
| GET | /api/intelligence/dashboard | Unified intelligence dashboard data |

## UI Components
### `client/src/features/intelligence/` — New feature folder
- IntelligenceDashboard.tsx — Unified cross-module insight hub
- TemporalQueryBuilder.tsx — Time-range selector with module checkboxes
- InsightFeed.tsx — Real-time insight stream with filters
- InsightDetail.tsx — Deep-dive into specific insight with evidence
- ModuleConnectionMap.tsx — Visual map of module interconnections
- UnifiedTimeline.tsx — Horizontal timeline with events from all modules
- SubscriptionManager.tsx — Alert/notification preference editor

**Navigation**: Add `intelligence` to TabId type

## New Claude Agents (0)
No new agents — this wave enhances existing agents with temporal and cross-module tool access. The orchestrator routes temporal queries to the appropriate existing agents.

## Cognee Integration (CORE FOCUS)

### Temporal Cognify
- Enable `temporal_cognify` on all financial datasets
- Add time-aware entity extraction: "Q1 2026 revenue", "March payroll"
- Support `before:`, `after:`, `between:` query modifiers

### Cross-Module Queries
- Route queries across Cognee datasets: e.g., "How did our March marketing spend affect April revenue?"
- Combine results from `financial_reports`, `budget_templates`, `invoice_patterns`, `expense_patterns`
- Use `GRAPH_COMPLETION_COT` (Chain of Thought) for complex multi-hop reasoning

### Sessions/Caching (Previously Unused)
- Activate Cognee session management for query context persistence
- Enable Redis-backed caching for repeated queries (Redis was ghost service until now)

## Testing Criteria
- [ ] Temporal query returns time-scoped results: "Show me all transactions in Q3 2025"
- [ ] Cross-module insight: "Marketing spend increased → revenue increased" correlation
- [ ] Anomaly detection: "Payroll cost jumped 40% — new employees or error?"
- [ ] Module connection map shows correct data flows
- [ ] Unified timeline combines events from 5+ modules
- [ ] Subscription triggers in-app notification on new insight
- [ ] Redis caching reduces repeated query latency by >50%
- [ ] Temporal cognify enriches existing datasets without re-indexing
- [ ] `cd server && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: temporal-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave17-agent-tasks/01-temporal-schema-builder.md`

### Agent 2: temporal-cognify-builder [PRIORITY: WAVE 1]
**Task file**: `wave17-agent-tasks/02-temporal-cognify-builder.md`
**Creates**: server/src/services/temporal-cognify.ts

### Agent 3: cross-module-engine-builder [PRIORITY: WAVE 1]
**Task file**: `wave17-agent-tasks/03-cross-module-engine-builder.md`
**Creates**: server/src/services/cross-module-intelligence.ts

### Agent 4: redis-session-builder [DEPENDS ON: Agent 2]
**Task file**: `wave17-agent-tasks/04-redis-session-builder.md`
**Creates**: server/src/services/cognee-sessions.ts

### Agent 5: subscription-service-builder [DEPENDS ON: Agent 3]
**Task file**: `wave17-agent-tasks/05-subscription-service-builder.md`
**Creates**: server/src/services/intelligence-subscriptions.ts

### Agent 6: cognee-temporal-extension [DEPENDS ON: Agents 2, 4]
**Task file**: `wave17-agent-tasks/06-cognee-temporal-extension.md`
**Modifies**: cognee_client.ts, cognee-tools.ts

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 3, 5, 6]
**Task file**: `wave17-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-intelligence-builder [DEPENDS ON: Agent 7]
**Task file**: `wave17-agent-tasks/08-ui-intelligence-builder.md`
**Creates**: 7 new .tsx components

### Agent 9: agent-temporal-upgrader [DEPENDS ON: Agent 6]
**Task file**: `wave17-agent-tasks/09-agent-temporal-upgrader.md`
**Modifies**: Existing agents to support temporal queries

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave17-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5
Sub-wave 3 (After 2):  Agent 6
Sub-wave 4 (After 3):  Agent 7 + Agent 9
Sub-wave 5 (After 4):  Agent 8
Sub-wave 6 (After 5):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave17-agent-tasks/`.
