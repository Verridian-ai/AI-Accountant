# Agent 4: System Health Builder

## Role
Build a system health monitoring service that performs health checks on all Docker services (postgres, redis, cognee, server, client), collects system metrics (CPU, memory, disk, API latency), and provides a unified health dashboard API.

## Priority: WAVE 20 (After Agent 1)

## Wait Condition
Check for `.agent-done-W20-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/system-health.ts`
**Purpose**: Health checks for all services and system metrics collection
**Pattern**: Service class with periodic health monitoring

- [ ] Create `SystemHealthService` class:
  ```typescript
  interface HealthConfig {
    checkIntervalMs: number;          // default: 60000 (1 minute)
    timeoutMs: number;                // default: 5000 (5 second timeout per check)
    retentionHours: number;           // default: 168 (7 days of health history)
    alertOnUnhealthy: boolean;        // default: true
  }
  ```

- [ ] **Service Health Checks** (5 Docker services + external APIs):

  **PostgreSQL**:
  ```typescript
  async checkPostgres(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Execute simple query: SELECT 1
      // Check connection count: SELECT count(*) FROM pg_stat_activity
      // Check database size: SELECT pg_database_size('ai_accountant')
      // Check table count
      return {
        serviceName: 'postgres',
        checkType: 'query',
        status: 'healthy',
        responseTimeMs: Date.now() - start,
        details: {
          connectionCount: number,
          databaseSizeMb: number,
          tableCount: number,
          version: string,
          uptime: string
        }
      };
    } catch (err) {
      return { serviceName: 'postgres', checkType: 'query', status: 'unhealthy', errorMessage: String(err), responseTimeMs: Date.now() - start };
    }
  }
  ```

  **Cognee**:
  ```typescript
  async checkCognee(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // GET http://cognee:8000/health (or configured URL)
      // Check dataset count: GET /v1/datasets
      // Check if graph is accessible
      return {
        serviceName: 'cognee',
        checkType: 'http',
        status: responseOk ? 'healthy' : 'degraded',
        responseTimeMs: Date.now() - start,
        details: {
          apiReachable: boolean,
          datasetCount: number,
          graphAccessible: boolean,
          version: string
        }
      };
    } catch (err) {
      return { serviceName: 'cognee', checkType: 'http', status: 'unhealthy', errorMessage: String(err), responseTimeMs: Date.now() - start };
    }
  }
  ```

  **Server (self-check)**:
  ```typescript
  async checkServer(): Promise<HealthCheckResult> {
    const start = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    return {
      serviceName: 'server',
      checkType: 'internal',
      status: 'healthy',
      responseTimeMs: Date.now() - start,
      details: {
        memoryUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        memoryTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
        memoryRssMb: Math.round(memUsage.rss / 1024 / 1024),
        cpuUserMs: cpuUsage.user / 1000,
        cpuSystemMs: cpuUsage.system / 1000,
        uptimeSeconds: Math.round(uptime),
        nodeVersion: process.version,
        pid: process.pid,
        activeRequests: number,  // track via middleware
        eventLoopLagMs: number   // measure event loop delay
      }
    };
  }
  ```

  **Client (nginx)**:
  ```typescript
  async checkClient(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // GET http://client:80/ (or configured URL)
      // Check response status and content-type
      return {
        serviceName: 'client',
        checkType: 'http',
        status: responseOk ? 'healthy' : 'unhealthy',
        responseTimeMs: Date.now() - start,
        details: { statusCode: number, contentType: string }
      };
    } catch (err) {
      return { serviceName: 'client', checkType: 'http', status: 'unhealthy', errorMessage: String(err), responseTimeMs: Date.now() - start };
    }
  }
  ```

  **External APIs**:
  ```typescript
  async checkExternalApi(name: string, url: string): Promise<HealthCheckResult> {
    // Check CDR Register, Alpha Vantage, CoinGecko, RBA, ABS
    // Simple HTTP HEAD/GET with timeout
  }
  ```

- [ ] **Unified Health Check**: `async runAllChecks(): Promise<SystemHealthReport>`
  ```typescript
  interface SystemHealthReport {
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: HealthCheckResult[];
    summary: {
      healthy: number;
      degraded: number;
      unhealthy: number;
      unknown: number;
    };
    uptimeSeconds: number;
  }
  ```
  - Run all service checks in parallel (with individual timeouts)
  - Overall status: unhealthy if any critical service down, degraded if non-critical down
  - Critical services: postgres, server
  - Non-critical services: cognee, client, external APIs
  - Store results in `system_health_checks` table
  - Emit SSE event if status changes: `system:health:changed`

- [ ] **System Metrics Collection**: `async collectMetrics(): Promise<void>`
  ```typescript
  // Collect and store metrics in system_metrics table
  private async collectServerMetrics(): Promise<SystemMetric[]> {
    return [
      { metricName: 'server.memory.heap_used_mb', metricType: 'gauge', value: heapUsedMb, unit: 'MB', source: 'server' },
      { metricName: 'server.memory.rss_mb', metricType: 'gauge', value: rssMb, unit: 'MB', source: 'server' },
      { metricName: 'server.cpu.user_ms', metricType: 'counter', value: cpuUserMs, unit: 'ms', source: 'server' },
      { metricName: 'server.uptime_seconds', metricType: 'gauge', value: uptimeS, unit: 'seconds', source: 'server' },
      { metricName: 'server.event_loop_lag_ms', metricType: 'gauge', value: lagMs, unit: 'ms', source: 'server' },
      { metricName: 'server.active_connections', metricType: 'gauge', value: connCount, source: 'server' }
    ];
  }

  private async collectDatabaseMetrics(): Promise<SystemMetric[]> {
    // Query pg_stat for table sizes, row counts, connection pool stats
    return [
      { metricName: 'postgres.database_size_mb', metricType: 'gauge', value: sizeMb, unit: 'MB', source: 'postgres' },
      { metricName: 'postgres.active_connections', metricType: 'gauge', value: connCount, source: 'postgres' },
      { metricName: 'postgres.transactions_table_rows', metricType: 'gauge', value: txCount, source: 'postgres' },
      { metricName: 'postgres.statements_table_rows', metricType: 'gauge', value: stmtCount, source: 'postgres' }
    ];
  }
  ```

- [ ] **API Latency Tracking**: middleware to measure request durations
  ```typescript
  requestLatencyMiddleware() {
    return async (c: Context, next: () => Promise<void>) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;
      // Store metric: api.request.duration_ms with tags: { path, method, status }
      this.recordApiLatency(c.req.path, c.req.method, c.res.status, duration);
    };
  }
  ```

- [ ] **Metrics Query**: `async getMetrics(filters: MetricFilters): Promise<SystemMetric[]>`
  ```typescript
  interface MetricFilters {
    metricName?: string;
    source?: string;
    from?: string;
    to?: string;
    aggregation?: 'avg' | 'min' | 'max' | 'sum' | 'count';
    interval?: '1m' | '5m' | '1h' | '1d';
    limit?: number;
  }
  ```
  - Query `system_metrics` with optional time aggregation
  - Support charting intervals (1 minute to 1 day)

- [ ] **Health History**: `async getHealthHistory(serviceName?: string, hours?: number): Promise<HealthCheckResult[]>`
  - Return health check history from `system_health_checks` table
  - Default last 24 hours
  - Calculate uptime percentage per service

- [ ] **Disk Usage** (Docker volumes):
  ```typescript
  async getDiskUsage(): Promise<DiskUsage> {
    // Check disk usage via os module or df command
    return {
      totalGb: number,
      usedGb: number,
      freeGb: number,
      usedPercent: number,
      databaseSizeMb: number,
      uploadsSizeMb: number,
      cogneeDataSizeMb: number
    };
  }
  ```

- [ ] **Periodic Monitoring**: `start()` and `stop()` methods for background health monitoring
  ```typescript
  async start(): Promise<void> {
    this.healthCheckInterval = setInterval(() => this.runAllChecks(), this.config.checkIntervalMs);
    this.metricsInterval = setInterval(() => this.collectMetrics(), 30000);  // every 30s
    console.log('[Health] System health monitoring started');
  }
  ```

- [ ] **Cleanup**: `async cleanupOldData(): Promise<{ metricsDeleted: number; checksDeleted: number }>`
  - Delete health checks and metrics older than retention period
  - Designed to run daily via scheduler

## Files to MODIFY

### 2. `server/src/index.ts`
- [ ] Import and instantiate `SystemHealthService`
- [ ] Add latency tracking middleware (before routes):
  ```typescript
  app.use('*', systemHealth.requestLatencyMiddleware());
  ```
- [ ] Start health monitoring after server starts:
  ```typescript
  systemHealth.start().catch(err => console.error('Health monitoring start failed:', err));
  ```
- [ ] Add health endpoint (public, no auth):
  ```typescript
  app.get('/api/health', async (c) => {
    const report = await systemHealth.runAllChecks();
    const statusCode = report.overallStatus === 'healthy' ? 200 : report.overallStatus === 'degraded' ? 200 : 503;
    return c.json(report, statusCode);
  });
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `checkPostgres()` returns healthy with connection count and DB size
- [ ] `checkCognee()` returns healthy/degraded with dataset count
- [ ] `checkServer()` returns memory and CPU metrics
- [ ] `runAllChecks()` returns unified health report with overall status
- [ ] Health checks stored in `system_health_checks` table
- [ ] System metrics collected and stored in `system_metrics` table
- [ ] API latency middleware records request durations
- [ ] `getMetrics()` returns time-series data with aggregation
- [ ] Health monitoring runs periodically at configured interval
- [ ] GET /api/health returns 200 when all services healthy, 503 when unhealthy
- [ ] Create marker file: `.agent-done-W20-04`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W20-01`) for admin schema/tables
- **Reuses**: Database connection, Cognee client URL, SSE event patterns
