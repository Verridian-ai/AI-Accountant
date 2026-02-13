# Agent 02: Type Annotations & Implicit Any Fixes

## Mission
Fix ALL ~67 TS7006 errors ("Parameter implicitly has an 'any' type") and ~9 TS18046 errors ("is of type 'unknown'") across the client codebase.

## Context
The client TypeScript config has `strict: true` which requires explicit type annotations. Many callback parameters and error handlers are missing types.

## CRITICAL RULES
1. Do NOT change any business logic — only add type annotations
2. Use the most specific type possible (check what the parameter is used for)
3. For error handlers, use `(err: Error)` or `(err: unknown)`
4. For array callbacks, check the array type to determine parameter type
5. For event handlers, use appropriate React/DOM event types
6. Run `npx tsc -b --noEmit 2>&1 | grep "TS7006\|TS18046"` BEFORE and AFTER

## Files with TS7006 Errors (implicit any)

### admin/
- `AdminLayout.tsx(50)` — `p` parameter
- `CogneeSearchTester.tsx(28)` — `res` parameter

### analytics/
- `BillAlerts.tsx(20)` — `err` parameter
- `BudgetProjections.tsx(108,136)` — `p` parameter
- `ForecastDashboard.tsx(57,70)` — `p` parameter
- `WealthProjection.tsx(93,134,142,151,154)` — `profile`, `p`, `_`, `idx` parameters

### assets/
- `DepreciationScheduleView.tsx(91,149)` — `item`, `e`, `i` parameters

### budgets/
- `BudgetEditor.tsx(82)` — `prev` parameter

### compliance/
- Various files — check each for implicit any

### documents/
- Various files — check each for implicit any

### entities/
- `ConsolidationView.tsx(251)` — `elim`, `idx` parameters
- `EntitiesDashboard.tsx(43,44,63)` — `sum`, `e` parameters
- `EntityHierarchyView.tsx(73,115,216,230)` — `e`, `entity`, `acc`, `child` parameters

### knowledge/
- `DataPointManager.tsx(49)` — `e` parameter
- `FeedbackPanel.tsx(43)` — `e` parameter
- `GraphStatsPanel.tsx(31)` — `e` parameter
- `OntologyManager.tsx(51)` — `e` parameter

### loans/
- `HomeLoanCalculator.tsx(193)` — `row` parameter

### matching/
- `AutoMatchView.tsx(35,53,196)` — `d`, `detail`, `i` parameters
- `MatchStatistics.tsx(51,125,164,165)` — `v`, `vendor`, `i`, `a`, `b`, `rule` parameters

### reports/
- `BalanceSheet.tsx(58)` — `e` parameter
- `CashFlow.tsx(77)` — `e` parameter
- `KPIDashboard.tsx(54,55)` — `data`, `e` parameters
- `PeriodComparison.tsx(40)` — `e` parameter
- `ProfitAndLoss.tsx(69)` — `e` parameter
- `TrialBalance.tsx(29)` — `e` parameter

### tax/
- `CompanyReturn.tsx(24,84,85,127)` — `err`, `value`, `w`, `i` parameters
- `OwnerEquityPanel.tsx(23,202)` — `err`, `m` parameters
- `PersonalReturn.tsx(24,89,90,139)` — `err`, `value`, `w`, `i` parameters
- `SoleTraderReturn.tsx(24,90,91,141)` — `err`, `value`, `w`, `i` parameters
- `TaxOptimizerPanel.tsx(22)` — `err` parameter
- `TrustReturn.tsx(24,47,103,104,143)` — `err`, `w`, `value`, `i` parameters

## Files with TS18046 Errors (type 'unknown')
- `CompanyReturn.tsx(84,85)` — cast `value` to `number`
- `PersonalReturn.tsx(89,90)` — cast `value` to `number`
- `SoleTraderReturn.tsx(90,91)` — cast `value` to `number`
- `TrustReturn.tsx(103,104)` — cast `value` to `number`
- `ConsolidationView.tsx(225,228,229,230)` — cast `data` appropriately

## Strategy
1. Run `npx tsc -b --noEmit 2>&1 | grep "TS7006\|TS18046"` to get exact list
2. For each file, read the context around the error line
3. Add the appropriate type annotation
4. Common patterns:
   - Error handlers: `(err: Error)` or `(err: unknown)`
   - Array map/filter: check the array's element type
   - Object entries: `(key: string, value: unknown)`
   - Event handlers: `(e: React.ChangeEvent<HTMLInputElement>)` etc.
   - Unknown values: use type assertion `(value as number)` or type guard

## Completion
When done, create marker file: `touch .agent-done-GF-02`

