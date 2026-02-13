# Agent W15-07: API Endpoints Builder

## Role
Wire 20 new API routes in server/src/index.ts for forecasting, anomaly detection, and compliance monitoring.

## Priority: WAVE 15 (After W15-02, W15-03, W15-05 complete)

## Wait Condition
Check for `.agent-done-W15-02`, `.agent-done-W15-03`, `.agent-done-W15-05` marker files before starting.

## File to MODIFY

### `server/src/index.ts`
**Current state**: ~4,300+ lines with existing routes
**Insert location**: After existing route blocks, before final app mount

- [ ] Add imports for 3 new services:
  ```typescript
  import { CashFlowForecastService } from './services/cash-flow-forecast.js';
  import { AnomalyDetectionService } from './services/anomaly-detection.js';
  import { ComplianceMonitorService } from './services/compliance-monitor.js';
  ```

- [ ] Instantiate 3 services:
  ```typescript
  const cashFlowForecastService = new CashFlowForecastService();
  const anomalyDetectionService = new AnomalyDetectionService();
  const complianceMonitorService = new ComplianceMonitorService();
  ```

- [ ] Add 7 Forecast routes:
  - `POST /api/forecasts/generate` -- Body: `{ userId, accountId?, type, startDate, endDate, granularity }`. Calls `cashFlowForecastService.generateForecast()`.
  - `GET /api/forecasts/:userId` -- Query: `?status=active`. Calls `cashFlowForecastService.getForecasts()`.
  - `GET /api/forecasts/detail/:forecastId` -- Calls `cashFlowForecastService.getForecastById()`. Returns forecast + periods.
  - `POST /api/forecasts/:forecastId/accuracy` -- Calls `cashFlowForecastService.calculateAccuracy()`. Returns MAE, RMSE, MAPE.
  - `POST /api/forecasts/compare` -- Body: `{ forecastIds: string[] }`. Calls `cashFlowForecastService.compareForecasts()`.
  - `POST /api/forecasts/:forecastId/update-actuals` -- Calls `cashFlowForecastService.updateActuals()`. Backfills real data.
  - `PATCH /api/forecasts/:forecastId/archive` -- Calls `cashFlowForecastService.archiveForecast()`.

- [ ] Add 6 Anomaly Detection routes:
  - `POST /api/anomalies/scan` -- Body: `{ userId, accountId?, dateFrom?, dateTo?, detectors, severityThreshold? }`. Calls `anomalyDetectionService.scanTransactions()`.
  - `GET /api/anomalies/:userId` -- Query: `?status=open&severity=high&type=duplicate_payment&dateFrom=&dateTo=`. Calls `anomalyDetectionService.getAlerts()`.
  - `GET /api/anomalies/stats/:userId` -- Calls `anomalyDetectionService.getAlertStats()`. Returns aggregated counts.
  - `PATCH /api/anomalies/:alertId/acknowledge` -- Calls `anomalyDetectionService.acknowledgeAlert()`.
  - `PATCH /api/anomalies/:alertId/resolve` -- Body: `{ resolvedBy }`. Calls `anomalyDetectionService.resolveAlert()`.
  - `PATCH /api/anomalies/:alertId/dismiss` -- Body: `{ reason }`. Calls `anomalyDetectionService.dismissAlert()`.

- [ ] Add 7 Compliance routes:
  - `GET /api/compliance/:userId/obligations` -- Query: `?asOfDate=`. Calls `complianceMonitorService.checkObligations()`.
  - `POST /api/compliance/:userId/schedule` -- Body: `{ financialYear, entityType }`. Calls `complianceMonitorService.generateSchedule()`.
  - `GET /api/compliance/:userId/upcoming` -- Query: `?days=30`. Calls `complianceMonitorService.getUpcomingDeadlines()`.
  - `PATCH /api/compliance/:checkId/lodge` -- Body: `{ referenceNumber, lodgedDate? }`. Calls `complianceMonitorService.markLodged()`.
  - `GET /api/compliance/:userId/risk` -- Calls `complianceMonitorService.assessOverallRisk()`.
  - `POST /api/compliance/:userId/report` -- Body: `{ period, includeRecommendations }`. Generates compliance report via agent.
  - `GET /api/compliance/:userId/calendar` -- Returns all deadlines for financial year as calendar events.

### Route Pattern (follow existing pattern):
```typescript
app.post('/api/forecasts/generate', async (c) => {
    try {
        const body = await c.req.json();
        const { userId, accountId, type, startDate, endDate, granularity } = body;
        const result = await cashFlowForecastService.generateForecast(userId, accountId, {
            type, startDate, endDate, granularity
        });
        return c.json(result);
    } catch (err) {
        console.error('Forecast generation failed:', err);
        return c.json({ error: 'Failed to generate forecast' }, 500);
    }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 20 routes are accessible (test with curl after Docker rebuild)
- [ ] No route path conflicts with existing routes
- [ ] POST routes accept JSON body correctly
- [ ] GET routes support query parameters
- [ ] PATCH routes return updated entity
- [ ] Create marker file: `.agent-done-W15-07`

## Dependencies
- **Requires**: W15-02 (`.agent-done-W15-02`), W15-03 (`.agent-done-W15-03`), W15-05 (`.agent-done-W15-05`)
- **IMPORTANT**: Only W15-07 modifies server/src/index.ts in Wave 15
