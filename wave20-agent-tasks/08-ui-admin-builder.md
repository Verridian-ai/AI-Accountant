# Agent 8: UI Admin Builder

## Role
Build 15 React components for the Admin Dashboard feature, providing a separate /admin route (not a tab) with system monitoring, agent analytics, Cognee management, user management, and feature flags.

## Priority: WAVE 20 (After Agent 7)

## Wait Condition
Check for `.agent-done-W20-07` marker file before starting.

## Files to CREATE

### 1. `client/src/features/admin/index.ts`
**Purpose**: Feature barrel export
```typescript
export { AdminLayout } from './components/AdminLayout';
export { AdminLogin } from './components/AdminLogin';
export { AdminDashboard } from './components/AdminDashboard';
export { AgentMonitor } from './components/AgentMonitor';
export { AgentExecutionDetail } from './components/AgentExecutionDetail';
export { AgentCostDashboard } from './components/AgentCostDashboard';
export { AgentConfigManager } from './components/AgentConfigManager';
export { SystemHealthDashboard } from './components/SystemHealthDashboard';
export { CogneeManager } from './components/CogneeManager';
export { CogneeDatasetDetail } from './components/CogneeDatasetDetail';
export { CogneeSearchTester } from './components/CogneeSearchTester';
export { UserManager } from './components/UserManager';
export { ActivityLog } from './components/ActivityLog';
export { FeatureFlagManager } from './components/FeatureFlagManager';
export { SystemMetricsCharts } from './components/SystemMetricsCharts';
```

### 2. `client/src/features/admin/components/AdminLayout.tsx`
**Purpose**: Admin dashboard layout wrapper with sidebar navigation
**Pattern**: Separate from main app layout, independent routing

- [ ] Full-height layout with collapsible sidebar:
  - Sidebar nav items with icons:
    - Dashboard (home icon)
    - Agents (robot icon)
    - Cognee (graph icon)
    - System (server icon)
    - Users (people icon)
    - Activity (history icon)
    - Features (flag icon)
  - Current admin name and role in sidebar footer
  - Logout button
- [ ] Main content area renders active section
- [ ] Dark theme matching main app but with admin-specific styling:
  - Slightly different accent (blue-gold gradient for admin vs gold for main)
  - Admin badge/indicator in header
- [ ] Responsive: sidebar collapses to icons on narrow screens
- [ ] Admin auth context: check JWT validity, redirect to login if expired

### 3. `client/src/features/admin/components/AdminLogin.tsx`
**Purpose**: Admin login page

- [ ] Centered login form (`neu-raised` container):
  - GoldLedger logo
  - "Admin Portal" title
  - Username input
  - Password input
  - "Login" button
  - Error message display (invalid credentials, account locked)
  - Remaining attempts warning
- [ ] On success: store JWT in localStorage, redirect to /admin
- [ ] Store refresh token for session renewal
- [ ] Auto-redirect to /admin if valid token exists

### 4. `client/src/features/admin/components/AdminDashboard.tsx`
**Purpose**: Admin overview page with key metrics

- [ ] **Summary Cards Row** (6 cards, `neu-raised`):
  - Total Agent Executions (24h)
  - Agent Success Rate
  - Total Token Cost (24h)
  - System Health Status (healthy/degraded/unhealthy badge)
  - Active Cognee Datasets
  - Total Admin Users
- [ ] **Recent Agent Activity** (mini table):
  - Last 10 executions: agent type, status, duration, cost, time
  - Click row to navigate to execution detail
- [ ] **System Health Strip**: row of service status indicators (green/yellow/red dots for each service)
- [ ] **Quick Actions Grid**:
  - Trigger CDR Crawl button
  - Refresh Market Data button
  - Reindex Cognee button
  - View Error Log button
- [ ] Auto-refresh every 30 seconds

### 5. `client/src/features/admin/components/AgentMonitor.tsx`
**Purpose**: Agent execution monitoring dashboard

- [ ] **Stats Overview** (4 summary cards):
  - Executions (24h): count with sparkline
  - Success Rate: percentage with trend
  - Avg Response Time: ms with trend
  - Token Cost (24h): USD with trend
- [ ] **Agent Breakdown Table**:
  - Columns: Agent Type, Executions, Success Rate, Avg Duration, Total Tokens, Cost
  - Color-coded success rate (green >95%, yellow >80%, red <80%)
  - Click row to filter execution history
- [ ] **Execution History List** (paginated):
  - Filters: agent type dropdown, status dropdown, date range picker
  - Each row: ID, agent, status badge (green/red/yellow), duration, tokens, cost, time
  - Click row for detail view
- [ ] **Hourly Activity Chart**: bar chart of executions per hour
- [ ] **Model Usage Pie Chart**: token distribution by model

### 6. `client/src/features/admin/components/AgentExecutionDetail.tsx`
**Purpose**: Detailed view of single agent execution

- [ ] **Header**: agent name, status badge, duration, cost
- [ ] **Input/Output Section**: expandable JSON viewers
- [ ] **Tool Calls Timeline**: sequential list of tool calls with name, duration, success/failure
- [ ] **Token Usage Bar**: visual bar showing input vs output tokens
- [ ] **Error Section** (if failed): error message and stack trace in monospace

### 7. `client/src/features/admin/components/AgentCostDashboard.tsx`
**Purpose**: Cost analysis and budget tracking

- [ ] **Period Selector**: Daily | Weekly | Monthly
- [ ] **Total Cost Card**: large USD amount with period comparison
- [ ] **Cost by Agent Bar Chart**: horizontal bar chart of cost per agent type
- [ ] **Cost by Model Pie Chart**: cost distribution by model
- [ ] **Daily Cost Trend Line Chart**: cost over time
- [ ] **Top Expensive Executions Table**: highest cost individual executions
- [ ] **Projected Monthly Cost**: estimated from recent average

### 8. `client/src/features/admin/components/AgentConfigManager.tsx`
**Purpose**: Configure agent models, token limits, and enable/disable

- [ ] **Agent Configuration Table**:
  - Columns: Agent, Model, Max Input Tokens, Max Output Tokens, Temperature, Rate Limit, Enabled
  - Edit inline or via modal
- [ ] **Edit Modal** per agent:
  - Model dropdown (available Claude/OpenRouter models)
  - Token limit inputs
  - Temperature slider (0-1)
  - Rate limit inputs (per minute, per hour)
  - Circuit breaker config
  - Enable/disable toggle
  - System prompt override (code editor)
- [ ] Save changes via PATCH /api/admin/agents/configurations/:type

### 9. `client/src/features/admin/components/SystemHealthDashboard.tsx`
**Purpose**: System health overview and service status

- [ ] **Service Grid** (card per service):
  - PostgreSQL: status, connections, DB size, uptime
  - Cognee: status, datasets, graph accessible
  - Server: status, memory, CPU, uptime
  - Client: status, response time
  - External APIs: CDR Register, Alpha Vantage, CoinGecko, RBA, ABS
  - Each card: green/yellow/red indicator, key metric, last check time
- [ ] **Health History Timeline**: line chart of response times per service
- [ ] **Uptime Percentage**: calculate from health check history (last 24h, 7d, 30d)
- [ ] **Disk Usage Bar**: visual bar of disk utilization
- [ ] **Server Metrics**: memory chart, CPU chart, event loop lag chart
- [ ] Auto-refresh every 60 seconds

### 10. `client/src/features/admin/components/CogneeManager.tsx`
**Purpose**: Cognee dataset management and operations

- [ ] **Dataset Grid** (card per dataset):
  - Name, category badge, document count, node count, edge count
  - Status indicator
  - Last cognified date
  - Actions: View Detail, Reindex, Quality Report
- [ ] **Graph Stats Summary**: total nodes, edges, datasets, density
- [ ] **Quick Actions**:
  - "Reindex All" button with confirmation
  - "Prune Stale Nodes" button with age selector
- [ ] **Reindex Progress**: SSE-powered progress bar during reindex operations

### 11. `client/src/features/admin/components/CogneeDatasetDetail.tsx`
**Purpose**: Detailed view of single Cognee dataset

- [ ] **Overview Stats**: document count, node count, edge count, size
- [ ] **Entity Type Distribution**: horizontal bar chart of entity types
- [ ] **Relationship Type Distribution**: horizontal bar chart of edge types
- [ ] **Document List**: paginated table of indexed documents
- [ ] **Quality Report** (fetched on demand): orphans, duplicates, recommendations

### 12. `client/src/features/admin/components/CogneeSearchTester.tsx`
**Purpose**: Test Cognee search quality across datasets and search types

- [ ] **Search Input**: query text, dataset multi-select, search type multi-select
- [ ] **Results Grid**: one panel per search type showing top results
- [ ] **Comparison View**: side-by-side results from different search types
- [ ] **Latency Display**: per-search-type latency in ms
- [ ] **Relevance Scoring**: manual thumbs up/down on results

### 13. `client/src/features/admin/components/UserManager.tsx`
**Purpose**: Admin user CRUD interface

- [ ] **User Table**: username, email, role badge, status, last login, actions
- [ ] **Create User Form**: username, email, password, role dropdown, permissions checkboxes
- [ ] **Edit User Modal**: update email, display name, role, permissions, active status
- [ ] **Role Descriptions**: tooltip showing default permissions per role
- [ ] **Account Actions**: reset password, unlock account, deactivate

### 14. `client/src/features/admin/components/ActivityLog.tsx`
**Purpose**: User activity log viewer

- [ ] **Filters**: user dropdown, action type dropdown, date range, resource type
- [ ] **Activity Table**: timestamp, user, action, resource, status, duration
- [ ] **Activity Summary Chart**: daily activity bar chart
- [ ] **Most Active Hour Indicator**
- [ ] **Top Resources**: most accessed resource types

### 15. `client/src/features/admin/components/FeatureFlagManager.tsx`
**Purpose**: Feature flag toggle and management

- [ ] **Flag List**: grouped by category
  - Each flag: name, description, toggle switch, rollout percentage slider
  - Color: green for enabled, grey for disabled
  - Category headers: General, AI, Data Feeds, UI, Experimental
- [ ] **Create Flag Form**: name, display name, description, category, initial state
- [ ] **Edit Modal**: description, rollout percentage, conditions JSON editor
- [ ] **Audit Trail**: who changed what flag when (from activity log)

### 16. `client/src/features/admin/components/SystemMetricsCharts.tsx`
**Purpose**: Time-series charts for system metrics

- [ ] **Memory Chart**: heap used, RSS, total over time (line chart)
- [ ] **CPU Chart**: user time, system time over time
- [ ] **API Latency Chart**: average response time per endpoint
- [ ] **Database Chart**: connection count, DB size over time
- [ ] **Time Range Selector**: 1h, 6h, 24h, 7d
- [ ] **Aggregation Selector**: raw, 1min, 5min, 1hr averages

## Files to MODIFY

### 17. `client/src/App.tsx`
- [ ] Add admin routes (separate from main tab routing):
  ```typescript
  import { AdminLayout, AdminLogin } from './features/admin';

  // In router:
  <Route path="/admin/login" element={<AdminLogin />} />
  <Route path="/admin/*" element={<AdminLayout />}>
    <Route index element={<AdminDashboard />} />
    <Route path="agents" element={<AgentMonitor />} />
    <Route path="agents/:id" element={<AgentExecutionDetail />} />
    <Route path="agents/costs" element={<AgentCostDashboard />} />
    <Route path="agents/config" element={<AgentConfigManager />} />
    <Route path="system" element={<SystemHealthDashboard />} />
    <Route path="system/metrics" element={<SystemMetricsCharts />} />
    <Route path="cognee" element={<CogneeManager />} />
    <Route path="cognee/:name" element={<CogneeDatasetDetail />} />
    <Route path="cognee/search" element={<CogneeSearchTester />} />
    <Route path="users" element={<UserManager />} />
    <Route path="activity" element={<ActivityLog />} />
    <Route path="features" element={<FeatureFlagManager />} />
  </Route>
  ```
- [ ] Admin routes do NOT appear in BottomNavigation (separate portal)

### 18. `client/src/api.ts`
- [ ] Add admin API functions with JWT auth:
  ```typescript
  const adminHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
    'Content-Type': 'application/json'
  });

  // Auth
  export const adminLogin = (username: string, password: string) =>
    fetchJson('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  export const adminRefreshToken = (refreshToken: string) =>
    fetchJson('/api/admin/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  export const adminLogout = () =>
    fetchJson('/api/admin/auth/logout', { method: 'POST', headers: adminHeaders() });

  // Users
  export const fetchAdminUsers = (filters?: any) =>
    fetchJson(`/api/admin/users?${new URLSearchParams(filters)}`, { headers: adminHeaders() });
  export const createAdminUser = (data: any) =>
    fetchJson('/api/admin/users', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(data) });
  export const updateAdminUser = (id: string, data: any) =>
    fetchJson(`/api/admin/users/${id}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(data) });
  export const deleteAdminUser = (id: string) =>
    fetchJson(`/api/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders() });

  // Agents
  export const fetchAgentStats = (from?: string, to?: string) =>
    fetchJson(`/api/admin/agents/stats${from ? `?from=${from}&to=${to}` : ''}`, { headers: adminHeaders() });
  export const fetchAgentMetrics = () =>
    fetchJson('/api/admin/agents/metrics', { headers: adminHeaders() });
  export const fetchAgentExecutions = (filters?: any) =>
    fetchJson(`/api/admin/agents/executions?${new URLSearchParams(filters)}`, { headers: adminHeaders() });
  export const fetchAgentCosts = (period: string) =>
    fetchJson(`/api/admin/agents/costs?period=${period}`, { headers: adminHeaders() });
  export const fetchAgentConfigs = () =>
    fetchJson('/api/admin/agents/configurations', { headers: adminHeaders() });
  export const updateAgentConfig = (agentType: string, data: any) =>
    fetchJson(`/api/admin/agents/configurations/${agentType}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(data) });

  // Cognee
  export const fetchCogneeDatasets = () =>
    fetchJson('/api/admin/cognee/datasets', { headers: adminHeaders() });
  export const fetchCogneeDatasetDetail = (name: string) =>
    fetchJson(`/api/admin/cognee/datasets/${name}`, { headers: adminHeaders() });
  export const reindexCogneeDataset = (name: string) =>
    fetchJson(`/api/admin/cognee/datasets/${name}/reindex`, { method: 'POST', headers: adminHeaders() });
  export const fetchCogneeGraphStats = () =>
    fetchJson('/api/admin/cognee/graph/stats', { headers: adminHeaders() });
  export const testCogneeSearch = (query: string, options?: any) =>
    fetchJson('/api/admin/cognee/search/test', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ query, ...options }) });

  // System
  export const fetchSystemHealth = () =>
    fetchJson('/api/admin/system/health', { headers: adminHeaders() });
  export const fetchSystemMetrics = (filters?: any) =>
    fetchJson(`/api/admin/system/metrics?${new URLSearchParams(filters)}`, { headers: adminHeaders() });
  export const fetchDiskUsage = () =>
    fetchJson('/api/admin/system/disk', { headers: adminHeaders() });

  // Features
  export const fetchFeatureFlags = () =>
    fetchJson('/api/admin/features', { headers: adminHeaders() });
  export const updateFeatureFlag = (flagName: string, data: any) =>
    fetchJson(`/api/admin/features/${flagName}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(data) });

  // Activity
  export const fetchActivityLog = (filters?: any) =>
    fetchJson(`/api/admin/activity?${new URLSearchParams(filters)}`, { headers: adminHeaders() });
  export const fetchActivitySummary = (userId?: string, days?: number) =>
    fetchJson(`/api/admin/activity/summary?${userId ? `userId=${userId}&` : ''}days=${days ?? 30}`, { headers: adminHeaders() });
  ```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] AdminLogin renders and authenticates against admin API
- [ ] AdminDashboard shows summary metrics and quick actions
- [ ] AgentMonitor displays execution table with filters
- [ ] AgentCostDashboard shows cost charts by agent and model
- [ ] SystemHealthDashboard shows service status cards
- [ ] CogneeManager lists datasets with management actions
- [ ] CogneeSearchTester runs multi-type searches with results
- [ ] UserManager supports CRUD operations
- [ ] FeatureFlagManager toggles flags
- [ ] ActivityLog shows filterable activity history
- [ ] Admin routes are separate from main app navigation
- [ ] All components use neumorphic dark theme
- [ ] JWT auth integrated -- redirects to login when expired
- [ ] Create marker file: `.agent-done-W20-08`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W20-07`) for API endpoints
- **Reuses**: Tailwind neumorphic classes, api.ts fetch patterns, recharts for charts
- **New**: React Router nested routes for /admin/* paths
