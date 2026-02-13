# R01 — Codebase Architecture Report

**Agent**: R01 (Codebase Architecture Researcher)
**Date**: 2026-02-12
**Scope**: Complete inventory of GoldLedger agents, services, routes, schemas, and infrastructure

---

## 1. Agent System

### 1.1 Framework Architecture

The Claude agent system uses a generic `ClaudeAgent<TInput, TOutput>` abstract class (`server/src/services/claude/base-agent.ts`) with:

- **Agentic tool-use loop**: Messages → API call → tool execution → response, with budget enforcement
- **Per-tool circuit breaker**: 3 consecutive failures = skip tool
- **JSON output parsing**: Handles raw JSON, markdown-fenced JSON, and embedded JSON objects
- **Token tracking**: `TokenUsage { inputTokens, outputTokens, toolCalls }` per invocation
- **Retry with backoff**: Via `retryWithBackoff()` wrapper on every API call

The `AgentOrchestrator` (`orchestrator.ts`) is a singleton that:
- Registers all 11 agents at construction
- Provides typed `invoke<T>(agentType, input)` method
- Wraps calls with per-agent `AgentCircuitBreaker`
- Emits SSE progress events via `events.emit('update', ...)`
- Has a `processStatement()` pipeline: parser → categorizer → GST calculator
- Feature-gated by `USE_CLAUDE_AGENTS=true` env var

### 1.2 Agent Inventory

| Agent | AgentType Key | Model | Max Input | Max Output | Max Tools | Tools | Key Services Called |
|-------|--------------|-------|-----------|------------|-----------|-------|-------------------|
| **StatementParser** | `statement_parser` | Sonnet 4.5 | 100K | 8K | 10 | detect_bank, parse_with_bank_parser, extract_account_info, validate_transactions, search_cognee | parserRegistry, cogneeTools |
| **TransactionCategorizer** | `transaction_categorizer` | Haiku 4.5 | 50K | 8K | 5 | lookup_merchant_memory, search_similar_transactions, get_category_taxonomy, batch_categorize | cogneeTools, cogneeClient.storeMerchantMapping |
| **GSTCalculator** | `gst_calculator` | Sonnet 4.5 | 30K | 4K | 8 | classify_gst_supply, calculate_input_tax_credit, calculate_gst_from_inclusive, generate_bas_labels, identify_capital_purchases, get_quarter_dates, calculate_payg_withholding, lookup_gst_ruling | bas.ts (calculateGstFromInclusive, getQuarterDates), cogneeTools |
| **AccountReconciler** | `account_reconciler` | Haiku 4.5 | 50K | 4K | 8 | find_duplicates, verify_balance_continuity, find_unmatched, detect_transfers, check_running_balance, search_historical_patterns | TransferDetector, cogneeTools |
| **BudgetAnalyzer** | `budget_analyzer` | Sonnet 4.5 | 50K | 8K | 8 | analyze_spending_by_category, identify_recurring, calculate_monthly_averages, project_balance, find_anomalies, search_financial_context, calculate_savings_rate | cogneeTools |
| **CrossAccountTracer** | `cross_account_tracer` | Haiku 4.5 | 30K | 4K | 6 | match_transfers, detect_multi_hop, calculate_net_flows, generate_flow_diagram, exclude_transfers, search_transfer_patterns | TransferDetector, cogneeTools |
| **MerchantIntelligence** | `merchant_intelligence` | Haiku 4.5 | 50K | 8K | 15 | search_cognee_merchant, resolve_merchant_name, lookup_abn, infer_category, store_merchant_mapping, batch_resolve | cogneeTools (CHUNKS_LEXICAL) |
| **PayrollAgent** | `payroll_agent` | Sonnet 4.5 | 50K | 8K | 15 | detect_wage_payment, calculate_payg_withholding, search_payroll_history, store_payroll_pattern | bas.ts (grossFromNet), cogneeTools |
| **TaxStrategy** | `tax_strategy` | Sonnet 4.5 | 100K | 8K | 15 | analyze_entity_structure, calculate_tax_scenarios, search_tax_rulings, generate_strategies, search_financial_context | taxReturnService, taxOptimizerService, cogneeTools |
| **PersonalTaxClaims** | `personal_tax_claims` | Haiku 4.5 | 50K | 8K | 10 | scan_transactions_for_claims, check_substantiation, calculate_claim_amount, search_ato_rulings | tax-return.ts (DEDUCTION_RATES), cogneeTools |
| **FinancialPlanner** | `financial_planner` | Sonnet 4.5 | 50K | 8K | 12 | analyze_spending_patterns, project_wealth, compare_debt_strategies, generate_budget, search_financial_context | cogneeTools (RAG_COMPLETION) |

### 1.3 Model Distribution

- **Sonnet 4.5** (6 agents): statement_parser, gst_calculator, budget_analyzer, payroll_agent, tax_strategy, financial_planner
- **Haiku 4.5** (5 agents): transaction_categorizer, account_reconciler, cross_account_tracer, merchant_intelligence, personal_tax_claims
- Sonnet agents accept `CLAUDE_MODEL` env override; Haiku agents are hardcoded

### 1.4 Cognee Integration Pattern

All 11 agents use `cogneeTools` for knowledge graph access. The Cognee layer has 3 files:
- `cognee_client.ts` — HTTP client (SINGLE SOURCE OF TRUTH): auth, add, search, cognify, datasets
- `cognee-tools.ts` — Agent tool wrappers with batching and smart search type selection
- `rag.ts` — USE_COGNEE gate + indexing functions

Search types by use case:
- `CHUNKS` — fast vector similarity (tx matching, financial context)
- `CHUNKS_LEXICAL` — keyword search (merchants, payroll, ATO rulings)
- `GRAPH_COMPLETION` — LLM reasoning (tax rulings)
- `RAG_COMPLETION` — full RAG (financial planning advice)

---

## 2. Service Layer

### 2.1 Service File Inventory

| File | Purpose | Key Classes/Functions |
|------|---------|---------------------|
| `ai.ts` | Legacy AI service (OpenRouter/Google AI Studio) | `AIService` — parseWithVision(), parseWithText(), categorizeTransaction(), chat() |
| `ai-proxy.ts` | AI proxy for routing requests | Proxy layer |
| `accounts.ts` | Account CRUD operations | `accountService` |
| `agents.ts` | Agent routing/integration | Service-level agent helpers |
| `bas.ts` | BAS/GST calculations | `BASService`, `calculateGstFromInclusive()`, `getQuarterDates()`, `grossFromNet()` |
| `budget-enhanced.ts` | Enhanced budget analysis | Budget generation, projections |
| `cognee_client.ts` | Cognee REST API client | `CogneeClient` class (auth, add, search, cognify, storeMerchantMapping) |
| `economic-data.ts` | Economic data (RBA rates, CPI) | RBA/ABS data fetching |
| `email.ts` | Email service | Email sending |
| `enrichment.ts` | Transaction enrichment coordinator | `enrichmentService.enrichUncategorized()`, `enrichTransactions()` |
| `export.ts` | Data export (CSV, QIF, OFX) | Export generation |
| `feedback.ts` | User feedback handling | Feedback storage |
| `ledger.ts` | Double-entry ledger operations | `LedgerService` |
| `loan-calculator.ts` | Loan amortisation calculations | Home, car, personal loan calculators |
| `metrics.ts` | Parser metrics tracking | Metrics recording |
| `owner-equity.ts` | Owner equity event management | Contribution/drawing detection |
| `pipeline.ts` | Statement processing pipeline | Full PDF → parse → categorize → GST → enrichment pipeline |
| `queue.ts` | Batch upload queue | Job queue with state machine |
| `rag.ts` | RAG service (Cognee wrapper) | `ragService` — indexing with USE_COGNEE gate |
| `sbr-export.ts` | Standard Business Reporting export | SBR format generation |
| `stripe.ts` | Stripe integration | Payment processing |
| `tax.ts` | Basic tax calculations | Tax bracket computation |
| `tax-optimizer.ts` | Tax strategy optimization | `taxOptimizerService.generateStrategies()` |
| `tax-return.ts` | Tax return calculations | `taxReturnService` — sole trader, personal, company, trust, SMSF returns |
| `teams.ts` | Team management | Team CRUD |
| `vertex-ai.ts` | Vertex AI integration | Google Vertex AI client |

### 2.2 Subdirectory Services

| Directory | Files | Purpose |
|-----------|-------|---------|
| `claude/` | base-agent.ts, client.ts, config.ts, cognee-tools.ts, orchestrator.ts, retry.ts, types.ts, agents/ (11 files) | Claude agent framework |
| `cognee/` | \_\_init\_\_.py, cognee_service.py, models.py, seed.py | Python Cognee service (unused prototype) |
| `enrichment/` | index.ts, abn-lookup.ts, places-lookup.ts | 5-stage enrichment pipeline: ABN lookup (ABR API) + Google Places |
| `orchestrator/` | index.ts, orchestrator.ts, registry.ts, types.ts, cache.ts, health.ts, tracing.ts | Python agent orchestrator (unused prototype) |
| `parsers/` | base-parser.ts, detector.ts, index.ts, registry.ts, types.ts | Parser framework |
| `parsers/banks/` | cba.ts, anz.ts, westpac.ts, nab.ts, stgeorge.ts, bendigo.ts, ing.ts, macquarie.ts, index.ts | 8 bank-specific PDF parsers (only CBA is production-grade) |
| `parsers/formats/` | csv-parser.ts, ofx-parser.ts, qif-parser.ts | Format parsers (CSV, OFX, QIF) |
| `parsers/documents/` | credit-card/ (cba-credit.ts, base-credit-parser.ts) | Credit card statement parsers |
| `transfers/` | detector.ts, index.ts, persistence.ts | Transfer detection between accounts |
| `rag/` | namespace-manager.ts, chunking/, citations/, reranking/, search/ | RAG subsystem (chunking, search, reranking, citations) |

---

## 3. API Routes

### 3.1 Main Routes (index.ts — ~4680 lines, ~130 endpoints)

#### Authentication (3)
| Method | Path | Handler Summary |
|--------|------|----------------|
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | JWT login |
| GET | `/auth/me` | Get current user |

#### Core Resources (15)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/` | Health check (HTML) |
| GET | `/health` | JSON health check |
| GET | `/api/transactions` | List transactions (paginated, filtered) |
| PATCH | `/api/transactions/:id` | Update transaction |
| POST | `/api/transactions/:id/split` | Split transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/transactions/export` | Export transactions |
| GET | `/api/statements` | List statements |
| GET | `/api/settings` | Get user settings |
| PATCH | `/api/settings` | Update settings |
| GET | `/api/accounts` | List accounts |
| POST | `/api/accounts` | Create account |
| PATCH | `/api/accounts/:id` | Update account |
| GET | `/api/events` | SSE event stream |
| POST | `/api/chat` | AI chat endpoint |

#### Statement Upload & Batch (7)
| Method | Path | Handler Summary |
|--------|------|----------------|
| POST | `/api/statements/upload` | Upload single statement |
| POST | `/api/statements/batch` | Batch upload |
| GET | `/api/statements/batch/:jobId` | Batch job status |
| POST | `/api/statements/batch/:jobId/cancel` | Cancel batch job |
| POST | `/api/statements/batch/:jobId/retry` | Retry batch job |
| GET | `/api/queue/stats` | Queue statistics |
| POST | `/api/statements/:id/reprocess` | Reprocess statement |

#### Business Profile (4)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/business-profile` | Get business profile |
| POST | `/api/business-profile` | Create/update profile |
| POST | `/api/validate-abn` | Validate ABN |
| GET | `/api/business-profile/reference-data` | Reference data |

#### Categorization & Merchant Memory (6)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/pending-categorizations` | List pending categorizations |
| POST | `/api/pending-categorizations/:id/resolve` | Resolve categorization |
| GET | `/api/merchant-memory` | List merchant memory |
| PATCH | `/api/merchant-memory/:id` | Update merchant memory |
| DELETE | `/api/merchant-memory/:id` | Delete merchant memory |
| POST | `/api/transactions/categorize-gst` | Auto-categorize GST |

#### Transfers (7)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/transfers` | List transfer links |
| POST | `/api/transfers` | Create manual transfer link |
| DELETE | `/api/transfers/:id` | Delete transfer link |
| POST | `/api/transfers/auto-detect` | Auto-detect transfers |
| POST | `/api/transfers/bulk-link` | Bulk link transfers |
| GET | `/api/transfers/summary` | Transfer summary |
| GET | `/api/accounts/:id/balance-history` | Account balance history |

#### Reconciliation (2)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/reconciliation-alerts` | List alerts |
| POST | `/api/reconciliation-alerts/:id/resolve` | Resolve alert |

#### Credit Card & Debt (2)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/accounts/:id/credit-analytics` | Credit card analytics |
| POST | `/api/debt-recommendations` | Debt repayment recommendations |

#### Agent Endpoints (8)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/agents` | List agents |
| GET | `/api/agents/:type` | Get agent info |
| POST | `/api/agents/:type/run` | Run agent |
| POST | `/api/agents/code/execute` | Execute code agent |
| POST | `/api/agents/analyze-finances` | Financial analysis |
| POST | `/api/agents/calculate-bas` | BAS calculation |
| POST | `/api/agents/calculate-tax` | Tax calculation |
| POST | `/api/agents/reconcile` | Reconciliation |

#### BAS & GST (14)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/bas/quarters` | List BAS quarters |
| GET | `/api/bas/:quarter/calculate` | Calculate BAS for quarter |
| POST | `/api/bas/:quarter/save` | Save BAS calculation |
| GET | `/api/bas/history` | BAS history |
| GET | `/api/bas/tax-codes` | Tax codes |
| GET | `/api/gst/summary` | GST summary |
| GET | `/api/gst/review-queue` | GST review queue |
| POST | `/api/gst/classify/:id` | Classify transaction GST |
| POST | `/api/gst/bulk-approve` | Bulk approve GST |
| GET | `/api/gst/input-tax-credits` | Input tax credits |
| GET | `/api/bas/calculate` | BAS calculate (legacy) |
| PATCH | `/api/bas/:quarter/status` | Update BAS status |
| GET | `/api/bas/compare` | Compare BAS periods |
| GET | `/api/bas/:quarter/drill-down/:label` | Drill down BAS label |

#### Payroll (3)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/payroll/wages` | List wage payments |
| POST | `/api/payroll/upload-ledger` | Upload payroll ledger |
| PATCH | `/api/payroll/wages/:id` | Update wage payment |

#### Tax (20)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/tax/calculate/:year` | Calculate tax |
| GET | `/api/tax/brackets/:year` | Tax brackets |
| GET | `/api/tax/deductions/:year` | List deductions |
| POST | `/api/tax/deductions` | Add deduction |
| GET | `/api/tax/assets` | List CGT assets |
| POST | `/api/tax/assets` | Add CGT asset |
| GET | `/api/tax/cgt` | CGT summary |
| POST | `/api/tax/cgt/disposal` | Record CGT disposal |
| GET | `/api/tax/depreciation/assets` | Depreciable assets |
| POST | `/api/tax/depreciation/assets` | Add depreciable asset |
| GET | `/api/tax/depreciation/calculate/:assetId` | Calculate depreciation |
| GET | `/api/tax/summary/:year` | Tax year summary |
| GET | `/api/tax/return/sole-trader/:year` | Sole trader return |
| GET | `/api/tax/return/personal/:year` | Personal return |
| GET | `/api/tax/return/company/:year` | Company return |
| GET | `/api/tax/return/trust/:year` | Trust return |
| GET | `/api/tax/return/smsf/:year` | SMSF return |
| GET | `/api/tax/return/summary/:year` | Return summary |
| POST | `/api/tax/strategies/generate/:year` | Generate strategies |
| GET/PATCH | `/api/tax/strategies/:year`, `:id/status` | Manage strategies |

#### Owner Equity (4)
| Method | Path | Handler Summary |
|--------|------|----------------|
| POST | `/api/tax/equity/scan/:year` | Scan for equity events |
| GET | `/api/tax/equity/:year` | List equity events |
| PATCH | `/api/tax/equity/:id/confirm` | Confirm event |
| POST | `/api/tax/equity/event` | Create event |

#### Loans (5)
| Method | Path | Handler Summary |
|--------|------|----------------|
| POST | `/api/loans/calculate/home` | Home loan calc |
| POST | `/api/loans/calculate/car` | Car loan calc |
| POST | `/api/loans/calculate/personal` | Personal loan calc |
| POST | `/api/loans/refinance-savings` | Refinance comparison |
| POST | `/api/loans/borrowing-capacity` | Borrowing capacity |

#### Economic Data (3)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/economic/rates` | Interest rates |
| GET | `/api/economic/cpi` | CPI data |
| GET | `/api/economic/indicators` | Economic indicators |

#### Analytics (10)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/analytics/category-breakdown` | Category breakdown |
| GET | `/api/analytics/recurring-payments` | Recurring payments |
| GET | `/api/analytics/spending-trends` | Spending trends |
| GET | `/api/analytics/budget-vs-actual` | Budget vs actual |
| GET | `/api/analytics/budgets` | List budgets |
| POST | `/api/analytics/budgets` | Create budget |
| GET | `/api/analytics/anomalies` | Anomaly detection |
| POST | `/api/analytics/anomalies/:id/dismiss` | Dismiss anomaly |
| GET | `/api/analytics/cash-flow-forecast` | Cash flow forecast |
| POST | `/api/analytics/budget/generate` | Generate budget |

#### Advanced Analytics (4)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/analytics/bills` | Bill tracking |
| POST | `/api/analytics/projections/revenue` | Revenue projection |
| POST | `/api/analytics/projections/expenses` | Expense projection |
| POST | `/api/analytics/wealth-projection` | Wealth projection |
| POST | `/api/analytics/debt-strategies` | Debt strategies |

#### Banks & Consolidated (4)
| Method | Path | Handler Summary |
|--------|------|----------------|
| GET | `/api/banks` | Supported banks |
| POST | `/api/statements/detect-bank` | Detect bank from text |
| GET | `/api/accounts/consolidated` | Consolidated view |
| GET | `/api/reports/consolidated/:period` | Consolidated report |

#### Admin (2)
| Method | Path | Handler Summary |
|--------|------|----------------|
| POST | `/api/admin/ingest-knowledge` | Ingest knowledge to Cognee |
| GET | `/api/statements/gap-analysis` | Statement gap analysis |

### 3.2 Dedicated Route Files

| File | Mount Path | Endpoints |
|------|-----------|-----------|
| `routes/agents.ts` | `/api/agents/*` | POST /analyze, POST /bas/calculate, POST /reconcile, POST /transfers/analyze |
| `routes/pipeline.ts` | `/api/*` | POST /transfers/detect, POST /enrichment/run, POST /enrichment/batch, GET /bas/prefill, POST /enrichment/transaction/:id, GET /merchants, POST /merchants/batch-resolve |

---

## 4. Database Schema

### 4.1 SQLite Tables (schema.ts — used in development)

| # | Table Name | Key Columns | Domain |
|---|-----------|-------------|--------|
| 1 | `users` | id, username, passwordHash | Auth |
| 2 | `user_settings` | userId, modelParsingText/Vision/Categorization/Chat/Embedding | Auth |
| 3 | `accounts` | id, userId, accountNumber, accountName, accountType, bankName, ownershipTag | Accounts |
| 4 | `account_balance_history` | id, accountId, balance, balanceDate, source | Accounts |
| 5 | `statements` | id, filename, hash, parsingStatus, periodStart/End, openingBalance, closingBalance, validationErrors | Statements |
| 6 | `statement_accounts` | statementId, accountId | Statements |
| 7 | `transactions` | id, date, description, amount, balance, category, gstApplicable, gstAmount, gstCategory, isTransfer, isOwnerContribution, transactionHash, claimType/Amount/Method/substantiationStatus | Transactions |
| 8 | `transaction_history` | id, transactionId, changeType, oldData, newData | Audit |
| 9 | `transfer_links` | id, userId, sourceTransactionId, destinationTransactionId, amount, confidence | Transfers |
| 10 | `merchant_memory` | id, userId, merchantPattern, merchantDisplayName, category, gstApplicable, timesUsed | Categorization |
| 11 | `pending_categorization` | id, userId, transactionId, suggestedCategory, suggestedConfidence, status | Categorization |
| 12 | `reconciliation_alerts` | id, userId, accountId, alertType, expectedValue, actualValue | Reconciliation |
| 13 | `business_profiles` | id, userId, businessName, abn, entityType, gstRegistered | Business |
| 14 | `bas_periods` | id, userId, financialYear, quarter, startDate, endDate, status | BAS |
| 15 | `bas_calculations` | id, basPeriodId, labelG1-G11, label1A/1B, labelW1/W2, label5A/7C/7D | BAS |
| 16 | `tax_codes` | id, code, description, rate | Tax |
| 17 | `tax_brackets` | id, taxYear, minIncome, maxIncome, rate | Tax |
| 18 | `deductions` | id, userId, taxYear, category, description, amount | Tax |
| 19 | `cgt_assets` | id, userId, assetName, assetType, acquisitionDate/Cost | Tax |
| 20 | `cgt_events` | id, assetId, eventType, eventDate, capitalGainLoss | Tax |
| 21 | `depreciable_assets` | id, userId, assetName, purchaseCost, effectiveLife, depreciationMethod | Tax |
| 22 | `depreciation_schedule` | id, assetId, financialYear, openingValue, depreciationAmount | Tax |
| 23 | `tax_year_summary` | id, userId, taxYear, grossIncome, totalDeductions, taxableIncome, taxPayable | Tax |
| 24 | `audit_log` | id, userId, action, entityType, entityId, ipAddress, statusCode | Audit |
| 25 | `sessions` | id, userId, refreshTokenHash, expiresAt | Auth |
| 26 | `teams` | id, name, ownerId | Teams |
| 27 | `team_members` | id, teamId, userId, role | Teams |
| 28 | `team_invitations` | id, teamId, email, token, status | Teams |
| 29 | `subscriptions` | id, userId, stripeCustomerId, plan, status | Billing |
| 30 | `export_history` | id, userId, exportType, format, status | Export |
| 31 | `parser_metrics` | id, statementId, bankName, parserUsed, extractionTimeMs | Metrics |
| 32 | `parser_accuracy_aggregates` | id, bankName, parserVersion, totalStatements | Metrics |
| 33 | `parser_feedback` | id, userId, statementId, feedbackType, correctedValue | Feedback |
| 34 | `chart_of_accounts` | id, userId, code, name, type, taxCode, basLabel | Ledger |
| 35 | `journal_entries` | id, userId, entryDate, description, status | Ledger |
| 36 | `journal_entry_lines` | id, entryId, accountId, debit, credit | Ledger |
| 37 | `accounting_periods` | id, userId, name, startDate, endDate, status | Ledger |
| 38 | `account_balances` | id, chartAccountId, periodId, openingBalance, closingBalance | Ledger |
| 39 | `rag_namespaces` | id, userId, name, chunkCount, embeddingModel | RAG |
| 40 | `rag_chunks` | id, namespaceId, content, contentHash, embedding | RAG |
| 41 | `rag_documents` | id, namespaceId, title, sourceType, chunkCount | RAG |
| 42 | `rag_citations` | id, userId, queryId, chunkId, relevanceScore | RAG |
| 43 | `tax_offsets` | id, userId, taxYear, offsetType, amount | Tax |
| 44 | `capital_losses` | id, userId, taxYear, lossAmount, carriedForward | Tax |
| 45 | `upload_queue` | id, userId, batchId, filename, state, priority | Queue |
| 46 | `wage_payments` | id, userId, employeeName, grossWages, taxWithheld, netPay, superannuation | Payroll |
| 47 | `owner_equity_events` | id, userId, eventType, amount, financialYear | Equity |

**Total: 47 SQLite tables**

### 4.2 PostgreSQL Tables (postgres-schema.ts — used in production)

| # | Table Name | Key Differences from SQLite |
|---|-----------|---------------------------|
| 1 | `users` | `timestamp` instead of `text` for dates |
| 2 | `user_settings` | Same |
| 3 | `accounts` | `boolean` instead of `integer mode:boolean`, has `ownershipTag` column (**NOTE: missing in PG schema, present in SQLite**) |
| 4 | `account_balance_history` | `timestamp` dates, proper indexes |
| 5 | `statements` | `timestamp` dates, proper indexes |
| 6 | `statement_accounts` | Same |
| 7 | `transactions` | `boolean` types, proper indexes, has claimType/Amount/Method/substantiationStatus |
| 8 | `transaction_history` | `timestamp` types |
| 9 | `transfer_links` | `boolean`, `timestamp` |
| 10 | `user_categories` | **PG-ONLY** — not in SQLite schema |
| 11 | `merchant_memory` | `boolean`, `timestamp` |
| 12 | `pending_categorization` | `boolean`, `timestamp` |
| 13 | `reconciliation_alerts` | `boolean`, `timestamp` |
| 14 | `debt_payoff_scenarios` | **PG-ONLY** — not in SQLite schema |
| 15 | `wage_payments` | `boolean`, `timestamp` |
| 16 | `owner_equity_events` | `boolean`, `timestamp` |
| 17 | `tax_strategies` | **PG-ONLY** — not in SQLite schema |
| 18 | `loan_scenarios` | **PG-ONLY** — not in SQLite schema |
| 19 | `budget_templates` | **PG-ONLY** — not in SQLite schema |
| 20 | `economic_data_cache` | **PG-ONLY** — not in SQLite schema |

**Total: 20 PostgreSQL tables (defined in ORM)**

### 4.3 Schema Gap Analysis

#### Tables in SQLite but NOT in PostgreSQL ORM:
| Table | Domain | Notes |
|-------|--------|-------|
| `business_profiles` | Business | Created via SQL migration, not in PG Drizzle schema |
| `bas_periods` | BAS | Created via SQL migration |
| `bas_calculations` | BAS | Created via SQL migration |
| `tax_codes` | Tax | Created via SQL migration |
| `tax_brackets` | Tax | Created via SQL migration |
| `deductions` | Tax | Created via SQL migration |
| `cgt_assets` | Tax | Created via SQL migration |
| `cgt_events` | Tax | Created via SQL migration |
| `depreciable_assets` | Tax | Created via SQL migration |
| `depreciation_schedule` | Tax | Created via SQL migration |
| `tax_year_summary` | Tax | Created via SQL migration |
| `audit_log` | Audit | Created via SQL migration |
| `sessions` | Auth | Created via SQL migration |
| `teams` | Teams | Created via SQL migration |
| `team_members` | Teams | Created via SQL migration |
| `team_invitations` | Teams | Created via SQL migration |
| `subscriptions` | Billing | Created via SQL migration |
| `export_history` | Export | Created via SQL migration |
| `parser_metrics` | Metrics | Created via SQL migration |
| `parser_accuracy_aggregates` | Metrics | Created via SQL migration |
| `parser_feedback` | Feedback | Created via SQL migration |
| `chart_of_accounts` | Ledger | Created via SQL migration |
| `journal_entries` | Ledger | Created via SQL migration |
| `journal_entry_lines` | Ledger | Created via SQL migration |
| `accounting_periods` | Ledger | Created via SQL migration |
| `account_balances` | Ledger | Created via SQL migration |
| `rag_namespaces` | RAG | Created via SQL migration |
| `rag_chunks` | RAG | Created via SQL migration |
| `rag_documents` | RAG | Created via SQL migration |
| `rag_citations` | RAG | Created via SQL migration |
| `tax_offsets` | Tax | Created via SQL migration |
| `capital_losses` | Tax | Created via SQL migration |
| `upload_queue` | Queue | Created via SQL migration |

**Key insight**: The PG Drizzle schema only defines 20 tables. The remaining 27+ tables exist in PostgreSQL via SQL migration files (0006, 0007, 0009, 0010, 0011, 0012) but are NOT in the ORM.

#### Tables in PostgreSQL ORM but NOT in SQLite:
| Table | Domain |
|-------|--------|
| `user_categories` | Categorization |
| `debt_payoff_scenarios` | Debt |
| `tax_strategies` | Tax |
| `loan_scenarios` | Loans |
| `budget_templates` | Budgets |
| `economic_data_cache` | Economic Data |

#### Missing from accounts in PG ORM:
- `ownershipTag` column — present in SQLite, NOT in PG ORM (but added via migration 0008)

---

## 5. Infrastructure

### 5.1 Docker Services

| Service | Image | Port | Purpose | Dependencies |
|---------|-------|------|---------|-------------|
| **postgres** | pgvector/pgvector:pg17 | 5432 | PostgreSQL + pgvector | — |
| **redis** | redis:7-alpine | 6379 | Caching & rate limiting | — |
| **cognee** | Built from ./cognee-repo | 8000 | AI knowledge graph | postgres |
| **server** | Built from ./server | 3501 (internal) | Hono API server | postgres |
| **client** | Built from ./client | 8080→80 | React + nginx | server |

### 5.2 Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | postgres, server, cognee | Database credentials |
| `JWT_SECRET` | server | JWT signing |
| `VITE_OPENROUTER_API_KEY` | server, cognee | OpenRouter API (LLM + embeddings) |
| `ANTHROPIC_API_KEY` | server | Claude agents |
| `GOOGLE_AI_STUDIO_KEY` | server | Free Gemini access |
| `USE_CLAUDE_AGENTS` | server | Agent system feature flag (default: true) |
| `CLAUDE_MODEL` | server | Override Sonnet model |
| `USE_COGNEE` | server | Cognee feature flag (default: true) |
| `COGNEE_API_URL` | server | Cognee endpoint |
| `ABNLOOKUP_GUID` | server | ABR API GUID |
| `GOOGLE_API_KEY` | server | Google Places API |
| `REDIS_URL` | server | Redis connection |

### 5.3 Database Migrations

Executed in order via PostgreSQL entrypoint:
1. `01-cba-schema.sql` (0006_postgres_migration.sql) — Core 14 tables
2. `02-extensions.sql` (init-cognee-db.sql) — pgvector extension
3. `03-cognee-db.sh` (init-cognee-db.sh) — Create cognee_db database
4. `04-missing-tables.sql` (0007) — 31 additional tables
5. `05-account-ownership.sql` (0008) — ownershipTag, isOwnerContribution columns
6. `06-complete-schema.sql` (0009) — Schema sync
7. `07-add-missing-columns.sql` (0010) — Missing columns
8. `08-final-schema-sync.sql` (0011) — Final sync
9. `09-tax-return-platform.sql` (0012) — Tax return platform tables

### 5.4 Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `postgres-data` | /var/lib/postgresql/data | Persistent database |
| `cognee-data` | /app/.cognee_system | Cognee state |
| `redis-data` | /data | Redis persistence |
| `./statements` | /statements (server) | PDF statement files |

---

## 6. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React + nginx)                     │
│                        Port 8080                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │Dashboard │ │  Ledger  │ │BAS/GST   │ │  Tax     │ │ Chat   ││
│  │Analytics │ │Transact. │ │Dashboard │ │Dashboard │ │AI Chat ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘│
│  TanStack Table/Virtual, Tailwind CSS (neumorphic dark theme)    │
│  SSE real-time updates via SSEContext                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP/SSE (nginx proxy /api/)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Server (Hono + Node.js)                         │
│                    Port 3501                                       │
│                                                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                   ~130 API Routes                          │   │
│  │  /auth/*  /api/transactions/*  /api/statements/*           │   │
│  │  /api/bas/*  /api/gst/*  /api/tax/*  /api/agents/*         │   │
│  │  /api/analytics/*  /api/loans/*  /api/payroll/*            │   │
│  │  /api/transfers/*  /api/enrichment/*  /api/chat            │   │
│  └────────────────────────┬──────────────────────────────────┘   │
│                           │                                       │
│  ┌────────────────────────┼──────────────────────────────────┐   │
│  │              Service Layer                                 │   │
│  │                        │                                   │   │
│  │  ┌──────────┐  ┌──────┴──────┐  ┌──────────────────┐     │   │
│  │  │pipeline.ts│  │orchestrator │  │  ai.ts (Legacy)  │     │   │
│  │  │PDF→Parse →│  │             │  │  OpenRouter /     │     │   │
│  │  │Cat→GST→  │  │ 11 Claude   │  │  Google AI Studio│     │   │
│  │  │Enrich    │  │  Agents     │  │  (fallback)      │     │   │
│  │  └────┬─────┘  └──────┬──────┘  └─────────────────┘     │   │
│  │       │               │                                    │   │
│  │  ┌────┴──────┐  ┌─────┴────────────────────────────┐     │   │
│  │  │parsers/   │  │ Claude Agent Framework             │     │   │
│  │  │ 8 banks   │  │ base-agent.ts → ClaudeAgent<T,U>  │     │   │
│  │  │ 3 formats │  │ config.ts → budgets + models       │     │   │
│  │  │ credit-   │  │ retry.ts → backoff + circuit break │     │   │
│  │  │  card     │  │ cognee-tools.ts → Cognee wrappers  │     │   │
│  │  └───────────┘  │ agents/ (11 specialized agents)    │     │   │
│  │                  └──────────────────────────┬─────────┘     │   │
│  │                                             │               │   │
│  │  ┌──────────┐  ┌───────────┐  ┌────────────┴──────┐      │   │
│  │  │bas.ts    │  │tax-return │  │cognee_client.ts    │      │   │
│  │  │BASService│  │.ts        │  │ CogneeClient class │      │   │
│  │  │GST calc  │  │5 entity   │  │ search/add/cognify │      │   │
│  │  └──────────┘  │returns    │  └────────┬───────────┘      │   │
│  │                └───────────┘           │                   │   │
│  │  ┌──────────┐  ┌───────────┐          │                   │   │
│  │  │enrichment│  │transfers/ │          │                   │   │
│  │  │ABN+Places│  │detector   │          │                   │   │
│  │  └──────────┘  └───────────┘          │                   │   │
│  └───────────────────────────────────────┼───────────────────┘   │
└──────────────────────────────────────────┼───────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      ▼                      │
            ┌───────┴──────┐    ┌────────────────┐    ┌─────────┴───┐
            │  PostgreSQL   │    │     Cognee      │    │    Redis     │
            │  pgvector:17  │    │   Port 8000     │    │  Port 6379   │
            │  Port 5432    │    │                 │    │              │
            │               │    │ LLM: Gemini 3   │    │ Rate limit   │
            │ ai_accountant │    │ Embed: text-     │    │ Caching      │
            │ (47 tables)   │    │  embedding-3-    │    │              │
            │               │    │  small           │    │              │
            │ cognee_db     │    │ Vector: pgvector │    │              │
            │ (Cognee data) │    │ Graph: Kuzu      │    │              │
            └───────────────┘    └────────────────┘    └──────────────┘
```

---

## 7. Key Architectural Observations

### 7.1 Dual-Mode AI System
- **Primary**: Claude agents via Anthropic SDK (`USE_CLAUDE_AGENTS=true`)
- **Fallback**: OpenRouter → Gemini 3 Flash Preview via OpenAI SDK
- Circuit breaker on agent level: 5 failures = trip, 60s recovery

### 7.2 Schema Duality Problem
- SQLite schema defines ALL 47 tables via Drizzle `sqliteTable()`
- PostgreSQL Drizzle ORM only defines 20 tables
- Remaining 27 tables exist in PG only via SQL migration scripts
- `wrapPgDb()` returns `any` — all PG queries lose type safety at runtime

### 7.3 Parser Maturity
- CBA parser is production-grade
- Other 7 bank parsers (ANZ, Westpac, NAB, St George, Bendigo, ING, Macquarie) are scaffolds
- Credit card parsers exist but limited to CBA credit

### 7.4 Unused Systems
- Python agent orchestrator (`services/orchestrator/`) — unused prototype
- Python Cognee service (`services/cognee/`) — unused prototype
- These are documented with README files but not wired into the production system
