# Agent 01: API Stubs & Missing Exports

## Mission
Add ALL missing exported members to `client/src/api.ts` to fix ~175 TS2305 errors ("Module has no exported member").

## Context
The client has 298 TypeScript compilation errors. 175 of them are TS2305 — components import types and API namespaces from `@/api` or `../../../api` that don't exist yet. You must add stub exports for every missing member.

## CRITICAL RULES
1. Do NOT delete or modify any existing exports in api.ts
2. Do NOT modify any component files — only api.ts
3. Every stub must return a Promise with sensible empty/default data
4. Every exported type must have all fields that components actually use
5. Run `npx tsc -b --noEmit 2>&1 | grep "error TS2305"` BEFORE and AFTER to verify you fixed them all

## Missing Exported Members (96 unique symbols)

### API Namespace Objects (these are objects with methods)
Each should be an object with async methods that return sensible defaults:

```
entityApi, assetApi, forecastApi, intelligenceApi, knowledgeApi, inventoryApi,
matchesApi, reconApi, reportsApi, budgetsApi, loanApi, anomalyApi, complianceApi,
consolidationApi, documentsApi, forecastsApi
```

### Standalone Functions
```
adminLogin, fetchActivityLog, fetchActivitySummary, fetchAdminProfile, fetchAdminUsers,
fetchAgentConfigs, fetchAgentCosts, fetchAgentExecutions, fetchAgentStats,
fetchBestRates, fetchCdrAlerts, fetchCdrProducts, fetchCogneeAdminDatasets,
fetchCogneeDatasetDetail, fetchCogneeGraphStats, fetchDataHolders, fetchDiskUsage,
fetchFeatureFlags, fetchHealthHistory, fetchSystemHealth, fetchSystemMetrics,
testCogneeSearch, reindexCogneeDataset, triggerCdrCrawl, compareCdrProducts,
calculateSavings, createAdminUser, createCdrAlert, createFeatureFlag,
deleteAdminUser, deleteCdrAlert, updateAdminUser, updateAgentConfig, updateFeatureFlag
```

### Type Exports
```
AssetRegisterResponse, AutoMatchResult, BalanceSheetReport, BatchDepreciationResult,
BorrowingCapacityResult, Budget, BudgetLine, BudgetVariance, CarFinanceComparison,
CashFlowReport, CategoryGroup, ConsolidationDetailResponse, ConsolidationSnapshotData,
DepreciationScheduleResponse, DetectedEquityEvent, EntityData, EntityHierarchyResponse,
EntitySettingData, EntityWithDetails, EquitySummary, FixedAssetData, ForecastPeriod,
ForecastScenario, HomeLoanResult, InterEntityTransactionData, KPIMetric,
MatchCandidate, MatchStats, OCRDocument, PaymentMatchRule, PeriodComparisonReport,
PeriodComparisonRow, PersonalLoanResult, ProjectionResult, RecurringBill,
RefinanceResult, RepaymentFrequency, TaxReturnResult, TaxStrategyRecord,
TrialBalanceEntry, TrialBalanceReport, VarianceSummary, WealthProjectionResult
```

## Strategy
1. First read `client/src/api.ts` to understand the existing pattern
2. Look at a few component files to understand what fields each type needs
3. Add all type interfaces at the bottom of api.ts (before any final exports)
4. Add all API namespace objects and standalone functions
5. Run `npx tsc -b --noEmit 2>&1 | grep "TS2305" | wc -l` to verify 0 remaining

## Also Fix TS2339 Errors (20 errors)
These are "Property does not exist on type" — meaning existing API objects are missing methods.
Add these missing methods to the EXISTING api objects:

- `analyticsApi` needs: `fetchBillAlerts`, `projectRevenue`, `projectExpenses`, `calculateWealthProjection`
- `taxApi` needs: `fetchCompanyReturn`, `fetchPersonalReturn`, `fetchSoleTraderReturn`, `fetchTrustReturn`, `fetchStrategies`, `generateStrategies`, `updateStrategyStatus`, `scanEquity`, `confirmEquityEvent`, `fetchEquitySummary`
- `transactionsApi` needs: `fetchAuditLog`
- `fetchMarketRates` → check if it should be `fetchMarketPrices` (TS2724 typo)

## Also Fix TS2551 Errors (2 errors)
- `fetchEquitySummary` → add to taxApi (OwnerEquityPanel.tsx uses it)

## Completion
When done, create marker file: `touch .agent-done-GF-01`

