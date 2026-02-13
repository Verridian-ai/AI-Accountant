# R06 — Existing Plan Gap Analysis Report

**Agent**: R06 — Existing Plan Gap Analyzer
**Date**: 2026-02-12
**Source**: `docs/Agent planning chat.md` (1318 lines)

---

## 1. Completeness Matrix

The planning document defines **17 waves** across **6 phases**. Each wave is evaluated against the 10 required spec points from the original prompt.

### Legend
- ✅ = Fully specified
- ⚠️ = Partially specified (missing detail)
- ❌ = Missing entirely

| Wave | Name | Dependencies | Agent Team (10) | DB Schema | API Endpoints | UI Components | Cognee | Testing | Migration Path | New Claude Agents | Phase |
|------|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Chat→Agent Bridge & Intent Routing | ✅ | ✅ (10) | ✅ (31 PG sync) | ✅ (9 endpoints) | ✅ (3 components) | ✅ | ✅ | ✅ `0013` | ❌ (0 new, extends existing) | ✅ P1 |
| 2 | Transaction Mutation & Streaming | ✅ | ✅ (10) | ✅ (3 tables) | ✅ (6 endpoints) | ✅ (4 components) | ✅ | ✅ | ✅ `0014` | ❌ (0 new) | ✅ P1 |
| 3 | Multi-User Cognee & Custom DataPoints | ✅ | ✅ (10) | ✅ (2 tables) | ✅ (4 endpoints) | ❌ (no UI spec) | ✅ | ✅ | ✅ `0015` | ❌ (0 new) | ✅ P1 |
| 4 | Employee Management & Pay Structures | ✅ | ✅ (10) | ✅ (7 tables) | ✅ (15 endpoints) | ✅ (6 components) | ✅ | ✅ | ✅ `0016` | ⚠️ (extends payroll_agent) | ✅ P2 |
| 5 | Pay Run Processing & Leave Management | ✅ | ✅ (10) | ✅ (7 tables) | ✅ (16 endpoints) | ✅ (6 components) | ✅ | ✅ | ✅ `0017` | ❌ (0 new) | ✅ P2 |
| 6 | STP Compliance & Payroll Reporting | ✅ | ✅ (10) | ✅ (7 tables) | ✅ (17 endpoints) | ✅ (7 components) | ✅ | ✅ | ✅ `0018` | ❌ (0 new, but STP engine) | ✅ P2 |
| 7 | Customer Management & Invoice Generation | ✅ | ✅ (10) | ✅ (6 tables) | ✅ (17 endpoints) | ✅ (8 components) | ✅ | ✅ | ✅ `0019` | ✅ `invoice_agent` | ✅ P3 |
| 8 | Recurring Invoices & Payment Processing | ✅ | ✅ (10) | ✅ (5 tables) | ✅ (12 endpoints) | ✅ (5 components) | ✅ | ✅ | ✅ `0020` | ❌ (0 new) | ✅ P3 |
| 9 | AR Aging & Multi-Currency | ✅ | ✅ (10) | ✅ (4 tables) | ✅ (12 endpoints) | ✅ (7 components) | ✅ | ✅ | ✅ `0021` | ❌ (0 new) | ✅ P3 |
| 10 | Accounts Payable & Purchase Orders | ✅ | ✅ (10) | ✅ (10 tables) | ⚠️ ("20+ endpoints" not listed) | ✅ (11 components) | ✅ | ✅ | ✅ `0022` | ✅ `accounts_payable_agent` | ✅ P4 |
| **11** | **Inventory & Bank Reconciliation** | ✅ | ✅ (10) | ⚠️ (7 tables, CUT OFF) | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ (2 named, no spec) | ✅ P4 |
| **12** | **Fixed Assets & Multi-Entity** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **13** | **Financial Reporting & Budgeting** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **14** | **AI OCR & Payment Matching** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **15** | **Predictive Analytics & Compliance** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **16** | **Custom DataPoints & Relationships** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **17** | **Temporal Queries & Cross-Module Intelligence** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Summary
- **Waves 1–10**: Fully specified (with minor gaps noted below)
- **Wave 11**: Partially specified — **CUT OFF mid-stream** at line 1314
- **Waves 12–17**: Completely unspecified (only names exist in dependency graph)
- **Total coverage**: 10.5 / 17 waves = **62% complete**

---

## 2. Wave 11 Gap Detail

### What EXISTS (lines 1288–1314)
- ✅ Wave number, name, dependencies, complexity
- ✅ Agent team composition (all 10 agents)
- ✅ Database schema — 7 tables partially defined:
  - `inventory_items` — full column spec
  - `inventory_stock` — full column spec
  - `inventory_movements` — full column spec
  - `warehouses` — full column spec
  - `bank_recon_rules` — full column spec
  - `bank_recon_sessions` — full column spec
  - `bank_recon_matches` — **CUT OFF** mid-definition (only has `id, sessionId, transactionId, matchedEntityType`)
- ⚠️ Two new Claude agents NAMED but not specified: `inventory_agent`, `bank_reconciler_agent`

### What's MISSING from Wave 11
- ❌ Migration file path
- ❌ API Endpoints
- ❌ UI Components
- ❌ Cognee Integration
- ❌ Testing Criteria
- ❌ Remaining columns of `bank_recon_matches` table

### Drafted Content for Missing Wave 11 Sections

```markdown
#### bank_recon_matches (completed)
bank_recon_matches: id, sessionId, transactionId, matchedEntityType (invoice/bill/transfer/manual),
  matchedEntityId, confidence, matchMethod (auto/suggested/manual), createdAt

#### Migration
Migration: docker/migrations/0023_inventory_bank_recon.sql

#### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/inventory/items | List inventory items |
| POST   | /api/inventory/items | Create item |
| GET    | /api/inventory/items/:id | Get item detail |
| PATCH  | /api/inventory/items/:id | Update item |
| GET    | /api/inventory/stock | Stock levels summary |
| GET    | /api/inventory/stock/:itemId | Stock for item |
| POST   | /api/inventory/stock/adjust | Stock adjustment |
| GET    | /api/inventory/movements/:itemId | Movement history |
| GET    | /api/inventory/warehouses | List warehouses |
| POST   | /api/inventory/warehouses | Create warehouse |
| POST   | /api/inventory/stock/transfer | Warehouse transfer |
| GET    | /api/inventory/valuation | COGS/inventory valuation report |
| GET    | /api/recon/sessions | List recon sessions |
| POST   | /api/recon/sessions | Start recon session |
| GET    | /api/recon/sessions/:id | Get session detail |
| POST   | /api/recon/sessions/:id/auto-match | Run auto-matching |
| POST   | /api/recon/sessions/:id/match | Confirm match |
| POST   | /api/recon/sessions/:id/unmatch | Undo match |
| POST   | /api/recon/sessions/:id/complete | Complete session |
| GET    | /api/recon/rules | List matching rules |
| POST   | /api/recon/rules | Create matching rule |
| PATCH  | /api/recon/rules/:id | Update rule |

#### UI Components
client/src/features/inventory/ — New feature folder
- InventoryDashboard.tsx — Main inventory hub with tabs
- ItemList.tsx — Searchable item catalog with stock levels
- ItemDetail.tsx — Item profile with movement history
- ItemForm.tsx — Create/edit inventory item
- StockAdjustment.tsx — Manual stock adjustments
- WarehouseManager.tsx — Warehouse configuration
- InventoryValuation.tsx — COGS and valuation report

client/src/features/reconciliation/ — New feature folder
- ReconciliationWorkspace.tsx — Side-by-side bank statement vs ledger
- ReconciliationSession.tsx — Session management
- MatchSuggestions.tsx — AI-suggested matches with confidence
- ReconciliationRules.tsx — Auto-matching rule configuration
- ReconciliationSummary.tsx — Session completion summary

Add inventory to TabId type in BottomNavigation.tsx

#### Cognee Integration
- New datasets: inventory_catalog, stock_movements, recon_patterns
- Index items for "What's my stock level for Widget X?"
- Index movements for COGS calculation queries
- Index recon patterns for "Which transactions don't match?"
- Use GRAPH_COMPLETION for multi-entity matching reasoning

#### Testing Criteria
- Item CRUD lifecycle with stock tracking
- Stock adjustment updates quantity on hand
- COGS calculated using weighted average method
- Warehouse transfer decrements source, increments destination
- Auto-match identifies exact amount + date matches
- Suggested matches have confidence > 70%
- Manual match overrides auto-match
- Recon session tracks matched vs unmatched counts
- Chat can answer "What's my inventory value?" via inventory agent
- Chat can answer "Start reconciliation for account X" via recon agent
```

---

## 3. Dependency Graph

### Linear Chain (from planning doc)
```
Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5 → Wave 6 → Wave 7 → Wave 8 → Wave 9 → Wave 10 → Wave 11 → Wave 12 → Wave 13 → Wave 14 → Wave 15 → Wave 16 → Wave 17
```

### Phase Groupings
```
Phase 1 (Existing Roadmap): Waves 1, 2, 3
Phase 2 (Payroll):          Waves 4, 5, 6
Phase 3 (Invoicing/AR):     Waves 7, 8, 9
Phase 4 (Xero/MYOB Parity): Waves 10, 11, 12, 13
Phase 5 (Agentic Layer):    Waves 14, 15
Phase 6 (Cognee Graph):     Waves 16, 17
```

### Dependency Analysis

**Issues identified:**

1. **Strictly linear chain is over-conservative.** Phases 2 (Payroll) and Phase 3 (Invoicing) are functionally independent. Wave 7 (Customers/Invoices) does NOT depend on Wave 6 (STP/Payroll Reporting) — they share no schema or code. They could be parallelized.

2. **Phase 5 (Agentic) could partially overlap with Phase 4.** Wave 14 (AI OCR) only requires Wave 7 (invoices exist) and Wave 10 (bills exist). It doesn't need Wave 12 or 13.

3. **Phase 6 (Cognee Graph) could begin after Wave 3.** Wave 16 (Custom DataPoints) is a Cognee-level concern that needs Wave 3's multi-user isolation but not Waves 4–15.

4. **No circular dependencies** — the strictly linear chain prevents cycles by definition, but at the cost of artificial serialization.

### Recommended Optimized Dependency Graph
```
Wave 1 → Wave 2 → Wave 3 ─┬→ Wave 4 → Wave 5 → Wave 6 ─────────┬→ Wave 13 → Wave 14 → Wave 15
                            ├→ Wave 7 → Wave 8 → Wave 9 ─────────┤
                            ├→ Wave 10 → Wave 11 → Wave 12 ──────┘
                            └→ Wave 16 → Wave 17
```
This would allow P2/P3/P4 to run in parallel after Wave 3, potentially halving total execution time.

---

## 4. Agent Projection

### New Claude Agents in Waves 1–10

| Wave | New Agent | Description |
|------|-----------|-------------|
| 1–3  | 0 | No new agents; extends existing 11 |
| 4    | 0 | Extends existing `payroll_agent` |
| 5    | 0 | Extends payroll engine (not a Claude agent) |
| 6    | 0 | STP engine is a service, not agent |
| 7    | 1 | `invoice_agent` — new Claude agent |
| 8    | 0 | Extends invoice/payment services |
| 9    | 0 | AR aging is a service |
| 10   | 1 | `accounts_payable_agent` — new Claude agent |
| **Total (1–10)** | **2** | |

### Named in Wave 11 (partial)
- `inventory_agent` — new Claude agent
- `bank_reconciler_agent` — enhanced (already exists as `account_reconciler`)

### Projected for Waves 12–17

Based on patterns from earlier waves:

| Wave | Projected Agents | Rationale |
|------|-----------------|-----------|
| 12 | `asset_management_agent`, `multi_entity_agent` | Fixed assets + multi-company routing |
| 13 | `financial_reporting_agent`, `budgeting_agent` | New reporting domain |
| 14 | `ocr_agent`, `payment_matching_agent` | AI-specific agents |
| 15 | `compliance_agent`, `forecasting_agent` | Predictive + compliance |
| 16 | 0 | Cognee DataPoint work, no new agents |
| 17 | 0 | Cognee query layer, no new agents |
| **Total projected (12–17)** | **~6** | |

### Grand Total Agent Projection
| Source | Count |
|--------|-------|
| Existing agents | 11 |
| Waves 1–10 (planned) | 2 |
| Wave 11 (partial) | 2 |
| Waves 12–17 (projected) | ~6 |
| **Total** | **~21** |

The planning doc's executive summary claimed ~14 new agents (total ~25). Our analysis shows the plan actually specifies **only 4 new agents** (Waves 7, 10, 11). The remaining ~10 are unspecified in Waves 12–17.

---

## 5. Database Projection

### Current State
| Schema | Table Count |
|--------|-------------|
| SQLite (`schema.ts`) | 51 tables |
| PostgreSQL (`postgres-schema.ts`) | 20 tables |
| **Gap** | **31 tables** |

### New Tables by Wave (from plan)

| Wave | New Tables | Running Total (new) |
|------|-----------|-------------------|
| 1 | 0 (31 PG sync only) | 0 |
| 2 | 3 (agent_mutations, agent_sessions, agent_audit_log) | 3 |
| 3 | 2 (cognee_user_accounts, cognee_sessions) | 5 |
| 4 | 7 (employees, employee_bank_details, employee_super_funds, employee_tax_declarations, pay_categories, pay_structures, employee_documents) | 12 |
| 5 | 7 (pay_runs, pay_run_lines, pay_run_summary, leave_types, leave_balances, leave_requests, leave_transactions) | 19 |
| 6 | 7 (stp_events, stp_employee_ytd, payslips, awards, award_rates, timesheets, timesheet_entries) | 26 |
| 7 | 6 (customers, customer_contacts, invoices, invoice_lines, invoice_number_sequences, invoice_payments) | 32 |
| 8 | 5 (recurring_invoices, payment_gateways, dunning_sequences, dunning_history, customer_subscriptions) | 37 |
| 9 | 4 (currencies, exchange_rates, invoice_templates, customer_statements) | 41 |
| 10 | 10 (suppliers, bills, bill_lines, bill_payments, purchase_orders, po_lines, po_receipts, po_receipt_lines, supplier_payment_runs, supplier_payment_run_items) | 51 |
| 11 | 7 (inventory_items, inventory_stock, inventory_movements, warehouses, bank_recon_rules, bank_recon_sessions, bank_recon_matches) | 58 |
| **Waves 1–11** | **58 new** | |

### Projected for Waves 12–17

| Wave | Estimated Tables | Description |
|------|-----------------|-------------|
| 12 | ~10 | fixed_assets, asset_depreciation, asset_disposals, entities, entity_settings, inter_entity_transactions, consolidation_rules, etc. |
| 13 | ~8 | report_templates, report_snapshots, budgets, budget_lines, budget_vs_actual, forecast_scenarios, forecast_periods, kpi_metrics |
| 14 | ~5 | ocr_documents, ocr_results, payment_match_rules, payment_match_history, document_queue |
| 15 | ~4 | compliance_checks, compliance_schedules, cash_flow_forecasts, anomaly_alerts |
| 16 | ~2 | datapoint_configs, graph_schemas |
| 17 | ~2 | temporal_queries, cross_module_insights |
| **Total projected (12–17)** | **~31** | |

### Grand Total
| Category | Tables |
|----------|--------|
| Current SQLite | 51 |
| Current PostgreSQL | 20 (31 gap) |
| New planned (Waves 1–11) | 58 |
| New projected (Waves 12–17) | ~31 |
| **Final SQLite target** | **~140** |
| **Final PostgreSQL target** | **~140** |

The executive summary claimed "~65+ new tables." Our count shows **58 specified + ~31 projected = ~89 new tables**, significantly more than the summary suggested.

---

## 6. Migration Numbering

### Existing Migrations
| File | Description |
|------|-------------|
| `0009_complete_schema.sql` | Initial complete schema |
| `0010_add_missing_columns.sql` | Column additions |
| `0011_final_schema_sync.sql` | Schema synchronization |
| `0012_tax_return_platform.sql` | Tax return tables |

### Planned Migrations (from plan)
| File | Wave | Description |
|------|------|-------------|
| `0013_postgres_schema_sync.sql` | 1 | 31 missing PG tables |
| `0014_agent_mutations.sql` | 2 | Agent mutation/session/audit tables |
| `0015_cognee_multi_user.sql` | 3 | Cognee user account mapping |
| `0016_employee_management.sql` | 4 | Employee/pay structure tables |
| `0017_pay_runs_leave.sql` | 5 | Pay run and leave tables |
| `0018_stp_payslips_timesheets.sql` | 6 | STP, payslips, awards, timesheets |
| `0019_customers_invoices.sql` | 7 | Customer and invoice tables |
| `0020_recurring_payments.sql` | 8 | Recurring invoices, payments, dunning |
| `0021_ar_multicurrency.sql` | 9 | AR aging, currencies, templates |
| `0022_ap_purchase_orders.sql` | 10 | AP, suppliers, bills, POs |
| `0023_inventory_bank_recon.sql` | 11 | *Projected* — not in plan (CUT OFF) |

### Missing Migration Numbers (Waves 12–17)
| Projected File | Wave |
|----------------|------|
| `0024_fixed_assets_multi_entity.sql` | 12 |
| `0025_financial_reporting_budgets.sql` | 13 |
| `0026_ai_ocr_payment_matching.sql` | 14 |
| `0027_predictive_compliance.sql` | 15 |
| `0028_cognee_datapoints.sql` | 16 |
| `0029_temporal_cross_module.sql` | 17 |

---

## 7. Recommendations

### Critical Gaps to Fill

1. **Complete Wave 11** — The connection loss at line 1314 leaves Wave 11 missing 5 of 10 spec points. The drafted content in Section 2 above provides a ready-to-use template.

2. **Specify Waves 12–17** — Six full waves are completely unspecified. Each needs all 10 spec points. These represent **35% of the total plan**.

3. **Correct Executive Summary Numbers**:
   - Claimed ~14 new agents → actually 4 specified + ~8 projected = ~12
   - Claimed ~65+ new tables → actually 58 specified + ~31 projected = ~89
   - Claimed ~200+ API endpoints → Waves 1-10 specify ~128 endpoints; Waves 11-17 need ~72+ more

4. **Reconsider Linear Dependencies** — The strictly serial chain (1→2→...→17) artificially extends the timeline. Phases 2, 3, and parts of 4 can run in parallel after Wave 3. This could reduce total execution from ~51–68 hours to ~30–40 hours.

5. **Wave 10 API Gap** — Wave 10 says "20+ endpoints" without listing them. All other waves provide explicit endpoint tables. This should be expanded.

6. **Wave 3 UI Gap** — Wave 3 (Multi-User Cognee) lists no UI components. While this is primarily backend work, at minimum a Cognee admin panel or session status indicator should be specified.

### Structural Issues

7. **Dual Schema Maintenance** — Every new table must be added to BOTH `schema.ts` (SQLite) and `postgres-schema.ts` (PostgreSQL). The plan mentions this for Wave 1 (31 sync) but doesn't explicitly state it for Waves 2–17. Each wave should include a "Schema Verifier" agent step.

8. **Missing Error Handling Specs** — No wave includes error handling specifications (rate limiting on new endpoints, validation schemas, rollback procedures).

9. **Missing Security Specs** — Payroll data (TFNs, bank details) requires encryption at rest. Wave 4 mentions this in testing criteria but not in implementation spec.

10. **Cognee Dataset Proliferation** — By Wave 17, there will be ~30+ Cognee datasets. No consolidation or namespace strategy is specified.

### Priority Order for Gap Filling

| Priority | Action | Impact |
|----------|--------|--------|
| P0 | Complete Wave 11 (5 missing sections) | Unblocks Phase 4 planning |
| P0 | Draft Waves 12–13 (remaining Phase 4) | Completes Xero/MYOB parity spec |
| P1 | Draft Waves 14–15 (Phase 5: Agentic) | AI integration layer |
| P1 | Draft Waves 16–17 (Phase 6: Cognee) | Knowledge graph enhancement |
| P2 | Expand Wave 10 API endpoints | Completeness |
| P2 | Add Wave 3 UI components | Completeness |
| P3 | Correct executive summary numbers | Accuracy |
| P3 | Optimize dependency graph | Timeline reduction |

---

## Appendix: Cross-Reference Data

### Existing Claude Agents (11)
1. `statement_parser`
2. `transaction_categorizer`
3. `gst_calculator`
4. `merchant_intelligence`
5. `budget_analyzer`
6. `account_reconciler`
7. `cross_account_tracer`
8. `payroll_agent`
9. `tax_strategy`
10. `personal_tax_claims`
11. `financial_planner`

### Existing SQLite Tables (51)
users, user_settings, accounts, account_balance_history, statements, statement_accounts, transactions, transaction_history, transfer_links, merchant_memory, pending_categorization, reconciliation_alerts, business_profiles, bas_periods, bas_calculations, tax_codes, tax_brackets, deductions, cgt_assets, cgt_events, depreciable_assets, depreciation_schedule, tax_year_summary, audit_log, sessions, teams, team_members, team_invitations, subscriptions, export_history, parser_metrics, parser_accuracy_aggregates, parser_feedback, chart_of_accounts, journal_entries, journal_entry_lines, accounting_periods, account_balances, rag_namespaces, rag_chunks, rag_documents, rag_citations, tax_offsets, capital_losses, upload_queue, wage_payments, owner_equity_events, tax_strategies, loan_scenarios, budget_templates, economic_data_cache

### Existing PostgreSQL Tables (20)
users, user_settings, accounts, account_balance_history, statements, statement_accounts, transactions, transaction_history, transfer_links, merchant_memory, pending_categorization, reconciliation_alerts, business_profiles, bas_periods, bas_calculations, tax_codes, deductions, audit_log, sessions, upload_queue

### PostgreSQL Gap (31 tables missing from PG)
tax_brackets, cgt_assets, cgt_events, depreciable_assets, depreciation_schedule, tax_year_summary, teams, team_members, team_invitations, subscriptions, export_history, parser_metrics, parser_accuracy_aggregates, parser_feedback, chart_of_accounts, journal_entries, journal_entry_lines, accounting_periods, account_balances, rag_namespaces, rag_chunks, rag_documents, rag_citations, tax_offsets, capital_losses, wage_payments, owner_equity_events, tax_strategies, loan_scenarios, budget_templates, economic_data_cache

### Existing Migration Files (4)
0009, 0010, 0011, 0012

### Planned Migration Files (10)
0013, 0014, 0015, 0016, 0017, 0018, 0019, 0020, 0021, 0022

### Projected Migration Files (6)
0023, 0024, 0025, 0026, 0027, 0028 (possibly 0029)
