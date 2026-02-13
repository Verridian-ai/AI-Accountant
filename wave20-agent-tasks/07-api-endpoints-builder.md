# Agent 7: API Endpoints Builder

## Role
Wire 28 new API routes under /api/admin/ for user management, agent monitoring, Cognee administration, system health, and feature flag management. All routes require admin authentication.

## Priority: WAVE 20 (After Agents 1-6)

## Wait Condition
Check for `.agent-done-W20-01`, `.agent-done-W20-02`, `.agent-done-W20-03`, `.agent-done-W20-04`, `.agent-done-W20-05`, `.agent-done-W20-06` marker files before starting.

## Files to MODIFY

### 1. `server/src/index.ts`
**Current state**: ~4,300+ lines with existing routes + Wave 18/19 routes
**Insert location**: After market routes (Wave 19), before claude-agents mount

- [ ] Add imports:
  ```typescript
  import { UserManagementService } from './services/user-management.js';
  import { AgentMonitoringService } from './services/agent-monitoring.js';
  import { SystemHealthService } from './services/system-health.js';
  import { CogneeAdminService } from './services/cognee-admin.js';
  import { adminAuthMiddleware } from './services/admin-auth.js';
  ```

- [ ] Instantiate services:
  ```typescript
  const userManagement = new UserManagementService(adminAuthService);
  const agentMonitoring = new AgentMonitoringService();
  const systemHealth = new SystemHealthService();
  const cogneeAdmin = new CogneeAdminService();
  ```

- [ ] **Admin User Routes (6 endpoints)** -- all require `adminAuthMiddleware('manage_users')`:
  ```typescript
  // List all admin users
  app.get('/api/admin/users', adminAuthMiddleware('manage_users'), async (c) => {
    const filters = {
      role: c.req.query('role'),
      isActive: c.req.query('isActive') === 'true' ? true : c.req.query('isActive') === 'false' ? false : undefined,
      search: c.req.query('search'),
      sortBy: c.req.query('sortBy') as any,
      limit: parseInt(c.req.query('limit') ?? '50'),
      offset: parseInt(c.req.query('offset') ?? '0')
    };
    const result = await userManagement.listAdmins(filters);
    return c.json(result);
  });

  // Get admin user by ID
  app.get('/api/admin/users/:id', adminAuthMiddleware('manage_users'), async (c) => {
    const admin = await userManagement.getAdmin(c.req.param('id'));
    return admin ? c.json(admin) : c.json({ error: 'Admin not found' }, 404);
  });

  // Create admin user
  app.post('/api/admin/users', adminAuthMiddleware('manage_users'), async (c) => {
    const data = await c.req.json();
    const createdBy = c.get('admin').username;
    const admin = await userManagement.createAdmin(data, createdBy);
    return c.json(admin, 201);
  });

  // Update admin user
  app.patch('/api/admin/users/:id', adminAuthMiddleware('manage_users'), async (c) => {
    const data = await c.req.json();
    const updatedBy = c.get('admin').username;
    const admin = await userManagement.updateAdmin(c.req.param('id'), data, updatedBy);
    return c.json(admin);
  });

  // Delete (deactivate) admin user
  app.delete('/api/admin/users/:id', adminAuthMiddleware('manage_users'), async (c) => {
    const deletedBy = c.get('admin').username;
    await userManagement.deleteAdmin(c.req.param('id'), deletedBy);
    return c.json({ success: true });
  });

  // Get available roles and permissions
  app.get('/api/admin/users/roles', adminAuthMiddleware('manage_users'), async (c) => {
    const roles = await userManagement.getAvailableRoles();
    const permissions = await userManagement.getAvailablePermissions();
    return c.json({ roles, permissions });
  });
  ```

- [ ] **Agent Monitoring Routes (6 endpoints)** -- require `adminAuthMiddleware('manage_agents')` or `('view_metrics')`:
  ```typescript
  // Get agent statistics overview
  app.get('/api/admin/agents/stats', adminAuthMiddleware('view_metrics'), async (c) => {
    const from = c.req.query('from');
    const to = c.req.query('to');
    const stats = await agentMonitoring.getAgentStats(from && to ? { from, to } : undefined);
    return c.json(stats);
  });

  // Get real-time agent metrics
  app.get('/api/admin/agents/metrics', adminAuthMiddleware('view_metrics'), async (c) => {
    const metrics = await agentMonitoring.getCurrentMetrics();
    return c.json(metrics);
  });

  // Get agent execution history
  app.get('/api/admin/agents/executions', adminAuthMiddleware('view_metrics'), async (c) => {
    const filters = {
      agentType: c.req.query('agentType'),
      status: c.req.query('status'),
      triggeredBy: c.req.query('triggeredBy'),
      from: c.req.query('from'),
      to: c.req.query('to'),
      limit: parseInt(c.req.query('limit') ?? '50'),
      offset: parseInt(c.req.query('offset') ?? '0'),
      sortBy: c.req.query('sortBy') as any,
      sortOrder: c.req.query('sortOrder') as any
    };
    const result = await agentMonitoring.getExecutionHistory(filters);
    return c.json(result);
  });

  // Get execution detail by ID
  app.get('/api/admin/agents/executions/:id', adminAuthMiddleware('view_metrics'), async (c) => {
    // Query agent_executions by id
  });

  // Get cost report
  app.get('/api/admin/agents/costs', adminAuthMiddleware('view_metrics'), async (c) => {
    const period = (c.req.query('period') ?? 'daily') as 'daily' | 'weekly' | 'monthly';
    const report = await agentMonitoring.getCostReport(period);
    return c.json(report);
  });

  // Get/update agent configurations
  app.get('/api/admin/agents/configurations', adminAuthMiddleware('manage_agents'), async (c) => {
    const configs = await agentMonitoring.getAgentConfigurations();
    return c.json(configs);
  });

  app.patch('/api/admin/agents/configurations/:agentType', adminAuthMiddleware('manage_agents'), async (c) => {
    const agentType = c.req.param('agentType');
    const updates = await c.req.json();
    const config = await agentMonitoring.updateAgentConfiguration(agentType, updates);
    return c.json(config);
  });
  ```

- [ ] **Cognee Admin Routes (7 endpoints)** -- require `adminAuthMiddleware('manage_cognee')`:
  ```typescript
  // List all Cognee datasets
  app.get('/api/admin/cognee/datasets', adminAuthMiddleware('manage_cognee'), async (c) => {
    const datasets = await cogneeAdmin.listDatasets();
    return c.json(datasets);
  });

  // Get dataset detail
  app.get('/api/admin/cognee/datasets/:name', adminAuthMiddleware('manage_cognee'), async (c) => {
    const detail = await cogneeAdmin.getDatasetDetail(c.req.param('name'));
    return c.json(detail);
  });

  // Trigger dataset reindex
  app.post('/api/admin/cognee/datasets/:name/reindex', adminAuthMiddleware('manage_cognee'), async (c) => {
    const options = await c.req.json().catch(() => ({}));
    const result = await cogneeAdmin.reindexDataset(c.req.param('name'), options);
    return c.json(result);
  });

  // Reindex all datasets
  app.post('/api/admin/cognee/reindex-all', adminAuthMiddleware('manage_cognee'), async (c) => {
    const results = await cogneeAdmin.reindexAll();
    return c.json(results);
  });

  // Get graph statistics
  app.get('/api/admin/cognee/graph/stats', adminAuthMiddleware('manage_cognee'), async (c) => {
    const stats = await cogneeAdmin.getGraphStats();
    return c.json(stats);
  });

  // Test search across datasets
  app.post('/api/admin/cognee/search/test', adminAuthMiddleware('manage_cognee'), async (c) => {
    const { query, datasets, searchTypes, topK } = await c.req.json();
    const result = await cogneeAdmin.testSearch(query, { datasets, searchTypes, topK });
    return c.json(result);
  });

  // Get data quality report
  app.get('/api/admin/cognee/datasets/:name/quality', adminAuthMiddleware('manage_cognee'), async (c) => {
    const report = await cogneeAdmin.getDataQualityReport(c.req.param('name'));
    return c.json(report);
  });
  ```

- [ ] **System Health Routes (4 endpoints)** -- require `adminAuthMiddleware('view_metrics')`:
  ```typescript
  // Get full system health report
  app.get('/api/admin/system/health', adminAuthMiddleware('view_metrics'), async (c) => {
    const report = await systemHealth.runAllChecks();
    return c.json(report);
  });

  // Get system metrics
  app.get('/api/admin/system/metrics', adminAuthMiddleware('view_metrics'), async (c) => {
    const filters = {
      metricName: c.req.query('metric'),
      source: c.req.query('source'),
      from: c.req.query('from'),
      to: c.req.query('to'),
      aggregation: c.req.query('aggregation') as any,
      interval: c.req.query('interval') as any,
      limit: parseInt(c.req.query('limit') ?? '100')
    };
    const metrics = await systemHealth.getMetrics(filters);
    return c.json(metrics);
  });

  // Get health check history
  app.get('/api/admin/system/health/history', adminAuthMiddleware('view_metrics'), async (c) => {
    const serviceName = c.req.query('service');
    const hours = parseInt(c.req.query('hours') ?? '24');
    const history = await systemHealth.getHealthHistory(serviceName, hours);
    return c.json(history);
  });

  // Get disk usage
  app.get('/api/admin/system/disk', adminAuthMiddleware('view_metrics'), async (c) => {
    const usage = await systemHealth.getDiskUsage();
    return c.json(usage);
  });
  ```

- [ ] **Feature Flag Routes (3 endpoints)**:
  ```typescript
  // List all feature flags
  app.get('/api/admin/features', adminAuthMiddleware('manage_features'), async (c) => {
    const flags = await userManagement.getFeatureFlags();
    return c.json(flags);
  });

  // Update feature flag
  app.patch('/api/admin/features/:flagName', adminAuthMiddleware('manage_features'), async (c) => {
    const flagName = c.req.param('flagName');
    const updates = await c.req.json();
    const updatedBy = c.get('admin').username;
    const flag = await userManagement.updateFeatureFlag(flagName, updates, updatedBy);
    return c.json(flag);
  });

  // Create feature flag
  app.post('/api/admin/features', adminAuthMiddleware('manage_features'), async (c) => {
    const data = await c.req.json();
    const createdBy = c.get('admin').username;
    const flag = await userManagement.createFeatureFlag(data, createdBy);
    return c.json(flag, 201);
  });
  ```

- [ ] **Activity Log Routes (2 endpoints)**:
  ```typescript
  // Get activity log
  app.get('/api/admin/activity', adminAuthMiddleware('view_metrics'), async (c) => {
    const filters = {
      userId: c.req.query('userId'),
      action: c.req.query('action'),
      resourceType: c.req.query('resourceType'),
      from: c.req.query('from'),
      to: c.req.query('to'),
      limit: parseInt(c.req.query('limit') ?? '100'),
      offset: parseInt(c.req.query('offset') ?? '0')
    };
    const log = await userManagement.getActivityLog(filters);
    return c.json(log);
  });

  // Get activity summary
  app.get('/api/admin/activity/summary', adminAuthMiddleware('view_metrics'), async (c) => {
    const userId = c.req.query('userId');
    const days = parseInt(c.req.query('days') ?? '30');
    const summary = await userManagement.getActivitySummary(userId ?? undefined, days);
    return c.json(summary);
  });
  ```

### Route Summary (28 total):
| Method | Path | Permission | Handler |
|--------|------|------------|---------|
| GET | /api/admin/users | manage_users | listAdmins |
| GET | /api/admin/users/roles | manage_users | getAvailableRoles |
| GET | /api/admin/users/:id | manage_users | getAdmin |
| POST | /api/admin/users | manage_users | createAdmin |
| PATCH | /api/admin/users/:id | manage_users | updateAdmin |
| DELETE | /api/admin/users/:id | manage_users | deleteAdmin |
| GET | /api/admin/agents/stats | view_metrics | getAgentStats |
| GET | /api/admin/agents/metrics | view_metrics | getCurrentMetrics |
| GET | /api/admin/agents/executions | view_metrics | getExecutionHistory |
| GET | /api/admin/agents/executions/:id | view_metrics | getExecution |
| GET | /api/admin/agents/costs | view_metrics | getCostReport |
| GET | /api/admin/agents/configurations | manage_agents | getConfigurations |
| PATCH | /api/admin/agents/configurations/:type | manage_agents | updateConfiguration |
| GET | /api/admin/cognee/datasets | manage_cognee | listDatasets |
| GET | /api/admin/cognee/datasets/:name | manage_cognee | getDatasetDetail |
| POST | /api/admin/cognee/datasets/:name/reindex | manage_cognee | reindexDataset |
| POST | /api/admin/cognee/reindex-all | manage_cognee | reindexAll |
| GET | /api/admin/cognee/graph/stats | manage_cognee | getGraphStats |
| POST | /api/admin/cognee/search/test | manage_cognee | testSearch |
| GET | /api/admin/cognee/datasets/:name/quality | manage_cognee | getDataQualityReport |
| GET | /api/admin/system/health | view_metrics | runAllChecks |
| GET | /api/admin/system/metrics | view_metrics | getMetrics |
| GET | /api/admin/system/health/history | view_metrics | getHealthHistory |
| GET | /api/admin/system/disk | view_metrics | getDiskUsage |
| GET | /api/admin/features | manage_features | getFeatureFlags |
| PATCH | /api/admin/features/:flagName | manage_features | updateFeatureFlag |
| POST | /api/admin/features | manage_features | createFeatureFlag |
| GET | /api/admin/activity | view_metrics | getActivityLog |
| GET | /api/admin/activity/summary | view_metrics | getActivitySummary |

**Note**: Auth routes (login, refresh, logout, me, change-password) are 5 additional routes added by Agent 2, totaling 33 admin routes.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 28 routes accessible via curl with admin JWT
- [ ] Routes reject requests without Authorization header (401)
- [ ] Routes reject requests with insufficient permissions (403)
- [ ] No route path conflicts (all under `/api/admin/`)
- [ ] GET /api/admin/agents/stats returns agent statistics
- [ ] GET /api/admin/system/health returns health report
- [ ] GET /api/admin/cognee/datasets returns dataset list
- [ ] PATCH /api/admin/features/:name toggles feature flag
- [ ] Create marker file: `.agent-done-W20-07`

## Dependencies
- **Requires**: ALL Wave 20 Agents 1-6
- **IMPORTANT**: Only this agent modifies server/src/index.ts for Wave 20 admin routes
