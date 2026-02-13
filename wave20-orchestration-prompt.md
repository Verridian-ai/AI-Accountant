# Wave 20 — Admin Backend & System Dashboard — Orchestration Prompt

You are the **Team Lead** for Wave 20: Admin Backend & System Dashboard. You coordinate 10 specialized agents to build a graphical admin interface with full agent management, Cognee knowledge graph 3D visualization, system monitoring, and user management.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **User request**: `docs/Agent planning chat.md` (line 1318 — admin backend spec)
- **Cognee research**: `wave0-research/R02-cognee-capabilities.md`
- **Docker research**: `wave0-research/R09-docker-infrastructure.md`

## Current State (After Wave 19)
- 25 Claude agents
- Market intelligence and CDR operational
- Cognee has 25+ datasets with custom DataPoints, ontologies, and graph viz
- No admin interface exists
- No user management beyond basic auth
- 21 migrations (0009–0031) applied

## Dependencies
- **Requires**: Wave 16 (Cognee graph data), Wave 17 (cross-module intelligence)
- **Estimated Complexity**: HIGH

## User Requirements (from planning chat)
> "We need an app admin backend. I want a graphical interface that I can have full control over agents, I can see the Cognee knowledge graph in a graphically 3D visual — all nodes and edges — a full system Cognee system control and agent dashboard. I can manage users on the app at system app provider level."

## Database Schema Changes

### New Tables (7 tables)
| Table | Columns |
|-------|---------|
| `admin_users` | id, email, passwordHash, role (super_admin/admin/viewer), lastLogin, isActive, createdAt |
| `agent_executions` | id, agentType, userId, status (running/completed/failed/timeout), inputSummary, outputSummary, tokenUsage (JSON: input, output), costEstimate, duration, startedAt, completedAt |
| `agent_configurations` | id, agentType, modelId, maxTokens, temperature, systemPromptOverride, isActive, updatedBy, updatedAt |
| `system_metrics` | id, metricType (cpu/memory/disk/api_latency/token_usage/error_rate), value, unit, recordedAt |
| `system_health_checks` | id, service (postgres/redis/cognee/server/client), status (healthy/degraded/down), responseTime, lastChecked |
| `user_activity_log` | id, userId, action, details, ipAddress, timestamp |
| `feature_flags` | id, flagName, description, isEnabled, enabledForUsers (JSON), updatedBy, updatedAt |

**Migration**: `docker/migrations/0032_admin_dashboard.sql`

## API Endpoints (28 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/admin/auth/login | Admin login |
| POST | /api/admin/auth/logout | Admin logout |
| GET | /api/admin/users | List all app users |
| POST | /api/admin/users | Create user |
| GET | /api/admin/users/:id | Get user detail with activity |
| PATCH | /api/admin/users/:id | Update user |
| POST | /api/admin/users/:id/disable | Disable user |
| GET | /api/admin/agents | List all agent types with status |
| GET | /api/admin/agents/:type | Agent detail with execution history |
| GET | /api/admin/agents/:type/executions | Execution log for agent type |
| GET | /api/admin/agents/:type/config | Get agent configuration |
| PATCH | /api/admin/agents/:type/config | Update agent configuration |
| POST | /api/admin/agents/:type/test | Run test execution |
| GET | /api/admin/cognee/graph | Full graph data for 3D viz |
| GET | /api/admin/cognee/graph/:dataset | Graph for specific dataset |
| GET | /api/admin/cognee/datasets | All datasets with stats |
| POST | /api/admin/cognee/datasets/:name/reindex | Trigger reindex |
| POST | /api/admin/cognee/prune | Prune stale graph nodes |
| GET | /api/admin/system/health | System health dashboard |
| GET | /api/admin/system/metrics | System metrics (CPU, memory, disk) |
| GET | /api/admin/system/metrics/history | Historical metrics |
| GET | /api/admin/system/logs | System logs (recent) |
| GET | /api/admin/feature-flags | List feature flags |
| PATCH | /api/admin/feature-flags/:id | Toggle feature flag |
| GET | /api/admin/activity | Global activity feed |
| GET | /api/admin/stats | Platform-wide statistics |
| GET | /api/admin/docker/services | Docker service status |
| POST | /api/admin/docker/services/:name/restart | Restart Docker service |

## UI Components
### `client/src/features/admin/` — New feature folder
- AdminLayout.tsx — Admin-specific layout with sidebar navigation
- AdminDashboard.tsx — Overview: user count, agent stats, system health
- UserManagement.tsx — User CRUD table with role assignment
- UserDetail.tsx — User profile with activity log
- AgentDashboard.tsx — All agents: status, execution count, success rate
- AgentDetail.tsx — Agent config editor, execution history, test runner
- AgentExecutionLog.tsx — Paginated execution log with token/cost data
- CogneeGraphViewer.tsx — 3D force-directed graph (three.js + 3d-force-graph)
- CogneeDatasetManager.tsx — Dataset list with reindex/prune controls
- CogneeGraphStats.tsx — Node/edge counts, dataset coverage metrics
- SystemHealthPanel.tsx — Service status cards with response times
- SystemMetricsCharts.tsx — CPU, memory, disk, API latency charts
- FeatureFlagManager.tsx — Toggle feature flags
- ActivityFeed.tsx — Real-time activity stream
- DockerServicePanel.tsx — Docker container status and controls

**Navigation**: Admin panel is a SEPARATE route (not a tab) — accessible via `/admin` or admin toggle in header

## New Claude Agents (0)
No new agents — this wave provides management and monitoring for existing agents.

## Cognee Integration
- **3D graph visualization**: Fetch full graph from `GET /v1/datasets/{name}/graph` and render in three.js
- **Dataset management**: List, reindex, prune via admin panel
- **Graph exploration**: Click nodes to see connected edges, filter by type
- **Stats dashboard**: Node count, edge count, dataset coverage, search quality metrics from feedback

## Testing Criteria
- [ ] Admin login with role-based access (super_admin sees all)
- [ ] User CRUD: create, update, disable user
- [ ] Agent dashboard shows all 25 agents with execution counts
- [ ] Agent config editor updates model and token limits
- [ ] Test execution runs agent with sample input
- [ ] 3D graph renders with 1000+ nodes smoothly (60fps)
- [ ] Graph node click shows connected edges and data
- [ ] Dataset reindex triggers Cognee re-processing
- [ ] System health checks all 5 Docker services
- [ ] Activity feed shows real-time user actions
- [ ] Feature flags toggle immediately affect behavior
- [ ] `cd server && npx tsc --noEmit` passes clean

## Debate Findings Applied (D01–D05)

| Finding | Source | Resolution |
|---------|--------|------------|
| **CRITICAL: Admin has no RBAC until Wave 23** | D02 CRIT-05 | MANDATORY: Wave 20 MUST implement at minimum a simple role check middleware (super_admin/admin/viewer) before exposing admin endpoints. Do NOT wait for Wave 23's full RBAC. Create `adminRoleMiddleware` in `admin-auth.ts` |
| Docker restart endpoint is destructive | D02 AUTH-04 | `POST /api/admin/docker/services/:name/restart` requires `super_admin` role PLUS rate limit of 1 restart per service per 5 minutes. Restarting postgres would cause total outage — add confirmation requirement |
| 3D graph viz with unbounded node count — not viable | D03 B3 + D01 §4.2 | MANDATORY: Cap `GET /api/admin/cognee/graph` response at 2,000 nodes max. Default view shows dataset-level summary (25 summary nodes). Drill-down expands individual datasets. LOD (Level of Detail) required |
| Admin graph endpoint duplicates Wave 16 route | D04 A02 | Wave 20's admin graph endpoint MUST delegate to Wave 16's graph service layer, not reimplement graph fetch. Avoids data inconsistency |
| Admin data access must be audit-logged | D02 ISO-03 | All admin data access MUST be logged in audit_trails with admin userId, timestamp, and data accessed |
| Agent usage analytics needed | D01 §1.4 | Admin dashboard SHOULD include agent usage analytics: invocations/week, token cost/month, success/error rate per agent. Auto-flag agents with <10 invocations/month for consolidation review |
| Auth role taxonomy conflict with Wave 23 | D04 A03 | Wave 20 creates `admin_users(role: super_admin/admin/viewer)`. Wave 23 introduces `role(owner/admin/accountant/bookkeeper/viewer)`. Design Wave 20 auth to be forward-compatible: use a `permissions` JSON column that Wave 23 can migrate to full RBAC |
| Execution log needs cursor-based pagination | D03 §Wave20 | Agent execution logs (potentially millions of rows) MUST use cursor-based pagination, not offset-based |

## Team Structure — 10 Agents

### Agent 1: admin-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave20-agent-tasks/01-admin-schema-builder.md`

### Agent 2: admin-auth-builder [PRIORITY: WAVE 1]
**Task file**: `wave20-agent-tasks/02-admin-auth-builder.md`
**Creates**: server/src/services/admin-auth.ts

### Agent 3: agent-monitoring-builder [PRIORITY: WAVE 1]
**Task file**: `wave20-agent-tasks/03-agent-monitoring-builder.md`
**Creates**: server/src/services/agent-monitoring.ts

### Agent 4: system-health-builder [DEPENDS ON: Agent 1]
**Task file**: `wave20-agent-tasks/04-system-health-builder.md`
**Creates**: server/src/services/system-health.ts

### Agent 5: cognee-admin-builder [DEPENDS ON: Agent 1]
**Task file**: `wave20-agent-tasks/05-cognee-admin-builder.md`
**Creates**: server/src/services/cognee-admin.ts

### Agent 6: user-management-builder [DEPENDS ON: Agent 2]
**Task file**: `wave20-agent-tasks/06-user-management-builder.md`
**Creates**: server/src/services/user-management.ts

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5, 6]
**Task file**: `wave20-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-admin-builder [DEPENDS ON: Agent 7]
**Task file**: `wave20-agent-tasks/08-ui-admin-builder.md`
**Creates**: 15 new .tsx components

### Agent 9: graph-viz-3d-builder [DEPENDS ON: Agent 5]
**Task file**: `wave20-agent-tasks/09-graph-viz-3d-builder.md`
**Creates**: CogneeGraphViewer.tsx with three.js integration

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave20-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave20-agent-tasks/`.
