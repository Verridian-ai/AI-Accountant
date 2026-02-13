# R03 — Wave 11-24 Compatibility Analysis

**Agent**: R03 — Wave 11-24 Compatibility Analyzer
**Date**: 2026-02-13
**Scope**: What Waves 11-24 EXPECT from Waves 1-10, backward compatibility constraints

---

## Executive Summary

Waves 11-24 are already fully specified (orchestration prompts + 140 task files). They make **explicit and implicit assumptions** about what Waves 1-10 will deliver. **Any Wave 1-10 plan that violates these assumptions will break Waves 11-24**. This analysis maps every dependency.

### Key Finding: The Existing Codebase Has Already Delivered Wave 11-17 Artifacts

The codebase already contains 21 Claude agents, 89+ schema tables, and services for inventory, fixed assets, reconciliation, financial reporting, budgets, OCR, payment matching, forecasting, compliance, Cognee DataPoints, temporal intelligence — all built by Waves 11-17. **Waves 1-10 must not break any of these existing artifacts.**

---

## 1. Per-Wave Assumptions

### Wave 11: Inventory & Bank Reconciliation
**"Current State (After Wave 10)"** assumes:
- 13 Claude agents (11 original + `invoice_agent` + `accounts_payable_agent`)
- SQLite + PostgreSQL dual schema synchronized
- AP module with suppliers, bills, purchase orders operational
- Cognee datasets: `supplier_profiles`, `bill_patterns`, `ar_aging_patterns`, `invoice_patterns`
- 12 migrations (0009–0022) applied
- **Explicit dependency**: Wave 10 complete (AP and PO module for bill-to-inventory linking)

**Wave 1-10 MUST deliver**:
- `invoice_agent` (Wave 7)
- `accounts_payable_agent` (Wave 10)
- Suppliers, bills, purchase_orders tables (Wave 10)
- Invoice tables (Wave 7)
- 4 Cognee datasets for supplier/invoice/bill/AR patterns
- Migrations 0013-0022 (one per wave)

### Wave 12: Fixed Assets & Multi-Entity Consolidation
**"Current State (After Wave 11)"** assumes:
- 15 Claude agents (13 + `inventory_agent` + `bank_reconciler_agent`)
- Inventory module with COGS tracking operational
- Bank reconciliation with auto-matching
- 13 migrations (0009–0023) applied
- **Explicit dependency**: Wave 11 complete

**Additional Wave 1-10 expectations**:
- `base-agent.ts` with `ClaudeAgent<TInput, TOutput>` base class (already exists)
- `payroll-agent.ts` as pattern reference (already exists)
- `entityContextMiddleware` (per D04 debate — cross-cutting concern created in Wave 12 but forward-compatible with Wave 1-3's agent routing)

### Wave 13: Financial Reporting & Budgeting
**"Current State (After Wave 12)"** assumes:
- 17 Claude agents (15 + `asset_management_agent` + `multi_entity_agent`)
- Fixed assets with depreciation and multi-entity consolidation operational
- Chart of accounts already exists (from base schema)
- Existing `budget_analyzer` agent (already exists)
- 14 migrations (0009–0024) applied
- **Explicit dependency**: Wave 12 complete (multi-entity for entity-scoped reports)

### Wave 14: AI Document Processing & Payment Matching
**"Current State (After Wave 13)"** assumes:
- 19 Claude agents
- Financial reporting and budgeting modules operational
- Invoices (Wave 7) and Bills (Wave 10) available for matching
- 15 migrations (0009–0025) applied
- **True data dependency**: Wave 7 (invoices) + Wave 10 (bills) — NOT Waves 11-13
- Per D04 review: Can run parallel with Waves 11-13 if only data deps honored

**Wave 1-10 MUST deliver**:
- Invoice tables with line items (Wave 7)
- Bill/purchase order tables (Wave 10)
- Customer table (Wave 7)
- Supplier table (Wave 10)

### Wave 15: Predictive Analytics & Compliance Monitoring
**"Current State (After Wave 14)"** assumes:
- 21 Claude agents
- OCR and payment matching operational
- Financial reports and budgets as data sources
- 16 migrations (0009–0026) applied
- **Dependencies**: Wave 13 (financial reports for trend data), Wave 14 (matching for completeness)

### Wave 16: Custom DataPoints & Graph Relationships
**"Current State (After Wave 15)"** assumes:
- 23 Claude agents
- Cognee has ~18 datasets but only uses CHUNKS, CHUNKS_LEXICAL, GRAPH_COMPLETION, RAG_COMPLETION
- Custom DataPoints, ontologies, feedback system UNUSED
- 17 migrations (0009–0027) applied
- **Critical dependency**: Wave 3 (multi-user Cognee isolation)

**Wave 1-10 MUST deliver** (from Wave 3):
- Multi-user Cognee namespace isolation
- Cognee session management
- Per-user dataset partitioning
- Cognee auth configuration (tokens, not disabled)

### Wave 17: Temporal Queries & Cross-Module Intelligence
**"Current State (After Wave 16)"** assumes:
- 23 Claude agents (none added by Wave 16)
- Cognee custom DataPoints, ontologies, feedback active
- Graph visualization available
- ~22 Cognee datasets
- 18 migrations (0009–0028) applied
- **Dependencies**: Wave 16 (custom DataPoints and ontology layer)
- Redis wire-up (was "ghost service" until Wave 17)

### Wave 18: CDR Open Banking & Loan Comparison
**"Current State (After Wave 17)"** assumes:
- 23 Claude agents
- Loan calculator exists (uses hardcoded rates)
- 19 migrations (0009–0029) applied
- **Dependencies**: Wave 13 (financial reports for loan impact analysis)

### Wave 19: Market Intelligence & Sentiment Analysis
**"Current State (After Wave 18)"** assumes:
- 24 Claude agents (23 + `cdr_product_agent`)
- CDR product data crawler operational
- Economic data service exists but only caches RBA cash rate
- 20 migrations (0009–0030) applied
- **Dependencies**: Wave 18 (CDR for product context)

### Wave 20: Admin Backend & System Dashboard
**"Current State (After Wave 19)"** assumes:
- 25 Claude agents
- Market intelligence and CDR operational
- Cognee has 25+ datasets with custom DataPoints, ontologies, graph viz
- NO admin interface or user management beyond basic auth
- 21 migrations (0009–0031) applied
- **Dependencies**: Wave 16 (Cognee graph data), Wave 17 (cross-module intelligence)
- **Hidden dependency**: ALL agent-creating waves (11-15, 18-19) for complete agent listing

### Wave 21: Vercel AI SDK Migration & Streaming
**"Current State (After Wave 20)"** assumes:
- 25 Claude agents all using `ClaudeAgent<TInput, TOutput>` base class
- No streaming (all responses full-batch)
- No structured output validation
- Admin dashboard provides agent monitoring
- 22 migrations (0009–0032) applied
- **Dependencies**: Wave 20 (admin dashboard for monitoring)
- **Hidden dependency**: Waves 13, 15, 19 for pilot migration agents

### Wave 22: Advanced Visualizations & Chart Library
**"Current State (After Wave 21)"** assumes:
- No charting library installed
- Hand-built CSS charts in AnalyticsDashboard.tsx, BASComparison.tsx
- ~20 feature folders with data-heavy components needing charts
- 23 migrations (0009–0033) applied
- **Dependencies**: Wave 13 (financial reports), Wave 15 (forecast data)
- **Undeclared dependencies**: Waves 11, 19 (for InventoryValuation, MarketDashboard components)

### Wave 23: Multi-Tenant & Access Control
**"Current State (After Wave 22)"** assumes:
- 25 Claude agents
- Admin dashboard with user management (Wave 20)
- Custom dashboards with Recharts (Wave 22)
- Basic JWT auth but no tenant isolation, RBAC, or subscription model
- 24 migrations (0009–0034) applied
- **Dependencies**: Wave 20 (admin + user management)

### Wave 24: Mobile Responsive & PWA
**"Current State (After Wave 23)"** assumes:
- 26 Claude agents (25 + `tenant_routing_agent` from Wave 23)
- Multi-tenant RBAC operational
- Recharts visualization library integrated
- Tab-based navigation with 15+ tabs (BottomNavigation)
- NO responsive design, NO PWA, NO offline support
- 25 migrations (0009–0035) applied
- **Dependencies**: Wave 22 (responsive charts), Wave 23 (tenant-aware auth)

---

## 2. Required Services (Must Be Created by Waves 1-10)

### Wave 1: Chat → Agent Bridge & Intent Routing
| Service | Purpose | Referenced By |
|---------|---------|---------------|
| `intent-router.ts` | Route chat queries to correct agent | Wave 11+ (all agents routed through orchestrator) |
| Agent intent classification | Determine which agent handles a query | Wave 17 (cross-module routing) |
| SSE streaming foundation | Server-Sent Events for real-time updates | Wave 21 (enhanced streaming), existing SSEContext |

### Wave 2: Transaction Mutation & Streaming
| Service | Purpose | Referenced By |
|---------|---------|---------------|
| Agent mutation framework | Allow agents to mutate DB state | Wave 11 (inventory adjustments), Wave 12 (depreciation), Wave 14 (OCR confirm) |
| Transaction audit trail | Log all mutations | Wave 15 (audit_trails replaces audit_log) |
| Real-time update broadcasting | SSE push of changes | Wave 17 (intelligence subscriptions) |

### Wave 3: Multi-User Cognee & Custom DataPoints
| Service | Purpose | Referenced By |
|---------|---------|---------------|
| Cognee user isolation | Per-user dataset namespacing | Wave 16 (CRITICAL dependency), Wave 17 (sessions) |
| Cognee session management | Persistent query context | Wave 17 (temporal sessions, Redis caching) |
| Cognee namespace partitioning | Multi-user data separation | Wave 23 (multi-tenant Cognee) |

### Wave 4-6: Payroll
| Service | Purpose | Referenced By |
|---------|---------|---------------|
| `payroll-agent.ts` | Payroll processing agent | Already exists as pattern reference for all waves |
| Employee management | Employee CRUD | Wave 12 (entity-employee linking), Wave 15 (STP compliance) |
| Pay run engine | Salary/wage processing | Wave 13 (budget-payroll variance), Wave 15 (super guarantee compliance) |
| STP filing | Single Touch Payroll | Wave 15 (compliance_checks.checkType includes 'stp_filing') |
| TFN encryption helpers | AES-256-GCM for TFN | Wave 12 (entities.tfn encryption reuses same pattern) |

### Wave 7-9: Invoicing & AR
| Service | Purpose | Referenced By |
|---------|---------|---------------|
| `invoice_agent` | Invoice generation/management | Wave 11 (13-agent count), Wave 14 (payment matching) |
| Customer CRUD | Customer management | Wave 14 (OCR vendor matching), Wave 19 (sentiment analysis) |
| Invoice engine | Invoice generation | Wave 14 (matching target), Wave 11 (recon matching) |
| AR aging reports | Receivables aging | Wave 13 (financial reporting data source) |
| Recurring invoices | Subscription billing | Wave 15 (forecasting data source) |
| Multi-currency support | FX rates | Wave 19 (market data integration) |

### Wave 10: Accounts Payable & Purchase Orders
| Service | Purpose | Referenced By |
|---------|---------|---------------|
| `accounts_payable_agent` | AP management | Wave 11 (13-agent count), Wave 14 (bill matching) |
| Supplier management | Supplier CRUD | Wave 11 (inventory supplier linking), Wave 14 (OCR vendor matching) |
| Purchase orders | PO lifecycle | Wave 11 (bill-to-inventory linking) |
| Bill management | Bill CRUD | Wave 14 (payment matching target) |

---

## 3. Required Database Tables (Must Exist Before Waves 11+)

### From Waves 1-3 (Core Infrastructure)
The master plan specifies migrations 0013-0015 for Waves 1-3. These tables are implicitly referenced:

| Table | Wave | Referenced By |
|-------|------|---------------|
| Agent execution log / routing | 1 | Wave 20 (agent_executions), Wave 21 (migration status) |
| Transaction mutation audit | 2 | Wave 15 (audit_trails) |
| Cognee user namespaces | 3 | Wave 16 (DataPoint per-user configs) |

### From Waves 4-6 (Payroll)
Migration 0016-0018:

| Table | Wave | Referenced By |
|-------|------|---------------|
| `employees` | 4 | Wave 12 (entity-employee linking), Wave 15 (STP compliance) |
| `pay_categories` | 4 | Wave 13 (budget line mapping) |
| `pay_runs` | 5 | Wave 13 (budget vs actual), Wave 15 (super guarantee) |
| `leave_balances` | 5 | Wave 13 (liability reporting) |
| `stp_submissions` | 6 | Wave 15 (compliance_checks stp_filing) |
| `timesheets` | 6 | Wave 13 (cost reporting) |

### From Waves 7-9 (Invoicing & AR)
Migration 0019-0021:

| Table | Wave | Referenced By |
|-------|------|---------------|
| `customers` | 7 | Wave 14 (OCR matching), Wave 19 (sentiment per customer) |
| `invoices` | 7 | Wave 11 (recon matching), Wave 14 (payment matching) |
| `invoice_line_items` | 7 | Wave 14 (OCR line item matching) |
| `recurring_invoices` | 8 | Wave 15 (forecasting) |
| `payment_receipts` | 8 | Wave 14 (payment matching) |
| `ar_aging` | 9 | Wave 13 (financial reporting) |
| `currency_rates` | 9 | Wave 19 (market data FX) |

### From Wave 10 (AP & Purchase Orders)
Migration 0022:

| Table | Wave | Referenced By |
|-------|------|---------------|
| `suppliers` | 10 | Wave 11 (inventory linking), Wave 14 (bill matching) |
| `bills` | 10 | Wave 11 (recon matching), Wave 14 (payment matching) |
| `purchase_orders` | 10 | Wave 11 (inventory receipt) |
| `bill_line_items` | 10 | Wave 14 (OCR matching) |

### Total New Tables Expected from Waves 1-10
Master plan states: **58 new tables** across migrations 0013-0022.

---

## 4. Required API Endpoints (Referenced by Waves 11+)

### Endpoints Waves 11-24 Implicitly Require

| Endpoint | Created By | Required By |
|----------|-----------|-------------|
| `/api/chat` | Wave 1 (enhanced) | Wave 17 (temporal routing), Wave 21 (streaming) |
| `/api/agents/*` | Wave 1 | Wave 20 (agent management), Wave 21 (migration) |
| `/api/invoices/*` | Wave 7 | Wave 14 (payment matching targets) |
| `/api/bills/*` | Wave 10 | Wave 14 (payment matching targets) |
| `/api/suppliers/*` | Wave 10 | Wave 11 (inventory linking) |
| `/api/customers/*` | Wave 7 | Wave 14 (OCR vendor matching) |
| `/api/payroll/*` | Wave 5 | Wave 15 (compliance checks) |
| `/api/employees/*` | Wave 4 | Wave 12 (entity linking) |

### Master Plan Estimated: ~128 endpoints from Waves 1-10

---

## 5. Required Cognee Configuration

### Wave 3 Must Deliver (CRITICAL for Wave 16)
| Requirement | Impact |
|-------------|--------|
| Multi-user namespace isolation | Wave 16 custom DataPoints are per-user |
| Cognee session management | Wave 17 temporal sessions depend on this |
| Per-user dataset partitioning | Wave 23 multi-tenant Cognee isolation extends this |
| Service token authentication | D02 security finding — remove disabled auth |

### Cognee Datasets Created by Waves 1-10 (Referenced by 11+)
| Dataset | Created By | Referenced By |
|---------|-----------|---------------|
| `supplier_profiles` | Wave 10 | Wave 11 (inventory linking) |
| `bill_patterns` | Wave 10 | Wave 11 (recon patterns) |
| `ar_aging_patterns` | Wave 9 | Wave 13 (financial reporting) |
| `invoice_patterns` | Wave 7 | Wave 14 (payment matching) |
| `payroll_patterns` | Wave 6 | Wave 15 (compliance monitoring) |
| `expense_patterns` | Wave 1-3 | Wave 15 (anomaly detection) |

---

## 6. Conflict Risks

### RISK-01: AgentType Union Cross-Wave Locking (CRITICAL)
**Problem**: `types.ts` has a string literal union `AgentType`. Waves 1-10 must add `invoice_agent` and `accounts_payable_agent` (and possibly `payroll_agent` if not already registered). Waves 11-24 add 14 more agents to this same union.

**Existing state**: The codebase already has 21 agents registered (from partial Wave 11-17 execution). If Waves 1-10 are now generated to add 2 agents, they must NOT conflict with the 14+ already added by existing code.

**Resolution**: Waves 1-10 should:
- Pre-declare ALL planned agent types in the union (or use runtime string validation)
- NOT remove any existing agent types from the union
- Append their new types to the EXISTING list, not replace it

### RISK-02: Schema.ts Table Collision
**Problem**: The codebase already has 89+ tables in `schema.ts` from Waves 11-17 execution. If Wave 1-10 plans generate schema changes, they must not collide with these existing table names.

**Existing tables that Waves 1-10 might name-collide with**:
- `entities` (already created by Wave 12) — Wave 12 created this, but Wave 7 might want a "customer entities" concept
- `budgets`, `budgetLines`, `budgetVsActual` (already created by Wave 13) — Wave 5/6 might have budget concepts
- `forecastScenarios`, `forecastPeriods` (already created by Wave 13) — Wave 1-10 shouldn't create forecast tables

**Resolution**: Waves 1-10 must use distinct table names for their domain objects. Use prefixes like `payroll_`, `invoice_`, `ap_` to avoid collision.

### RISK-03: Migration Number Collision
**Problem**: Waves 1-10 are assigned migrations 0013-0022. Existing codebase already has:
- `0011_final_schema_sync.sql` (untracked)
- `0012_tax_return_platform.sql` (untracked)
- `0023_inventory_bank_recon.sql` (Wave 11, untracked)
- `0024_fixed_assets_multi_entity.sql` (Wave 12, untracked)
- `0025_financial_reporting.sql` (Wave 13, untracked)
- `0026_ai_ocr_payment_matching.sql` (Wave 14, untracked)
- `0028_cognee_datapoints.sql` (Wave 16, untracked)
- `0029_temporal_intelligence.sql` (Wave 17, untracked)

**Resolution**: Waves 1-10 MUST use 0013-0022 as planned. The gap works because the migration runner processes files in numeric order.

### RISK-04: index.ts Route Registration Order
**Problem**: `index.ts` already has routes from base codebase. Waves 1-10 will add ~128 endpoints. Waves 11-24 have already added routes. The master plan (D01) warns index.ts will become unmaintainable at 350+ endpoints.

**Resolution**: If Waves 1-10 implement route modules (`app.route()` pattern), they must not break existing Hono route registration order. New routes should be appended or use modular pattern.

### RISK-05: `/api/forecasts` Route Collision Already Fixed
**Problem**: Original Wave 13 used `/api/forecasts/*` which collided with Wave 15's `/api/forecasts/cash-flow`.

**Resolution**: Already fixed — Wave 13 renamed to `/api/budget-forecasts/*`. Waves 1-10 should NOT create any `/api/forecasts/*` routes to avoid collision with Wave 15.

### RISK-06: Cognee Client Method Expansion
**Problem**: `cognee_client.ts` has been expanded by Waves 16-17 with 10+ new methods. Waves 1-10 (especially Wave 3) must not overwrite or conflict with these methods.

**Resolution**: Wave 3 Cognee work should ADD user isolation methods to the EXISTING `CogneeClient` class, not replace it.

### RISK-07: Authentication Model Forward-Compatibility
**Problem**: Wave 20 creates `admin_users` table. Wave 23 creates full RBAC. These two auth systems must be reconciled.

**Resolution**: Whatever auth Wave 1-3 creates (basic JWT), it must be forward-compatible with:
- Wave 20's admin auth (`admin_users` table with `super_admin/admin/viewer` roles)
- Wave 23's multi-tenant RBAC (`tenants`, `tenant_members`, `permissions` tables)

### RISK-08: BottomNavigation Tab Accumulation
**Problem**: Waves 11-24 each add 1-2 tabs to BottomNavigation.tsx's `TabId` type. Wave 24 replaces it entirely with React Router. Total: 21+ tabs.

**Resolution**: Waves 1-10 should add their navigation tabs with awareness of the grouping recommendation (Finance/Operations/Analytics/AI) from D01. Keep tab additions minimal.

---

## 7. Backward Compatibility Rules (Constraints for Wave 1-10 Planning)

### RULE BC-01: DO NOT Remove Existing Agent Types
The `AgentType` union in `types.ts` currently includes: `statement_parser`, `transaction_categorizer`, `gst_calculator`, `merchant_intelligence`, `tax_strategy`, `financial_planner`, `cross_account_tracer`, `account_reconciler`, `budget_analyzer`, `payroll_agent`, `personal_tax_claims`, plus 10+ added by Waves 11-17. **None may be removed.**

### RULE BC-02: DO NOT Remove Existing Schema Tables
89+ tables exist in `schema.ts`. Waves 1-10 must ADD tables (with unique names), never remove existing ones.

### RULE BC-03: DO NOT Modify Existing Migration Files
Migrations 0023-0029 already exist as untracked files. Waves 1-10 create 0013-0022 in the gap. Never touch existing migration files.

### RULE BC-04: Preserve Dual Schema Pattern
ALL new tables must be defined in BOTH `schema.ts` (SQLite) and `postgres-schema.ts` (PostgreSQL). This is a coordination rule enforced across all waves.

### RULE BC-05: Preserve ClaudeAgent Base Class
All new agents MUST extend `ClaudeAgent<TInput, TOutput>` from `base-agent.ts`. Wave 21 will later add a `VercelAgent` alternative, but that's post-Wave 20. Waves 1-10 must use the existing pattern.

### RULE BC-06: Cognee Client Is Singleton
`cognee_client.ts` is the single source of truth for all Cognee HTTP calls. Waves 1-10 (especially Wave 3) must add methods to this existing client class, not create parallel clients. Three clients were previously consolidated in the audit.

### RULE BC-07: Migration Numbering Is Sacred
0013-0022 for Waves 1-10. No skipping, no reordering. Wave 11 starts at 0023 (already exists).

### RULE BC-08: Config.ts Agent Registry
New agents must be registered in `config.ts` (AGENT_TOKEN_BUDGETS, agent model mapping). Waves 1-10 add their agents; Waves 11-24 expect the cumulative count.

### RULE BC-09: types.ts I/O Interfaces
Existing agent I/O interfaces in `types.ts` (e.g., `StatementParserInput`, `StatementParserOutput`) must not be modified. New agents add new interface pairs.

### RULE BC-10: Route Namespace Conventions
Established route namespaces from Waves 11-24 that Waves 1-10 must NOT collide with:
- `/api/inventory/*` (Wave 11)
- `/api/recon/*` (Wave 11)
- `/api/assets/*` (Wave 12)
- `/api/entities/*` (Wave 12)
- `/api/inter-entity/*` (Wave 12)
- `/api/consolidation/*` (Wave 12)
- `/api/reports/*` (Wave 13)
- `/api/budgets/*` (Wave 13)
- `/api/budget-forecasts/*` (Wave 13)
- `/api/kpis/*` (Wave 13)
- `/api/ocr/*` (Wave 14)
- `/api/matching/*` (Wave 14)
- `/api/documents/*` (Wave 14)
- `/api/forecasts/*` (Wave 15)
- `/api/anomalies/*` (Wave 15)
- `/api/compliance/*` (Wave 15)
- `/api/audit-trail/*` (Wave 15)
- `/api/cognee/*` (Wave 16)
- `/api/intelligence/*` (Wave 17)
- `/api/cdr/*` (Wave 18)
- `/api/market/*` (Wave 19)
- `/api/admin/*` (Wave 20)
- `/api/agents/*` (Wave 21)
- `/api/dashboards/*` (Wave 22)
- `/api/charts/*` (Wave 22)
- `/api/tenants/*` (Wave 23)
- `/api/subscriptions/*` (Wave 23)
- `/api/push/*` (Wave 24)
- `/api/sync/*` (Wave 24)

**Safe namespaces for Waves 1-10**:
- `/api/chat/*` (Wave 1 — enhance existing)
- `/api/mutations/*` or `/api/agent-actions/*` (Wave 2)
- `/api/cognee/users/*` or `/api/cognee/sessions/*` (Wave 3 — under existing cognee namespace)
- `/api/payroll/*` (Waves 4-6)
- `/api/employees/*` (Wave 4)
- `/api/leave/*` (Wave 5)
- `/api/stp/*` (Wave 6)
- `/api/customers/*` (Wave 7)
- `/api/invoices/*` (Wave 7)
- `/api/recurring-invoices/*` (Wave 8)
- `/api/payments/*` (Wave 8)
- `/api/ar/*` (Wave 9)
- `/api/currencies/*` (Wave 9)
- `/api/suppliers/*` (Wave 10)
- `/api/bills/*` (Wave 10)
- `/api/purchase-orders/*` (Wave 10)

---

## 8. Dependency Chain Summary

### What Waves 11-24 Expect Already Exists vs What Waves 1-10 Must Create

#### ALREADY EXISTS (From Current Codebase)
- 11 original Claude agents (statement_parser, transaction_categorizer, gst_calculator, etc.)
- 89+ database tables including transactions, accounts, statements, BAS, GST, tax
- Cognee client (`cognee_client.ts`) with 20+ methods
- Cognee tools (`cognee-tools.ts`) with search, indexing, DataPoint, temporal tools
- Docker 5-service topology (postgres, redis, cognee, server, client)
- ClaudeAgent base class
- SSE streaming context
- Queue service (`queue.ts`)
- Circuit breaker AI fallback

#### MUST BE CREATED BY WAVES 1-10
| Deliverable | Wave | Blocking |
|-------------|------|----------|
| Agent intent router / dispatcher | 1 | Wave 17 (cross-module routing) |
| Agent mutation framework | 2 | Wave 11-15 (agents need to write data) |
| Multi-user Cognee isolation | 3 | **Wave 16 (CRITICAL)** |
| Cognee session management | 3 | Wave 17 (temporal sessions) |
| Employee CRUD + tables | 4 | Wave 12 (entity linking), Wave 15 (STP compliance) |
| Pay run engine | 5 | Wave 13 (budget variance), Wave 15 (super guarantee) |
| STP compliance service | 6 | Wave 15 (compliance monitoring) |
| `invoice_agent` | 7 | Wave 11 (agent count: 13) |
| Customer CRM | 7 | Wave 14 (OCR vendor matching) |
| Invoice engine + tables | 7 | Wave 14 (payment matching target) |
| Recurring invoices | 8 | Wave 15 (forecasting data) |
| AR aging | 9 | Wave 13 (financial reporting data) |
| `accounts_payable_agent` | 10 | Wave 11 (agent count: 13) |
| Supplier management | 10 | Wave 11 (inventory linking) |
| Purchase orders | 10 | Wave 11 (bill-to-inventory) |
| Bill management | 10 | Wave 14 (payment matching target) |
| Cognee datasets (6+) | 7-10 | Wave 11+ (pattern matching) |
| Migrations 0013-0022 | 1-10 | Wave 11 starts at 0023 |

---

## 9. Critical Path for Wave 1-10 Planning

Based on the dependency analysis, the **minimum viable delivery** from Waves 1-10 to unblock ALL of Waves 11-24 is:

### Phase 1 (Sequential, Must Complete First):
```
Wave 1 (Intent Router) → Wave 2 (Mutations) → Wave 3 (Cognee Isolation)
```

### Phase 2 (Parallel After Wave 3):
```
Track A: Wave 4 → 5 → 6 (Payroll)
Track B: Wave 7 → 8 → 9 (Invoicing/AR)
Track C: Wave 10 (AP/PO — needs some Wave 7 patterns)
Track D: Wave 16 → 17 (can start immediately after Wave 3!)
```

### Phase 3 (After Tracks A+B+C converge):
```
Wave 11 (needs Wave 10)
Wave 14 (needs Waves 7+10, can parallel with 11-13)
```

### Key Parallelization Opportunity:
Wave 16 only needs Wave 3 — it can run BEFORE Waves 4-15! This was identified by D04 and should be exploited.

---

## 10. Pre-Wave-11 Infrastructure Requirements (From Debates)

The debate reviews (D01-D05) identified several pre-Wave-11 tasks that affect compatibility:

| Task | Source | Impact |
|------|--------|--------|
| Install Vitest + Playwright | D01 §6 | All waves should ship with tests |
| Refactor index.ts into route modules | D01 §1 | 350+ endpoints will be unmaintainable |
| Install BullMQ (Redis job queue) | D03 §1 | Waves 13-19 need async job processing |
| Enable Cognee service token auth | D02 §1 | Security requirement before Wave 16 |
| Remove Docker host port exposure | D02 §1 | Security hardening |
| Consider dropping SQLite (PG-only) | D01 §2 | Dual schema maintenance burden |
| Configure React Router + Sidebar nav | D01 §3 | Prevent 21-tab BottomNavigation sprawl |

These are not Wave 1-10 deliverables per se, but "pre-Wave-11 infrastructure" that the debate team recommends. Waves 1-10 planning should address these where possible.

---

*Analysis completed by R03 — Wave 11-24 Compatibility Analyzer*
*Sources: 14 orchestration prompts, master plan, D04 integration review, REVISION-LOG, schema.ts, existing codebase inventory*
