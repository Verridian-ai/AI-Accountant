/**
 * Financial Reports Module — Barrel Export
 */

export * from './types.js';
export { REVENUE_CATEGORIES, COGS_CATEGORIES, SYSTEM_CATEGORIES, INVESTING_CATEGORIES, FINANCING_CATEGORIES, safeDivide, getPriorPeriod, calculateVariances, buildVariance } from './constants.js';
export { FinancialReportService } from './report-service.js';
export { ReportAnalytics, parsePeriodRange } from './report-analytics.js';

import { FinancialReportService } from './report-service.js';

// Export singleton instance
export const financialReportService = new FinancialReportService();
