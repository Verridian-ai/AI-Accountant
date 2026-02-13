# Agent 1: Reporting Schema Builder

## Role
Create 8 new database tables for financial reporting, budgeting, forecasting, and KPI tracking, plus migration 0025.

## Priority: WAVE 13 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0025_financial_reporting.sql`
**Purpose**: DDL for 8 new reporting/budgeting tables
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` exactly

```sql
-- Migration 0025: Financial Reporting & Budgeting Platform
-- Tables: report_templates, report_snapshots, budgets, budget_lines,
--         budget_vs_actual, forecast_scenarios, forecast_periods, kpi_metrics
```

- [ ] Create `report_templates` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `user_id` TEXT NOT NULL REFERENCES users(id)
  - `name` TEXT NOT NULL (e.g., "Monthly P&L", "Quarterly Balance Sheet")
  - `report_type` TEXT NOT NULL CHECK (report_type IN ('profit_and_loss', 'balance_sheet', 'cash_flow', 'trial_balance', 'custom'))
  - `config` TEXT NOT NULL (JSON: date ranges, account filters, comparison periods, grouping rules)
  - `schedule` TEXT (JSON: cron expression, next_run, recipients)
  - `is_default` INTEGER DEFAULT 0
  - `created_at` TEXT DEFAULT (datetime('now'))
  - `updated_at` TEXT DEFAULT (datetime('now'))

- [ ] Create `report_snapshots` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `template_id` TEXT NOT NULL REFERENCES report_templates(id)
  - `user_id` TEXT NOT NULL REFERENCES users(id)
  - `report_type` TEXT NOT NULL
  - `period_start` TEXT NOT NULL (ISO date)
  - `period_end` TEXT NOT NULL (ISO date)
  - `data` TEXT NOT NULL (JSON: full report payload — rows, totals, subtotals)
  - `comparison_data` TEXT (JSON: prior period data for variance analysis)
  - `metadata` TEXT (JSON: generation time, row count, account count)
  - `generated_at` TEXT DEFAULT (datetime('now'))
  - INDEX on (user_id, report_type, period_start)

- [ ] Create `budgets` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `user_id` TEXT NOT NULL REFERENCES users(id)
  - `account_id` TEXT REFERENCES accounts(id) (NULL = all accounts)
  - `name` TEXT NOT NULL (e.g., "FY2025 Operating Budget")
  - `budget_type` TEXT NOT NULL CHECK (budget_type IN ('annual', 'quarterly', 'monthly', 'project'))
  - `period_start` TEXT NOT NULL
  - `period_end` TEXT NOT NULL
  - `total_amount` REAL NOT NULL DEFAULT 0
  - `status` TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived'))
  - `auto_generated` INTEGER DEFAULT 0
  - `source_method` TEXT (e.g., 'historical_average', 'ai_forecast', 'manual')
  - `created_at` TEXT DEFAULT (datetime('now'))
  - `updated_at` TEXT DEFAULT (datetime('now'))

- [ ] Create `budget_lines` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `budget_id` TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE
  - `category` TEXT NOT NULL (maps to categories.ts constants)
  - `subcategory` TEXT
  - `period` TEXT NOT NULL (e.g., '2025-01', '2025-Q1')
  - `budgeted_amount` REAL NOT NULL
  - `notes` TEXT
  - `created_at` TEXT DEFAULT (datetime('now'))
  - UNIQUE(budget_id, category, period)

- [ ] Create `budget_vs_actual` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `budget_line_id` TEXT NOT NULL REFERENCES budget_lines(id) ON DELETE CASCADE
  - `actual_amount` REAL NOT NULL DEFAULT 0
  - `variance_amount` REAL NOT NULL DEFAULT 0 (actual - budgeted)
  - `variance_percent` REAL DEFAULT 0
  - `transaction_count` INTEGER DEFAULT 0
  - `last_calculated` TEXT DEFAULT (datetime('now'))
  - INDEX on (budget_line_id)

- [ ] Create `forecast_scenarios` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `user_id` TEXT NOT NULL REFERENCES users(id)
  - `name` TEXT NOT NULL (e.g., "Optimistic Growth Q3")
  - `scenario_type` TEXT NOT NULL CHECK (scenario_type IN ('optimistic', 'realistic', 'pessimistic', 'custom'))
  - `base_period_start` TEXT NOT NULL (historical data range start)
  - `base_period_end` TEXT NOT NULL (historical data range end)
  - `forecast_months` INTEGER NOT NULL DEFAULT 12
  - `assumptions` TEXT NOT NULL (JSON: growth_rate, inflation, seasonal_factors, one_off_items)
  - `status` TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived'))
  - `created_at` TEXT DEFAULT (datetime('now'))
  - `updated_at` TEXT DEFAULT (datetime('now'))

- [ ] Create `forecast_periods` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `scenario_id` TEXT NOT NULL REFERENCES forecast_scenarios(id) ON DELETE CASCADE
  - `period` TEXT NOT NULL (e.g., '2025-07')
  - `category` TEXT NOT NULL
  - `forecast_amount` REAL NOT NULL
  - `confidence_lower` REAL (95% CI lower bound)
  - `confidence_upper` REAL (95% CI upper bound)
  - `method` TEXT NOT NULL (e.g., 'linear_trend', 'seasonal_decomposition', 'ai_forecast')
  - UNIQUE(scenario_id, period, category)

- [ ] Create `kpi_metrics` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `user_id` TEXT NOT NULL REFERENCES users(id)
  - `metric_name` TEXT NOT NULL (e.g., 'gross_margin', 'current_ratio', 'debt_to_equity', 'operating_cash_flow', 'revenue_growth', 'expense_ratio')
  - `metric_value` REAL NOT NULL
  - `period` TEXT NOT NULL (e.g., '2025-01')
  - `target_value` REAL (threshold for alerting)
  - `trend_direction` TEXT CHECK (trend_direction IN ('up', 'down', 'stable'))
  - `previous_value` REAL
  - `calculated_at` TEXT DEFAULT (datetime('now'))
  - INDEX on (user_id, metric_name, period)
  - UNIQUE(user_id, metric_name, period)

## Files to MODIFY

### 2. `server/src/schema.ts` (after line ~975, after `economicDataCache`)
- [ ] Add 8 new `sqliteTable` definitions matching the migration columns exactly
- [ ] Use `text()` for TEXT, `integer()` for INTEGER, `real()` for REAL, `integer({mode:'boolean'})` for BOOLEAN
- [ ] Add foreign key references: `reportTemplates.userId` -> `users.id`, `reportSnapshots.templateId` -> `reportTemplates.id`, `budgets.userId` -> `users.id`, `budgets.accountId` -> `accounts.id`, etc.
- [ ] Export all 8 tables: `reportTemplates`, `reportSnapshots`, `budgets`, `budgetLines`, `budgetVsActual`, `forecastScenarios`, `forecastPeriods`, `kpiMetrics`

### 3. `server/src/db/postgres-schema.ts`
- [ ] Add 8 matching `pgTable` definitions with PostgreSQL-specific types (`boolean()` instead of `integer({mode:'boolean'})`)
- [ ] Add indexes in the third argument of pgTable (like transactions at line 203-214)
- [ ] Export all 8 tables with identical names to schema.ts

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 8 new tables exported from both schema files
- [ ] Migration SQL is syntactically valid
- [ ] Foreign key references point to existing tables (users, accounts, report_templates, budgets, forecast_scenarios)
- [ ] Create marker file: `.agent-done-W13-01`

## Dependencies
- **None** -- can start immediately
- **Schema lock**: Only this agent may modify schema.ts and postgres-schema.ts during Wave 13
