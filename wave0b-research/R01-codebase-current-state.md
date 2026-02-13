# R01: Codebase Current State — Post-Wave 17

**Researcher**: Agent R01
**Date**: 2026-02-13
**Scope**: Complete inventory of GoldLedger after Waves 11, 12, 14, 16, and 17 have executed.

---

## 1. Agent Inventory

### 1.1 Agent Files (21 total)

| # | File | Class | AgentType | Model | I/O Types |
|---|------|-------|-----------|-------|-----------|
| 1 | `statement-parser.ts` | `StatementParserAgent` | `statement_parser` | Sonnet 4.5 | `StatementParserInput` → `StatementParserOutput` |
| 2 | `transaction-categorizer.ts` | `TransactionCategorizerAgent` | `transaction_categorizer` | Haiku 4.5 | `CategorizerInput` → `CategorizerOutput` |
| 3 | `gst-calculator.ts` | `GSTCalculatorAgent` | `gst_calculator` | Sonnet 4.5 | `GSTCalculatorInput` → `GSTCalculatorOutput` |
| 4 | `account-reconciler.ts` | `AccountReconcilerAgent` | `account_reconciler` | Haiku 4.5 | `ReconcilerInput` → `ReconcilerOutput` |
| 5 | `budget-analyzer.ts` | `BudgetAnalyzerAgent` | `budget_analyzer` | Sonnet 4.5 | `BudgetAnalyzerInput` → `BudgetAnalyzerOutput` |
| 6 | `cross-account-tracer.ts` | `CrossAccountTracerAgent` | `cross_account_tracer` | Haiku 4.5 | `CrossAccountTracerInput` → `CrossAccountTracerOutput` |
| 7 | `merchant-intelligence.ts` | `MerchantIntelligenceAgent` | `merchant_intelligence` | Haiku 4.5 | `MerchantIntelligenceInput` → `MerchantIntelligenceOutput` |
| 8 | `payroll-agent.ts` | `PayrollAgent` | `payroll_agent` | Sonnet 4.5 | `PayrollAgentInput` → `PayrollAgentOutput` |
| 9 | `tax-strategy.ts` | `TaxStrategyAgent` | `tax_strategy` | Sonnet 4.5 | `TaxStrategyInput` → `TaxStrategyOutput` |
| 10 | `personal-tax-claims.ts` | `PersonalTaxClaimsAgent` | `personal_tax_claims` | Haiku 4.5 | `PersonalTaxClaimsInput` → `PersonalTaxClaimsOutput` |
| 11 | `financial-planner.ts` | `FinancialPlannerAgent` | `financial_planner` | Sonnet 4.5 | `FinancialPlannerInput` → `FinancialPlannerOutput` |
| 12 | `inventory-agent.ts` | `InventoryAgent` | `inventory_agent` | Haiku 4.5 | `InventoryAgentInput` → `InventoryAgentOutput` |
| 13 | `bank-reconciler-agent.ts` | `BankReconcilerAgent` | `bank_reconciler_agent` | Sonnet 4.5 | `BankReconAgentInput` → `BankReconAgentOutput` |
| 14 | `ocr-processing.ts` | `OCRProcessingAgent` | `ocr_processing` | Sonnet 4.5 | `OCRProcessingInput` → `OCRProcessingOutput` |
| 15 | `payment-matching.ts` | `PaymentMatchingAgent` | `payment_matching` | Haiku 4.5 | `PaymentMatchingInput` → `PaymentMatchingOutput` |
| 16 | `asset-management-agent.ts` | `AssetManagementAgent` | `asset_management` | Haiku 4.5 | `AssetManagementInput` → `AssetManagementOutput` |
| 17 | `multi-entity-agent.ts` | `MultiEntityAgent` | `multi_entity` | Sonnet 4.5 | `MultiEntityInput` → `MultiEntityOutput` |
| 18 | `financial-reporting.ts` | `FinancialReportingAgent` | `financial_reporting` | Sonnet 4.5 | `FinancialReportingInput` → `FinancialReportingOutput` |
| 19 | `budgeting.ts` | `BudgetingAgent` | `budgeting` | Sonnet 4.5 | `BudgetingInput` → `BudgetingOutput` |
| 20 | `forecasting-agent.ts` | `ForecastingAgent` | `forecasting` | Sonnet 4.5 | `ForecastingInput` → `ForecastingOutput` |
| 21 | `compliance-monitoring-agent.ts` | `ComplianceMonitoringAgent` | `compliance_monitoring` | Sonnet 4.5 | `ComplianceMonitoringInput` → `ComplianceMonitoringOutput` |

**Model Split**: 12 Sonnet 4.5, 9 Haiku 4.5

### 1.2 Agent Framework Files

| File | Purpose |
|------|---------|
| `base-agent.ts` | Abstract `ClaudeAgent<TInput, TOutput>` base class with tool-use loop, token tracking, budget enforcement |
| `orchestrator.ts` | `AgentOrchestrator` — central registry, `invoke()` with typed I/O, `processStatement()` pipeline, SSE progress |
| `config.ts` | Token budgets per agent, model selection, retry config, `isClaudeAgentsEnabled()` feature flag |
| `types.ts` | 21-member `AgentType` union, all I/O interfaces (21 pairs), `TokenBudget`, `RetryConfig`, `AgentProgressEvent` |
| `client.ts` | Anthropic SDK client singleton |
| `retry.ts` | `retryWithBackoff()` + `AgentCircuitBreaker` (5 failures = trip, 60s recovery) |
| `cognee-tools.ts` | Cognee-based tools shared across agents (search, DataPoints, temporal, cross-module) |

### 1.3 Orchestrator Registration

All 21 agents are registered in `orchestrator.ts` (lines 138-160) as `agentDefs` array. Each gets a circuit breaker instance. The `processStatement()` method chains: parser → categorizer → GST (non-blocking).

---

## 2. Schema State

### 2.1 SQLite Schema (`server/src/schema.ts`)

**Total Tables: 82**

| # | Table Name | Section |
|---|-----------|---------|
| 1 | `users` | Users & Auth |
| 2 | `user_settings` | Users & Auth |
| 3 | `accounts` | Accounts |
| 4 | `account_balance_history` | Accounts |
| 5 | `statements` | Statements |
| 6 | `statement_accounts` | Statements |
| 7 | `transactions` | Transactions |
| 8 | `transaction_history` | Transactions |
| 9 | `transfer_links` | Transfers |
| 10 | `merchant_memory` | Categorization |
| 11 | `pending_categorization` | Categorization |
| 12 | `reconciliation_alerts` | Reconciliation |
| 13 | `business_profiles` | Business |
| 14 | `bas_periods` | Tax & BAS |
| 15 | `bas_calculations` | Tax & BAS |
| 16 | `tax_codes` | Tax & BAS |
| 17 | `tax_brackets` | Tax & BAS |
| 18 | `deductions` | Tax & BAS |
| 19 | `cgt_assets` | Tax & BAS |
| 20 | `cgt_events` | Tax & BAS |
| 21 | `depreciable_assets` | Tax & BAS |
| 22 | `depreciation_schedule` | Tax & BAS |
| 23 | `tax_year_summary` | Tax & BAS |
| 24 | `audit_log` | Audit & Security |
| 25 | `sessions` | Audit & Security |
| 26 | `teams` | Teams & Subscriptions |
| 27 | `team_members` | Teams & Subscriptions |
| 28 | `team_invitations` | Teams & Subscriptions |
| 29 | `subscriptions` | Teams & Subscriptions |
| 30 | `export_history` | Exports & Reports |
| 31 | `parser_metrics` | Parser Metrics |
| 32 | `parser_accuracy_aggregates` | Parser Metrics |
| 33 | `parser_feedback` | Parser Metrics |
| 34 | `chart_of_accounts` | Ledger |
| 35 | `journal_entries` | Ledger |
| 36 | `journal_entry_lines` | Ledger |
| 37 | `accounting_periods` | Ledger |
| 38 | `account_balances` | Ledger |
| 39 | `rag_namespaces` | RAG & Knowledge |
| 40 | `rag_chunks` | RAG & Knowledge |
| 41 | `rag_documents` | RAG & Knowledge |
| 42 | `rag_citations` | RAG & Knowledge |
| 43 | `tax_offsets` | Tax Offsets |
| 44 | `capital_losses` | Capital Losses |
| 45 | `upload_queue` | Upload Queue |
| 46 | `wage_payments` | Payroll |
| 47 | `owner_equity_events` | Owner Equity |
| 48 | `tax_strategies` | Tax Strategies |
| 49 | `loan_scenarios` | Loans |
| 50 | `budget_templates` | Budget Templates |
| 51 | `economic_data_cache` | Economic Data |
| 52 | `inventory_items` | Inventory |
| 53 | `warehouses` | Inventory |
| 54 | `inventory_stock` | Inventory |
| 55 | `inventory_movements` | Inventory |
| 56 | `bank_recon_rules` | Bank Recon |
| 57 | `bank_recon_sessions` | Bank Recon |
| 58 | `bank_recon_matches` | Bank Recon |
| 59 | `entities` | Multi-Entity |
| 60 | `entity_accounts` | Multi-Entity |
| 61 | `entity_settings` | Multi-Entity |
| 62 | `fixed_assets` | Fixed Assets |
| 63 | `asset_depreciation` | Fixed Assets |
| 64 | `asset_disposals` | Fixed Assets |
| 65 | `inter_entity_transactions` | Multi-Entity |
| 66 | `consolidation_rules` | Consolidation |
| 67 | `consolidation_snapshots` | Consolidation |
| 68 | `consolidation_snapshot_lines` | Consolidation |
| 69 | `ocr_documents` | OCR/Documents |
| 70 | `ocr_line_items` | OCR/Documents |
| 71 | `payment_match_rules` | Payment Matching |
| 72 | `payment_matches` | Payment Matching |
| 73 | `document_queue` | Document Queue |
| 74 | `datapoint_configs` | Cognee DataPoints (W16) |
| 75 | `graph_schemas` | Cognee Graph (W16) |
| 76 | `cognee_feedback` | Cognee Feedback (W16) |
| 77 | `report_templates` | Financial Reports (W12?) |
| 78 | `report_snapshots` | Financial Reports |
| 79 | `budgets` | Budgets (W12?) |
| 80 | `budget_lines` | Budgets |
| 81 | `budget_vs_actual` | Budgets |
| 82 | `forecast_scenarios` | Forecasting (W17) |
| 83 | `forecast_periods` | Forecasting (W17) |
| 84 | `kpi_metrics` | KPIs (W17) |
| 85 | `temporal_queries` | Temporal Intelligence (W17) |
| 86 | `cross_module_insights` | Cross-Module Intelligence (W17) |
| 87 | `intelligence_subscriptions` | Intelligence Subscriptions (W17) |
| 88 | `module_connections` | Module Connections (W17) |

**CORRECTED Total: 88 SQLite tables**

### 2.2 PostgreSQL Schema (`server/src/db/postgres-schema.ts`)

**Total Tables: 57**

| # | Table Name | Present in SQLite? |
|---|-----------|-------------------|
| 1 | `users` | YES |
| 2 | `user_settings` | YES |
| 3 | `accounts` | YES |
| 4 | `account_balance_history` | YES |
| 5 | `statements` | YES |
| 6 | `statement_accounts` | YES |
| 7 | `transactions` | YES |
| 8 | `transaction_history` | YES |
| 9 | `transfer_links` | YES |
| 10 | `user_categories` | **POSTGRES-ONLY** |
| 11 | `merchant_memory` | YES |
| 12 | `pending_categorization` | YES |
| 13 | `reconciliation_alerts` | YES |
| 14 | `debt_payoff_scenarios` | **POSTGRES-ONLY** |
| 15 | `wage_payments` | YES |
| 16 | `owner_equity_events` | YES |
| 17 | `tax_strategies` | YES |
| 18 | `loan_scenarios` | YES |
| 19 | `budget_templates` | YES |
| 20 | `economic_data_cache` | YES |
| 21 | `inventory_items` | YES |
| 22 | `warehouses` | YES |
| 23 | `inventory_stock` | YES |
| 24 | `inventory_movements` | YES |
| 25 | `bank_recon_rules` | YES |
| 26 | `bank_recon_sessions` | YES |
| 27 | `bank_recon_matches` | YES |
| 28 | `entities` | YES |
| 29 | `entity_accounts` | YES |
| 30 | `entity_settings` | YES |
| 31 | `fixed_assets` | YES |
| 32 | `asset_depreciation` | YES |
| 33 | `asset_disposals` | YES |
| 34 | `inter_entity_transactions` | YES |
| 35 | `consolidation_rules` | YES |
| 36 | `consolidation_snapshots` | YES |
| 37 | `consolidation_snapshot_lines` | YES |
| 38 | `ocr_documents` | YES |
| 39 | `ocr_line_items` | YES |
| 40 | `payment_match_rules` | YES |
| 41 | `payment_matches` | YES |
| 42 | `document_queue` | YES |
| 43 | `datapoint_configs` | YES |
| 44 | `graph_schemas` | YES |
| 45 | `cognee_feedback` | YES |
| 46 | `report_templates` | YES |
| 47 | `report_snapshots` | YES |
| 48 | `budgets` | YES |
| 49 | `budget_lines` | YES |
| 50 | `budget_vs_actual` | YES |
| 51 | `forecast_scenarios` | YES |
| 52 | `forecast_periods` | YES |
| 53 | `kpi_metrics` | YES |
| 54 | `temporal_queries` | YES |
| 55 | `cross_module_insights` | YES |
| 56 | `intelligence_subscriptions` | YES |
| 57 | `module_connections` | YES |

### 2.3 Schema Gap Analysis: SQLite → PostgreSQL

**31 tables in SQLite but MISSING from postgres-schema.ts:**

| # | SQLite Table | Category |
|---|-------------|----------|
| 1 | `business_profiles` | Business |
| 2 | `bas_periods` | Tax & BAS |
| 3 | `bas_calculations` | Tax & BAS |
| 4 | `tax_codes` | Tax & BAS |
| 5 | `tax_brackets` | Tax & BAS |
| 6 | `deductions` | Tax & BAS |
| 7 | `cgt_assets` | Tax & BAS |
| 8 | `cgt_events` | Tax & BAS |
| 9 | `depreciable_assets` | Tax & BAS |
| 10 | `depreciation_schedule` | Tax & BAS |
| 11 | `tax_year_summary` | Tax & BAS |
| 12 | `audit_log` | Audit |
| 13 | `sessions` | Auth |
| 14 | `teams` | Teams |
| 15 | `team_members` | Teams |
| 16 | `team_invitations` | Teams |
| 17 | `subscriptions` | Subscriptions |
| 18 | `export_history` | Exports |
| 19 | `parser_metrics` | Parser |
| 20 | `parser_accuracy_aggregates` | Parser |
| 21 | `parser_feedback` | Parser |
| 22 | `chart_of_accounts` | Ledger |
| 23 | `journal_entries` | Ledger |
| 24 | `journal_entry_lines` | Ledger |
| 25 | `accounting_periods` | Ledger |
| 26 | `account_balances` | Ledger |
| 27 | `rag_namespaces` | RAG |
| 28 | `rag_chunks` | RAG |
| 29 | `rag_documents` | RAG |
| 30 | `rag_citations` | RAG |
| 31 | `tax_offsets` | Tax |
| 32 | `capital_losses` | Tax |
| 33 | `upload_queue` | Upload |

**CORRECTED: 33 tables missing from PostgreSQL schema**

**2 tables in PostgreSQL but NOT in SQLite:**
1. `user_categories` — custom category management
2. `debt_payoff_scenarios` — debt reduction planning

### 2.4 Migration Files (`docker/migrations/`)

| # | File | Purpose |
|---|------|---------|
| 1 | `0009_complete_schema.sql` | Core schema completion |
| 2 | `0010_add_missing_columns.sql` | Add missing columns |
| 3 | `0011_final_schema_sync.sql` | Final sync between SQLite ↔ PG |
| 4 | `0012_tax_return_platform.sql` | Tax return entity tables |
| 5 | `0023_inventory_bank_recon.sql` | Inventory + Bank Recon (Wave 11?) |
| 6 | `0024_fixed_assets_multi_entity.sql` | Fixed Assets + Multi-Entity (Wave 11?) |
| 7 | `0025_financial_reporting.sql` | Financial Reports (Wave 12?) |
| 8 | `0026_ai_ocr_payment_matching.sql` | OCR + Payment Matching (Wave 14) |
| 9 | `0028_cognee_datapoints.sql` | Cognee DataPoints + Graph (Wave 16) |
| 10 | `0029_temporal_intelligence.sql` | Temporal + Cross-Module (Wave 17) |

**Note**: Migration numbering has gaps (0013-0022 missing, 0027 missing). Docker-compose only mounts 0006-0012 via `initdb.d`; later migrations (0023-0029) are NOT wired into docker-compose.yml.

---

## 3. API Routes

### 3.1 Endpoint Count

**Total Endpoints: ~200** (counted from `app.get/post/put/patch/delete` calls in `server/src/index.ts` — 6,426 lines)

### 3.2 Route Files

| File | Purpose |
|------|---------|
| `server/src/routes/agents.ts` | Agent-related routes (possibly unused, endpoints inline in index.ts) |
| `server/src/routes/pipeline.ts` | Pipeline routes |

**Note**: Most routes are defined inline in `server/src/index.ts`, not in separate route files.

### 3.3 Endpoint Categories

| Category | Prefix | Approx Count |
|----------|--------|-------------|
| Auth | `/auth/*` | 3 |
| Health/Root | `/`, `/health` | 2 |
| Vertex AI | `/api/vertex-ai/*` | 2 |
| Transactions | `/api/transactions/*` | 5 |
| Statements | `/api/statements/*` | 8 |
| Batch | `/api/statements/batch/*` | 4 |
| Settings | `/api/settings` | 2 |
| Business Profile | `/api/business-profile/*` | 4 |
| Chat | `/api/chat` | 1 |
| Events (SSE) | `/api/events` | 1 |
| Accounts | `/api/accounts/*` | 5 |
| Pending Categorizations | `/api/pending-categorizations/*` | 2 |
| Merchant Memory | `/api/merchant-memory/*` | 3 |
| Transfers | `/api/transfers/*` | 6 |
| Balance History | `/api/accounts/:id/balance-history` | 1 |
| Reconciliation Alerts | `/api/reconciliation-alerts/*` | 2 |
| Credit Analytics | `/api/accounts/:id/credit-analytics` | 1 |
| Debt Recommendations | `/api/debt-recommendations` | 1 |
| Agents | `/api/agents/*` | 8 |
| BAS | `/api/bas/*` | 9 |
| GST | `/api/gst/*` | 5 |
| Payroll | `/api/payroll/*` | 3 |
| Tax | `/api/tax/*` | 19 |
| Banks | `/api/banks` | 2 |
| Consolidated | `/api/accounts/consolidated` | 1 |
| Reports (consolidated) | `/api/reports/consolidated/*` | 1 |
| Admin | `/api/admin/*` | 1 |
| Analytics | `/api/analytics/*` | 12 |
| Loans | `/api/loans/*` | 5 |
| Economic | `/api/economic/*` | 3 |
| Inventory | `/api/inventory/*` | 12 |
| Recon (Bank Reconciliation) | `/api/recon/*` | 10 |
| Assets (Fixed) | `/api/assets/*` | 8 |
| Entities (Multi-Entity) | `/api/entities/*` | 9 |
| Consolidation | `/api/consolidation/*` | 5 |
| Knowledge (Cognee) | `/api/knowledge/*` | 16 |
| Documents (OCR) | `/api/documents/*` | 8 |
| Matches (Payment) | `/api/matches/*` | 7 |
| Match Rules | `/api/match-rules/*` | 3 |
| Intelligence | `/api/intelligence/*` | 14 |
| Financial Reports | `/api/reports/*` | 7 |
| Budgets | `/api/budgets/*` | 7 |
| Forecasts | `/api/forecasts/*` | 5 |
| KPIs | `/api/kpis/*` | 2 |
| Queue | `/api/queue/*` | 1 |

---

## 4. Frontend State

### 4.1 Active Tabs (19 total)

| # | Tab ID | Component | Label in Nav |
|---|--------|-----------|-------------|
| 1 | `dashboard` | Inline dashboard (StatCards, Charts) | Home |
| 2 | `transactions` | `<LedgerPage>` | Ledger |
| 3 | `accounts` | `<AccountManager>` + Summary + Timeline | Vaults |
| 4 | `analytics` | `<AnalyticsDashboard>` | Insights |
| 5 | `gst` | `<GSTPage>` | (sidebar) |
| 6 | `bas` | `<BASPage>` | (sidebar) |
| 7 | `transfers` | `<TransfersPage>` | (sidebar) |
| 8 | `tax` | `<TaxDashboard>` | (sidebar) |
| 9 | `loans` | `<LoanDashboard>` | (sidebar) |
| 10 | `inventory` | `<InventoryDashboard>` | (sidebar) |
| 11 | `recon` | `<ReconDashboard>` | (sidebar) |
| 12 | `assets` | `<AssetsDashboard>` | (sidebar) |
| 13 | `entities` | `<EntitiesDashboard>` | (sidebar) |
| 14 | `knowledge` | `<KnowledgeDashboard>` | (sidebar) |
| 15 | `documents` | `<DocumentsDashboard>` | (sidebar) |
| 16 | `matching` | `<MatchingDashboard>` | (sidebar) |
| 17 | `intelligence` | `<IntelligenceDashboard>` | (sidebar) |
| 18 | `reports` | `<ReportsDashboard>` | (sidebar) |
| 19 | `budgets` | `<BudgetsDashboard>` | (sidebar) |

**Bottom Navigation (mobile)**: Only shows 4 tabs (Home, Ledger, Vaults, Insights) + center GoldLedger menu button. The remaining 15 tabs are accessible from the sidebar/desktop nav.

### 4.2 Feature Folders (24 total)

```
client/src/features/
├── accounts/          # Account management, summary cards, balance timeline
├── admin/             # Admin panel
├── analytics/         # Analytics dashboard, charts, bill alerts, projections
├── assets/            # Fixed assets dashboard
├── auth/              # Authentication (login/register)
├── bas/               # BAS calculations, comparison
├── budgets/           # Budget management dashboard
├── chat/              # FloatingChat AI assistant
├── documents/         # OCR document processing (Wave 14)
├── entities/          # Multi-entity management
├── gst/               # GST page
├── intelligence/      # Temporal + cross-module intelligence (Wave 17)
├── inventory/         # Inventory management
├── knowledge/         # Cognee knowledge graph (Wave 16)
├── loans/             # Loan calculator dashboard
├── matching/          # Payment matching (Wave 14)
├── onboarding/        # User onboarding
├── reconciliation/    # Bank reconciliation
├── reports/           # Financial reporting
├── settings/          # User settings modal
├── statements/        # Statement list & upload
├── tax/               # Tax dashboard, returns, strategies
├── transactions/      # Ledger, categories, merchant memory
└── transfers/         # Transfer detection & linking
```

### 4.3 API Client Methods (`client/src/api.ts`)

**Total Methods: ~32**

| Method | Endpoint |
|--------|----------|
| `fetchTransactions` | GET `/api/transactions` |
| `updateTransaction` | PATCH `/api/transactions/:id` |
| `splitTransaction` | POST `/api/transactions/:id/split` |
| `deleteTransaction` | DELETE `/api/transactions/:id` |
| `fetchStatements` | GET `/api/statements` |
| `sendChatMessage` | POST `/api/chat` |
| `calculateStats` | (client-side calculation) |
| `uploadStatement` | POST `/api/statements/upload` |
| `reprocessStatement` | POST `/api/statements/:id/reprocess` |
| `uploadBatch` | POST `/api/statements/batch` |
| `getBatchStatus` | GET `/api/statements/batch/:jobId` |
| `cancelBatch` | POST `/api/statements/batch/:jobId/cancel` |
| `retryBatch` | POST `/api/statements/batch/:jobId/retry` |
| `fetchStatementGapAnalysis` | GET `/api/statements/gap-analysis` |
| `login` | POST `/auth/login` |
| `register` | POST `/auth/register` |
| `fetchSettings` | GET `/api/settings` |
| `updateSettings` | PATCH `/api/settings` |
| `getCurrentUser` | GET `/auth/me` |
| `fetchAccounts` | GET `/api/accounts` |
| `createAccount` | POST `/api/accounts` |
| `updateAccount` | PATCH `/api/accounts/:id` |
| `fetchPendingCategorizations` | GET `/api/pending-categorizations` |
| `resolveCategorization` | POST `/api/pending-categorizations/:id/resolve` |
| `fetchMerchantMemory` | GET `/api/merchant-memory` |
| `updateMerchantMemory` | PATCH `/api/merchant-memory/:id` |
| `deleteMerchantMemory` | DELETE `/api/merchant-memory/:id` |
| `fetchTransfers` | GET `/api/transfers` |
| `createTransferLink` | POST `/api/transfers` |
| `deleteTransferLink` | DELETE `/api/transfers/:id` |
| `fetchBalanceHistory` | GET `/api/accounts/:id/balance-history` |
| `fetchReconciliationAlerts` | GET `/api/reconciliation-alerts` |
| `resolveReconciliationAlert` | POST `/api/reconciliation-alerts/:id/resolve` |
| `fetchCreditCardAnalytics` | GET `/api/accounts/:id/credit-analytics` |
| `fetchDebtRecommendations` | POST `/api/debt-recommendations` |

**CRITICAL NOTE**: The api.ts client only covers the ORIGINAL core endpoints. There are NO client-side API methods for:
- Inventory (12 endpoints)
- Bank Recon (10 endpoints)
- Fixed Assets (8 endpoints)
- Multi-Entity (9 endpoints)
- Consolidation (5 endpoints)
- Knowledge/Cognee (16 endpoints)
- Documents/OCR (8 endpoints)
- Payment Matching (10 endpoints)
- Intelligence (14 endpoints)
- Reports (7 endpoints)
- Budgets (7 endpoints)
- Forecasts (5 endpoints)
- KPIs (2 endpoints)

These feature dashboards likely use `fetch()` calls directly within their components rather than through the centralized `api.ts`.

---

## 5. Infrastructure

### 5.1 Docker Services (5)

| # | Service | Image/Build | Port | Purpose |
|---|---------|------------|------|---------|
| 1 | `postgres` | `pgvector/pgvector:pg17` | 5432 | Shared PostgreSQL (CBA + Cognee) |
| 2 | `redis` | `redis:7-alpine` | 6379 | Caching & rate-limiting (AOF, 256MB LRU) |
| 3 | `cognee` | Built from `./cognee-repo` | 8000 | AI Knowledge Graph |
| 4 | `server` | Built from `./server` | (internal 3501) | Hono API server |
| 5 | `client` | Built from `./client` | 8080 | React + nginx |

### 5.2 Docker Volumes

- `postgres-data` — PostgreSQL persistent storage
- `cognee-data` — Cognee system data
- `redis-data` — Redis AOF persistence

### 5.3 Migration Wiring Gap

Docker-compose only mounts migrations up to `0012`:
```yaml
- ./server/drizzle/0006_postgres_migration.sql:/docker-entrypoint-initdb.d/01-cba-schema.sql
- ./docker/init-cognee-db.sql:/docker-entrypoint-initdb.d/02-extensions.sql
- ./docker/init-cognee-db.sh:/docker-entrypoint-initdb.d/03-cognee-db.sh
- ./server/drizzle/0007_missing_tables.sql:/docker-entrypoint-initdb.d/04-missing-tables.sql
- ./server/drizzle/0008_account_ownership.sql:/docker-entrypoint-initdb.d/05-account-ownership.sql
- ./docker/migrations/0009_complete_schema.sql:/docker-entrypoint-initdb.d/06-complete-schema.sql
- ./docker/migrations/0010_add_missing_columns.sql:/docker-entrypoint-initdb.d/07-add-missing-columns.sql
- ./docker/migrations/0011_final_schema_sync.sql:/docker-entrypoint-initdb.d/08-final-schema-sync.sql
- ./docker/migrations/0012_tax_return_platform.sql:/docker-entrypoint-initdb.d/09-tax-return-platform.sql
```

**MISSING from docker-compose.yml** (not wired):
- `0023_inventory_bank_recon.sql`
- `0024_fixed_assets_multi_entity.sql`
- `0025_financial_reporting.sql`
- `0026_ai_ocr_payment_matching.sql`
- `0028_cognee_datapoints.sql`
- `0029_temporal_intelligence.sql`

These 6 migration files exist but are NOT mounted in Docker. Tables defined in these migrations will NOT exist in PostgreSQL until they are wired into docker-compose.yml.

### 5.4 Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `USE_CLAUDE_AGENTS=true` | Master switch for Claude agent system |
| `CLAUDE_MODEL` | Default Claude model (Sonnet 4.5) |
| `USE_COGNEE=true` | Enable Cognee knowledge graph |
| `COGNEE_API_URL` | Cognee service URL |
| `ANTHROPIC_API_KEY` | Claude API key |
| `VITE_OPENROUTER_API_KEY` | OpenRouter key (for Cognee + fallback) |
| `REDIS_URL` | Redis connection (Wave 17+) |
| `JWT_SECRET` | JWT signing secret |
| `DATABASE_URL` | PostgreSQL connection string |

---

## 6. Server Services Inventory

### 6.1 All Service Files (`server/src/services/`)

| # | File | Purpose | Wave Added |
|---|------|---------|------------|
| 1 | `ai.ts` | Legacy AI service (OpenRouter fallback) | Original |
| 2 | `ai-proxy.ts` | AI proxy routing | Original |
| 3 | `accounts.ts` | Account management | Original |
| 4 | `bas.ts` | BAS calculations | Original |
| 5 | `enrichment.ts` | Merchant enrichment | Audit |
| 6 | `export.ts` | Data export | Original |
| 7 | `feedback.ts` | User feedback | Original |
| 8 | `ledger.ts` | Double-entry ledger | Original |
| 9 | `metrics.ts` | Parser metrics | Original |
| 10 | `pipeline.ts` | Statement processing pipeline | Original |
| 11 | `queue.ts` | Upload/batch queue | Original |
| 12 | `rag.ts` | RAG/Cognee wrapper | Original |
| 13 | `tax.ts` | Tax calculations | Original |
| 14 | `email.ts` | Email service | Original |
| 15 | `stripe.ts` | Payment processing | Original |
| 16 | `teams.ts` | Team management | Original |
| 17 | `vertex-ai.ts` | Google Vertex AI | Original |
| 18 | `cognee_client.ts` | Cognee HTTP client (single source) | Audit fix |
| 19 | `enrichment/` | ABN lookup + Google Places | Audit fix |
| 20 | `inventory.ts` | Inventory management | Wave 11 |
| 21 | `bank-reconciliation.ts` | Bank reconciliation service | Wave 11 |
| 22 | `fixed-assets.ts` | Fixed asset tracking | Wave 11 |
| 23 | `multi-entity.ts` | Multi-entity management | Wave 11 |
| 24 | `consolidation.ts` | Entity consolidation | Wave 11 |
| 25 | `owner-equity.ts` | Owner equity tracking | Wave 11 |
| 26 | `financial-reports.ts` | Financial reporting | Wave 12 |
| 27 | `budgets.ts` | Budget management | Wave 12 |
| 28 | `budget-enhanced.ts` | Enhanced budgeting | Wave 12 |
| 29 | `forecasting.ts` | Financial forecasting | Wave 12 |
| 30 | `loan-calculator.ts` | Loan amortisation | Wave 12 |
| 31 | `economic-data.ts` | RBA/ABS/ATO data cache | Wave 12 |
| 32 | `tax-return.ts` | Tax return generation | Wave 12 |
| 33 | `tax-optimizer.ts` | Tax optimization strategies | Wave 12 |
| 34 | `sbr-export.ts` | Standard Business Reporting export | Wave 12 |
| 35 | `ocr-processing.ts` | OCR document processing | Wave 14 |
| 36 | `payment-matching.ts` | Payment matching service | Wave 14 |
| 37 | `cognee-datapoints.ts` | Cognee custom DataPoints | Wave 16 |
| 38 | `cognee-ontologies.ts` | Cognee ontology management | Wave 16 |
| 39 | `cognee-feedback.ts` | Cognee feedback loop | Wave 16 |
| 40 | `cognee-graph.ts` | Cognee graph exploration | Wave 16 |
| 41 | `temporal-cognify.ts` | Temporal queries (AU FY/BAS) | Wave 17 |
| 42 | `cross-module-intelligence.ts` | Cross-module insight scanning | Wave 17 |
| 43 | `cognee-sessions.ts` | Redis cache/sessions/rate-limit | Wave 17 |
| 44 | `intelligence-subscriptions.ts` | Intelligence event subscriptions | Wave 17 |

**Total: 44+ service files** (not counting test files, Python scripts, or the `claude/` and `cognee/` subdirectories)

---

## 7. Delta Summary: Pre-Wave-11 vs Current

### What Existed Before Waves 11-17 (Original + Audit)
- **11 agents**: parser, categorizer, GST, reconciler, budget, tracer, merchant, payroll, tax-strategy, personal-tax, financial-planner
- **~52 SQLite tables**, ~21 PostgreSQL tables
- **~80 API endpoints**
- **~14 feature folders**
- **4 Docker services** (postgres, cognee, server, client)

### What Waves 11-17 Added
| Area | Before | After | Delta |
|------|--------|-------|-------|
| Claude Agents | 11 | 21 | +10 |
| SQLite Tables | ~52 | 88 | +36 |
| PostgreSQL Tables | ~21 | 57 | +36 |
| API Endpoints | ~80 | ~200 | +120 |
| Feature Folders | ~14 | 24 | +10 |
| Frontend Tabs | ~8 | 19 | +11 |
| Docker Services | 4 | 5 | +1 (Redis) |
| Migration Files | 4 | 10 | +6 |
| Server Service Files | ~20 | 44+ | +24 |

### Agents Added by Wave
- **Wave 11**: inventory_agent, bank_reconciler_agent, asset_management, multi_entity
- **Wave 12**: financial_reporting, budgeting
- **Wave 14**: ocr_processing, payment_matching
- **Wave 17**: forecasting, compliance_monitoring

### Key Architectural Observations
1. **Monolithic index.ts**: All ~200 endpoints are in a single 6,426-line file — no route extraction
2. **Schema gap persists**: 33 SQLite tables have no PostgreSQL equivalent
3. **Migration wiring gap**: 6 migration files (0023-0029) exist but aren't mounted in docker-compose
4. **API client gap**: `client/src/api.ts` only covers ~32 original methods; new feature dashboards use direct fetch
5. **All 21 agents are registered**: Orchestrator has complete coverage
6. **No separate route files**: Only 2 files in `server/src/routes/` (agents.ts, pipeline.ts), rest is inline
