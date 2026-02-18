// ============================================================================
// DB ROW TYPES — internal type aliases inferred from schema
// Not exported — used only within this module directory.
// ============================================================================

import {
  transactions,
  basPeriods,
  basCalculations,
  taxYearSummary,
  reconciliationAlerts,
  forecastScenarios,
  forecastPeriods,
  kpiMetrics,
  crossModuleInsights,
  moduleConnections,
} from '../../schema.js';

export type TransactionRow = typeof transactions.$inferSelect;
export type BasPeriodRow = typeof basPeriods.$inferSelect;
export type BasCalculationRow = typeof basCalculations.$inferSelect;
export type TaxYearSummaryRow = typeof taxYearSummary.$inferSelect;
export type ReconciliationAlertRow = typeof reconciliationAlerts.$inferSelect;
export type ForecastScenarioRow = typeof forecastScenarios.$inferSelect;
export type ForecastPeriodRow = typeof forecastPeriods.$inferSelect;
export type KpiMetricRow = typeof kpiMetrics.$inferSelect;
export type CrossModuleInsightRow = typeof crossModuleInsights.$inferSelect;
export type ModuleConnectionRow = typeof moduleConnections.$inferSelect;
