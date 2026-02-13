# Agent 10: Testing & Validation Agent

## Role
Verify the entire Wave 20 Admin Backend pipeline works end-to-end: admin login, agent monitoring dashboard, Cognee management, 3D graph rendering, system health checks, feature flags, and all 28+ admin API endpoints.

## Priority: WAVE 20 (After All Other Agents)

## Wait Condition
Check for ALL marker files: `.agent-done-W20-01` through `.agent-done-W20-09` before starting.

## Files to CREATE

### 1. `server/src/tests/wave20-admin-auth.test.ts`
**Purpose**: Validate admin authentication flow

- [ ] **Test 1: Default Admin Seeding**
  - Start server fresh (empty admin_users table)
  - Assert: default admin user created with username 'admin'
  - Assert: default admin has role 'super_admin'
  - Assert: default admin has all permissions

- [ ] **Test 2: Admin Login Success**
  - Call `POST /api/admin/auth/login` with correct credentials
  - Assert: returns 200 with `success: true`
  - Assert: returns `token` (JWT string)
  - Assert: returns `refreshToken`
  - Assert: returns `admin` object with id, username, role, permissions
  - Assert: `last_login_at` updated in database
  - Assert: `login_count` incremented

- [ ] **Test 3: Admin Login Failure**
  - Call login with wrong password
  - Assert: returns 401 with `error` message
  - Assert: `failed_login_count` incremented

- [ ] **Test 4: Account Lockout**
  - Attempt 5 failed logins
  - Assert: returns 401 with "Account locked" message
  - Assert: `locked_until` set in database
  - Attempt login with correct password while locked
  - Assert: still rejected

- [ ] **Test 5: JWT Token Verification**
  - Login and get token
  - Call `GET /api/admin/auth/me` with token
  - Assert: returns 200 with admin profile
  - Modify token payload (tamper)
  - Assert: returns 401

- [ ] **Test 6: JWT Token Expiry**
  - Create token with 1-second expiry (for testing)
  - Wait 2 seconds
  - Assert: token verification fails

- [ ] **Test 7: Refresh Token**
  - Login and get refresh token
  - Call `POST /api/admin/auth/refresh` with refresh token
  - Assert: returns new access token
  - Use new token successfully

- [ ] **Test 8: Permission Enforcement**
  - Create admin with role 'viewer' (only view_metrics permission)
  - Login as viewer
  - Call `GET /api/admin/agents/stats` (requires view_metrics)
  - Assert: returns 200
  - Call `POST /api/admin/users` (requires manage_users)
  - Assert: returns 403

- [ ] **Test 9: Password Change**
  - Login as admin
  - Call change password with correct current password
  - Assert: success
  - Login with new password
  - Assert: success
  - Login with old password
  - Assert: failure

### 2. `server/src/tests/wave20-agent-monitoring.test.ts`
**Purpose**: Validate agent execution tracking

- [ ] **Test 10: Execution Recording**
  - Call `recordExecutionStart()` with sample params
  - Assert: returns execution ID
  - Assert: record in `agent_executions` with status 'running'
  - Call `recordExecutionComplete()` with success result
  - Assert: record updated with status 'completed'
  - Assert: `duration_ms` > 0
  - Assert: `estimated_cost_usd` calculated correctly

- [ ] **Test 11: Cost Estimation**
  - Record execution with 10,000 input tokens, 2,000 output tokens on Sonnet
  - Expected cost: (10 * $0.003) + (2 * $0.015) = $0.06
  - Assert: `estimated_cost_usd` approximately $0.06

- [ ] **Test 12: Agent Statistics**
  - Record 10 executions (8 success, 2 failed) across 3 agent types
  - Call `getAgentStats()`
  - Assert: `totalExecutions` = 10
  - Assert: `successRate` = 80%
  - Assert: agent breakdown has 3 entries
  - Assert: each agent's success rate calculated correctly

- [ ] **Test 13: Execution History Filtering**
  - Record 20 executions with mixed agent types and statuses
  - Filter by agentType: assert only matching executions returned
  - Filter by status: assert only matching statuses returned
  - Filter by time range: assert only executions in range returned
  - Sort by duration: assert correctly ordered

- [ ] **Test 14: Cost Report**
  - Record executions over 3 days with known costs
  - Call `getCostReport('daily')`
  - Assert: `costByDay` has 3 entries with correct totals
  - Assert: `projectedMonthlyCost` calculated from average

- [ ] **Test 15: Monitoring Wrapper**
  - Use `withMonitoring()` with successful function
  - Assert: execution recorded as completed
  - Use `withMonitoring()` with throwing function
  - Assert: execution recorded as failed with error message
  - Assert: original error is re-thrown

### 3. `server/src/tests/wave20-system-health.test.ts`
**Purpose**: Validate health checks and metrics

- [ ] **Test 16: PostgreSQL Health Check**
  - Call `checkPostgres()`
  - Assert: status = 'healthy'
  - Assert: `connectionCount` > 0
  - Assert: `databaseSizeMb` > 0
  - Assert: `responseTimeMs` < 1000

- [ ] **Test 17: Server Self-Check**
  - Call `checkServer()`
  - Assert: status = 'healthy'
  - Assert: `memoryUsedMb` > 0
  - Assert: `uptimeSeconds` > 0
  - Assert: `nodeVersion` matches process.version

- [ ] **Test 18: Unified Health Report**
  - Call `runAllChecks()`
  - Assert: `overallStatus` = 'healthy' (if all services running)
  - Assert: `services` array includes postgres and server
  - Assert: `summary.healthy` >= 2

- [ ] **Test 19: System Metrics Collection**
  - Call `collectMetrics()`
  - Query `system_metrics` table
  - Assert: records exist for server.memory, server.cpu
  - Assert: values are reasonable (memory > 0, CPU >= 0)

- [ ] **Test 20: API Latency Tracking**
  - Make 5 API requests with latency middleware active
  - Query metrics for api.request.duration_ms
  - Assert: 5 records exist
  - Assert: `responseTimeMs` > 0 for each

- [ ] **Test 21: Health Check Persistence**
  - Run health checks
  - Query `system_health_checks` table
  - Assert: records stored for each service
  - Assert: `checked_at` timestamps are recent

### 4. `server/src/tests/wave20-cognee-admin.test.ts`
**Purpose**: Validate Cognee administration

- [ ] **Test 22: List Datasets**
  - Call `cogneeAdmin.listDatasets()`
  - Assert: returns array with at least 1 dataset
  - Assert: each dataset has name, category, documentCount

- [ ] **Test 23: Graph Statistics**
  - Call `cogneeAdmin.getGraphStats()`
  - Assert: `totalDatasets` > 0
  - Assert: `totalNodes` >= 0
  - Assert: `totalEdges` >= 0
  - Assert: `entityTypeDistribution` is non-empty object

- [ ] **Test 24: Search Testing**
  - Call `cogneeAdmin.testSearch('home loan', { searchTypes: ['CHUNKS', 'GRAPH_COMPLETION'] })`
  - Assert: returns results for each search type
  - Assert: each result has `latencyMs` > 0
  - Assert: at least one search type returns results

### 5. `server/src/tests/wave20-api-endpoints.test.ts`
**Purpose**: Verify all 28+ admin API endpoints

- [ ] **Auth Required Tests**:
  - Call any admin endpoint without Authorization header
  - Assert: returns 401
  - Call with invalid token
  - Assert: returns 401

- [ ] **Admin User Endpoints**:
  - GET /api/admin/users -- 200, array of admin users
  - POST /api/admin/users -- 201, created admin
  - GET /api/admin/users/:id -- 200, admin detail
  - PATCH /api/admin/users/:id -- 200, updated admin
  - DELETE /api/admin/users/:id -- 200, soft deleted

- [ ] **Agent Endpoints**:
  - GET /api/admin/agents/stats -- 200, statistics object
  - GET /api/admin/agents/metrics -- 200, real-time metrics
  - GET /api/admin/agents/executions -- 200, paginated executions
  - GET /api/admin/agents/costs?period=daily -- 200, cost report
  - GET /api/admin/agents/configurations -- 200, agent configs

- [ ] **Cognee Endpoints**:
  - GET /api/admin/cognee/datasets -- 200, dataset list
  - GET /api/admin/cognee/graph/stats -- 200, graph statistics
  - POST /api/admin/cognee/search/test -- 200, search results

- [ ] **System Endpoints**:
  - GET /api/admin/system/health -- 200, health report
  - GET /api/admin/system/metrics -- 200, metrics array
  - GET /api/admin/system/disk -- 200, disk usage

- [ ] **Feature Flag Endpoints**:
  - GET /api/admin/features -- 200, flags array (includes seeded defaults)
  - PATCH /api/admin/features/cognee_enabled -- 200, updated flag

- [ ] **Activity Endpoints**:
  - GET /api/admin/activity -- 200, activity log
  - GET /api/admin/activity/summary -- 200, summary object

### 6. `server/src/tests/wave20-3d-graph.test.ts`
**Purpose**: Validate 3D graph rendering (limited to data validation, not visual)

- [ ] **Test 25: Graph Data Transformation**
  - Fetch Cognee graph data via API
  - Transform to 3d-force-graph format
  - Assert: nodes array is non-empty
  - Assert: each node has id, name, type, color
  - Assert: links reference valid node IDs
  - Assert: node colors match entity type color scheme

- [ ] **Test 26: Graph Filtering**
  - Apply entity type filter
  - Assert: only matching node types remain
  - Assert: links only connect remaining nodes (no dangling edges)

- [ ] **Test 27: Connection Threshold**
  - Apply minConnections = 3
  - Assert: all remaining nodes have >= 3 connections

### 7. `server/src/tests/wave20-validation-report.md`
**Purpose**: Manual validation checklist and results

- [ ] Document: Admin login flow works (seed -> login -> JWT -> protected routes)
- [ ] Document: Admin user CRUD (create, read, update, deactivate)
- [ ] Document: Permission enforcement (viewer cannot manage users)
- [ ] Document: Agent monitoring accuracy (compare recorded tokens vs actual API response)
- [ ] Document: Cost estimation accuracy (spot-check 3 executions)
- [ ] Document: System health checks all return (postgres, cognee, server, client)
- [ ] Document: Cognee dataset list matches actual datasets
- [ ] Document: Feature flags toggle correctly and affect system behavior
- [ ] Document: 3D graph renders at 60fps with Chrome DevTools Performance tab
- [ ] Document: 3D graph node click zooms and shows detail panel
- [ ] Document: 3D graph filter controls work (entity type, dataset, search)
- [ ] Document: Activity log captures admin actions correctly
- [ ] Document: UI admin dashboard loads all 15 components without errors

## Files to MODIFY

None.

## Verification
- [ ] All admin auth tests pass (login, lockout, JWT, permissions)
- [ ] Agent monitoring correctly tracks executions and costs
- [ ] System health checks return valid data for all services
- [ ] Cognee admin operations work (list, graph stats, search test)
- [ ] All 28+ admin API endpoints return correct responses
- [ ] 3D graph data transforms correctly (nodes, links, colors)
- [ ] Validation report documents all manual checks
- [ ] Create marker file: `.agent-done-W20-10`

## Dependencies
- **Requires**: ALL Wave 20 agents (`.agent-done-W20-01` through `.agent-done-W20-09`)
- **External**: PostgreSQL must be running for health checks
- **External**: Cognee must be running for dataset/graph tests
