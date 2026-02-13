# D04 — Integration & Dependencies Review

**Reviewer**: Agent D04 — Integration & Dependencies Reviewer
**Date**: 2026-02-12
**Scope**: Waves 11–24 orchestration prompts, cross-wave dependency analysis
**Source files**: wave11-orchestration-prompt.md through wave24-orchestration-prompt.md, wave0-research/R06-plan-gaps.md

---

## 1. Dependency Graph

### 1.1 Declared Inter-Wave Dependencies

```
Wave 11 → Requires: Wave 10 (AP/PO for bill-to-inventory linking)
Wave 12 → Requires: Wave 11 (inventory for asset linking)
Wave 13 → Requires: Wave 12 (multi-entity for entity-scoped reports)
Wave 14 → Requires: Wave 7 (invoices), Wave 10 (bills) for matching targets
Wave 15 → Requires: Wave 13 (financial reports), Wave 14 (matching completeness)
Wave 16 → Requires: Wave 3 (multi-user Cognee isolation)
Wave 17 → Requires: Wave 16 (custom DataPoints and ontology layer)
Wave 18 → Requires: Wave 13 (financial reports for loan impact analysis)
Wave 19 → Requires: Wave 18 (CDR for product context)
Wave 20 → Requires: Wave 16 (Cognee graph data), Wave 17 (cross-module intelligence)
Wave 21 → Requires: Wave 20 (admin dashboard for monitoring migrated agents)
Wave 22 → Requires: Wave 13 (financial reports data), Wave 15 (forecast data)
Wave 23 → Requires: Wave 20 (admin + user management)
Wave 24 → Requires: Wave 22 (responsive charts), Wave 23 (tenant-aware auth for PWA)
```

### 1.2 Full Dependency Graph (Visual)

```
                                     Wave 3
                                       │
                          ┌────────────┤
                          │            │
Wave 7 ──┐               │          Wave 16
Wave 10 ─┤               │            │
          │               │          Wave 17
        Wave 11           │            │
          │               │          Wave 20 ─────────────┐
        Wave 12           │            │                   │
          │               │          Wave 21             Wave 23
        Wave 13 ──────────┤            │                   │
          │    \          │          Wave 22 ──────────── Wave 24
        Wave 14  \        │            │
          │       Wave 18 │            │
        Wave 15     │     │          Wave 24
          │       Wave 19 │
        Wave 22           │
                        Wave 20
```

### 1.3 Critical Path Analysis

**Longest chain (Critical Path)**:
```
Wave 10 → 11 → 12 → 13 → 14 → 15 → 22 → 24
(8 waves sequential — this is the primary bottleneck)
```

**Secondary long chain**:
```
Wave 3 → 16 → 17 → 20 → 21
Wave 3 → 16 → 17 → 20 → 23 → 24
```

**Shortest independent path**:
```
Wave 16 only needs Wave 3 (could start very early)
```

---

## 2. Dependency Issues

### ISSUE D01 — BLOCKER: Wave 14 Dependency Contradiction

**Wave 14** declares `Requires: Wave 7 (invoices) and Wave 10 (bills)` for matching targets, yet its "Current State" section says "After Wave 13 — 19 Claude agents." This implies strict linear ordering (11→12→13→14), but the actual **data dependency** is only on Waves 7 and 10.

**Impact**: Wave 14 could potentially run in parallel with Waves 11–13 if only data dependencies are honored, but the "Current State" block forces serial execution.

**Recommendation**: Clarify whether Wave 14 truly needs Waves 11–13 complete, or only 7+10. If only 7+10, unlock parallel execution with Waves 11–13.

### ISSUE D02 — BLOCKER: Wave 22 Has Undeclared Dependency on Wave 11

Wave 22 says it will add charts to `InventoryValuation.tsx (Wave 11)`. This is an **undeclared dependency** on Wave 11 output. The declared dependencies are only Wave 13 and Wave 15.

**Impact**: If Wave 22 runs before Wave 11 is complete, the `InventoryValuation.tsx` component won't exist to enhance.

**Recommendation**: Add Wave 11 as a declared dependency for Wave 22, or move the inventory chart to a later integration wave.

### ISSUE D03 — WARNING: Wave 18 Dependency May Be Too Loose

Wave 18 declares `Requires: Wave 13 (financial reports for loan impact analysis)`. But Wave 18 also builds `SavingsCalculator.tsx` that calculates savings vs "current products" — this suggests it needs the user to have financial data from **accounts and transactions** (base schema), not specifically Wave 13's reporting module.

**Impact**: Minor — the loan impact analysis genuinely benefits from Wave 13's P&L data, but the core CDR crawling and product comparison are independent.

**Recommendation**: Split Wave 18 into CDR crawler (independent, can start after Wave 3) and loan-impact analysis (needs Wave 13).

### ISSUE D04 — WARNING: Wave 20 Has Hidden Dependency on All Prior Waves

Wave 20 (Admin Dashboard) needs to display and manage **all 25 agents**. It references agent counts from all prior waves. If any prior wave's agents aren't registered in `types.ts` and `config.ts`, the admin dashboard will have incomplete data.

**Impact**: Admin dashboard will silently show incomplete agent list if any wave hasn't completed.

**Recommendation**: Wave 20 should explicitly declare dependency on all agent-creating waves (11, 12, 13, 14, 15, 18, 19) or use dynamic discovery.

### ISSUE D05 — WARNING: Wave 22 Charts Reference Components from 5 Different Waves

Wave 22 modifies components from Waves 11 (InventoryValuation), 13 (BudgetVsActual), 15 (ForecastDashboard), 19 (MarketDashboard), plus existing pages. This creates an implicit dependency on ALL those waves being complete.

**Impact**: Wave 22 agents will fail trying to modify non-existent files.

**Recommendation**: Wave 22 should either (a) declare dependencies on Waves 11, 13, 15, 19 explicitly, or (b) create chart components defensively (check if target file exists, skip if not).

### ISSUE D06 — INFO: Wave 16 Has Longest Independent Gap

Wave 16 only needs Wave 3 (multi-user Cognee isolation). Since Waves 4–15 are on a different branch, Wave 16 could theoretically start much earlier. The current plan implicitly serializes it after Wave 15.

**Recommendation**: Schedule Wave 16 as soon as Wave 3 completes for maximum parallelization.

---

## 3. API Contract Issues

### ISSUE A01 — BLOCKER: `/api/forecasts` Route Collision Between Wave 13 and Wave 15

**Wave 13** defines:
- `GET /api/forecasts` — List forecast scenarios
- `POST /api/forecasts` — Create forecast scenario
- `GET /api/forecasts/:id` — Get forecast with periods
- `POST /api/forecasts/:id/recalculate` — Recalculate forecast

**Wave 15** defines:
- `GET /api/forecasts/cash-flow` — Generate cash flow forecast
- `POST /api/forecasts/cash-flow` — Create saved forecast
- `GET /api/forecasts/cash-flow/:id` — Get forecast detail
- etc.

**Problem**: Wave 15's `GET /api/forecasts/cash-flow` could be interpreted by the router as `GET /api/forecasts/:id` with `id = "cash-flow"` if Wave 13's route is registered first with a catch-all `:id` parameter.

**Impact**: Route ambiguity will cause runtime errors or incorrect handler invocation.

**Recommendation**: Either (a) namespace Wave 15 under `/api/cash-flow-forecasts/` or (b) ensure Wave 13's `:id` pattern uses numeric-only regex validation.

### ISSUE A02 — WARNING: `/api/admin/cognee/graph` Duplicates Wave 16 Route

**Wave 16** defines:
- `GET /api/cognee/graph/:dataset` — Get graph data (nodes + edges)

**Wave 20** defines:
- `GET /api/admin/cognee/graph` — Full graph data for 3D viz
- `GET /api/admin/cognee/graph/:dataset` — Graph for specific dataset

**Problem**: Two different route trees serving the same Cognee graph data, with different auth levels (Wave 16 = user-facing, Wave 20 = admin-only). This is potentially intentional but risks divergent implementations.

**Impact**: Data inconsistency if the two endpoints return different graph formats.

**Recommendation**: Wave 20's admin graph endpoint should delegate to Wave 16's service layer, not reimplementing graph fetch.

### ISSUE A03 — WARNING: Inconsistent Authentication Models

- **Waves 11–19**: No auth model specified (inherits basic JWT from existing codebase)
- **Wave 20**: Introduces `admin_users` table with separate admin auth
- **Wave 23**: Introduces full multi-tenant RBAC with `tenants`, `tenant_members`, `permissions`

**Problem**: Wave 20 creates `admin_users` as a separate table, but Wave 23's RBAC system should subsume admin roles. Wave 23 has `role (owner/admin/accountant/bookkeeper/viewer)` while Wave 20 has `role (super_admin/admin/viewer)`. These role taxonomies conflict.

**Impact**: Two parallel auth systems that must be reconciled. Wave 23's auth upgrade task modifies `admin-auth.ts` from Wave 20, but the migration path from separate `admin_users` to tenant-based roles isn't specified.

**Recommendation**: Either (a) Wave 20 should build auth that's forward-compatible with Wave 23's tenant model, or (b) Wave 23 must include explicit migration of `admin_users` into the tenant role system.

### ISSUE A04 — WARNING: Wave 24 Replaces Core Navigation Pattern

Wave 24 replaces `BottomNavigation.tsx` tab-based navigation with `react-router-dom` URL routing. **Every wave from 11–23 adds tabs to the `TabId` type in BottomNavigation.tsx**:

| Wave | Adds to TabId |
|------|--------------|
| 11 | `inventory`, `reconciliation` |
| 12 | `assets`, `entities` |
| 13 | `reports`, `budgets` |
| 14 | `documents` |
| 15 | `compliance` |
| 16 | `knowledge` |
| 17 | `intelligence` |
| 18 | `banking-products` |
| 19 | `market` |
| 22 | `dashboards` |

**Total by Wave 23**: 9 existing tabs + 12 new = **21 tabs** in BottomNavigation.

**Problem**: Wave 24 then discards all of this by replacing tabs with router. This means 12 waves of tab additions are throwaway work.

**Impact**: Significant wasted effort. The BottomNavigation will be grotesquely overloaded with 21+ tabs before Wave 24 replaces it entirely.

**Recommendation**: Either (a) introduce the router migration earlier (Wave 14 or 15) before too many tabs accumulate, or (b) have Waves 11+ use a temporary sidebar/group approach that maps cleanly to the final router structure.

### ISSUE A05 — INFO: CDR `/api/cdr/*` Routes Are Consistent

Wave 18's CDR endpoints are cleanly namespaced under `/api/cdr/` with no collisions with other waves.

### ISSUE A06 — INFO: Market `/api/market/*` Routes Are Consistent

Wave 19's market endpoints are cleanly namespaced under `/api/market/` with no collisions.

---

## 4. Agent Contract Issues

### ISSUE AG01 — BLOCKER: AgentType Union Must Be Incrementally Extended

The current `AgentType` in `types.ts` is a **string literal union** of 11 types. Each wave that adds agents must modify this union AND the corresponding `AGENT_TOKEN_BUDGETS` record in `config.ts`.

**Waves adding new agents**:
| Wave | New Agent Types | Cumulative Total |
|------|----------------|-----------------|
| 11 | `inventory_agent`, `bank_reconciler_agent` | 13 |
| 12 | `asset_management_agent`, `multi_entity_agent` | 15 |
| 13 | `financial_reporting_agent`, `budgeting_agent` | 17 |
| 14 | `ocr_processing_agent`, `payment_matching_agent` | 19 |
| 15 | `forecasting_agent`, `compliance_monitoring_agent` | 21 |
| 18 | `cdr_product_agent` | 22 (Wave 16–17 add 0) |
| 19 | `market_intelligence_agent` | 23 (Wave 18 adds 1) |
| 23 | `tenant_routing_agent` | 24 |

**Problem**: Each wave's "Agent 4/5" modifies `types.ts` to add new agent types. With 8 waves doing this sequentially, file conflicts are guaranteed if waves run in parallel. The coordination rules say "Only Agents 4 and 5 modify types.ts (Agent 4 first, then Agent 5)" — but this is PER-WAVE. Cross-wave locking is not specified.

**Impact**: If any two waves run concurrently, `types.ts` and `config.ts` will have merge conflicts.

**Recommendation**: Either (a) designate a single "agent registry" wave that pre-declares all agent types, or (b) switch from a static union type to a runtime registry pattern: `type AgentType = string` with runtime validation.

### ISSUE AG02 — WARNING: Wave 11 `bank_reconciler_agent` vs Existing `account_reconciler`

Wave 11 creates `bank_reconciler_agent` described as "Enhanced version of existing `account_reconciler`." But the orchestration doesn't specify whether this **replaces** or **supplements** the existing agent. The `account_reconciler` type already exists in the AgentType union.

**Impact**: Ambiguity about whether the old `account_reconciler` is deprecated or runs in parallel with the new `bank_reconciler_agent`.

**Recommendation**: Explicitly specify: does `bank_reconciler_agent` replace `account_reconciler` (removing from union) or coexist (both remain)?

### ISSUE AG03 — WARNING: Agent I/O Contracts Not Specified for New Agents

Existing agents in `types.ts` have full I/O interface definitions (e.g., `StatementParserInput`, `StatementParserOutput`). **None of the 14 new agents** (Waves 11–24) specify their I/O interfaces in the orchestration prompts.

**Impact**: Each wave's agent builder will invent their own I/O interfaces without coordination. This leads to inconsistent patterns across agents.

**Recommendation**: Add I/O interface specifications to each wave's orchestration prompt, following the existing pattern in `types.ts`.

### ISSUE AG04 — WARNING: Wave 21 Vercel SDK Migration Touches All Agents

Wave 21 introduces a second agent base class (`VercelAgent<TInput, TOutput>`) alongside the existing `ClaudeAgent<TInput, TOutput>`. Phase 2 of migration targets `financial_reporting_agent`, `forecasting_agent`, `market_intelligence_agent` — but these are built in Waves 13, 15, and 19 respectively.

**Problem**: If Wave 21 runs before all targeted agents exist, the migration will fail. Wave 21 declares dependency only on Wave 20, but actually needs Waves 13, 15, and 19 completed.

**Impact**: Phase 2 and 3 migrations will fail for non-existent agents.

**Recommendation**: Wave 21 should declare dependencies on ALL waves whose agents it plans to migrate, or the migration phases should be scheduled dynamically based on which agents exist.

---

## 5. Schema Dependencies

### ISSUE S01 — BLOCKER: Migration Numbering Gap at 0023

R06 research documented existing migrations as `0009–0012`. The wave plans use `0013–0022` for Waves 1–10. The orchestration prompts then use:

| Wave | Migration | Number |
|------|-----------|--------|
| 11 | `0023_inventory_bank_recon.sql` | 0023 |
| 12 | `0024_fixed_assets_multi_entity.sql` | 0024 |
| 13 | `0025_financial_reporting_budgets.sql` | 0025 |
| 14 | `0026_ai_ocr_payment_matching.sql` | 0026 |
| 15 | `0027_predictive_compliance.sql` | 0027 |
| 16 | `0028_cognee_custom_datapoints.sql` | 0028 |
| 17 | `0029_temporal_cross_module.sql` | 0029 |
| 18 | `0030_cdr_open_banking.sql` | 0030 |
| 19 | `0031_market_intelligence.sql` | 0031 |
| 20 | `0032_admin_dashboard.sql` | 0032 |
| 21 | `0033_vercel_ai_sdk.sql` | 0033 |
| 22 | `0034_advanced_visualizations.sql` | 0034 |
| 23 | `0035_multi_tenant.sql` | 0035 |
| 24 | `0036_mobile_pwa.sql` | 0036 |

**Numbering is sequential and consistent**: 0023–0036, one per wave, no gaps or collisions.

**However**, the existing codebase already has `docker/migrations/0011_final_schema_sync.sql` and `docker/migrations/0012_tax_return_platform.sql` as **untracked files** in git status. This suggests the migration runner may not check for gaps.

**Verdict**: Migration numbering is **correct** assuming Waves 1–10 complete and apply 0013–0022 first.

### ISSUE S02 — BLOCKER: Dual Schema Maintenance Not Enforced

Each wave's schema builder creates tables in both `schema.ts` (SQLite) and `postgres-schema.ts` (PostgreSQL). However:

- Only **Wave 11** explicitly states "Dual schema: Every table in BOTH schema.ts AND postgres-schema.ts" in its coordination rules.
- **Waves 12–24** do not repeat this rule.

**Impact**: Schema builders in later waves may forget to update both schema files, leading to SQLite/PG divergence.

**Recommendation**: Add the dual-schema rule to EVERY wave's coordination rules, or create a shared "standards" file that all waves reference.

### ISSUE S03 — WARNING: Wave 15 `audit_trails` Table May Conflict with Existing `audit_log`

Wave 15 creates `audit_trails` with columns: `id, userId, entityId, module, action, entityType, entityId_ref, beforeState, afterState, ipAddress, userAgent, timestamp`.

The existing schema already has `audit_log` table (listed in R06's PostgreSQL tables). These serve similar purposes.

**Impact**: Two audit tables with overlapping functionality. Applications may log to one, the other, or both inconsistently.

**Recommendation**: Either (a) Wave 15 extends the existing `audit_log` with new columns, or (b) explicitly deprecate `audit_log` in favor of `audit_trails`.

### ISSUE S04 — WARNING: Wave 23 Tenant Isolation Retrofits ALL Existing Tables

Wave 23 adds `tenants` and `tenant_members` tables, requiring every existing query to add tenant filtering. But no migration adds `tenantId` to existing tables (transactions, accounts, statements, etc.).

**Impact**: Multi-tenancy without adding `tenantId` foreign keys to existing tables means tenant isolation must be implemented via the `users → tenant_members → tenants` join path. This is architecturally viable but could be a performance concern for high-volume queries.

**Recommendation**: Wave 23 should include ALTER TABLE statements adding `tenantId` to core tables (transactions, accounts, statements, invoices) with default values, or explicitly document the join-path approach.

### ISSUE S05 — WARNING: Total Schema Size Projection

By Wave 24, the schema will contain:
- Existing: ~51 SQLite tables
- Waves 1–10: ~58 new tables (from R06)
- Waves 11–24: 7+10+8+5+6+3+4+9+6+7+3+2+8+3 = **81 new tables**
- **Grand total: ~190 tables**

This is significantly more than R06's projection of ~140 tables.

**Impact**: Schema complexity may impact developer comprehension and migration testing.

---

## 6. Cognee Dependencies

### ISSUE C01 — WARNING: Cognee Dataset Explosion

Cumulative Cognee datasets across Waves 11–24:

| Wave | New Datasets | Cumulative |
|------|-------------|-----------|
| Pre-existing | ~8 (supplier_profiles, bill_patterns, ar_aging_patterns, invoice_patterns + 4 base) | 8 |
| 11 | inventory_catalog, stock_movements, recon_patterns | 11 |
| 12 | asset_register, depreciation_schedules, entity_hierarchy, consolidation_patterns | 15 |
| 13 | financial_reports, budget_templates, kpi_history | 18 |
| 14 | ocr_extractions, matching_patterns | 20 |
| 15 | forecast_patterns, anomaly_history, compliance_rulings | 23 |
| 16 | (activates DataPoints/ontologies on existing datasets) | 23 |
| 17 | (temporal enrichment on existing datasets) | 23 |
| 18 | cdr_products, cdr_rates, banking_product_knowledge | 26 |
| 19 | market_intelligence, market_sentiment, rba_statistics, abs_statistics, asx_market_data | 31 |
| 20–24 | 0 | 31 |

**Problem**: 31 Cognee datasets with no consolidation strategy, no pruning schedule, and no size limits specified. Wave 17 mentions "memify" for consolidation but doesn't define when or how it runs.

**Impact**: Cognee storage/performance degradation. Each cognify operation becomes more expensive as the graph grows.

**Recommendation**: Add a Cognee governance strategy: maximum datasets per tenant, automated archival of stale datasets, size-based alerts.

### ISSUE C02 — WARNING: Wave 23 Cognee Tenant Isolation Is Retrofitting

Wave 23 says: "Prefix all Cognee datasets with tenant ID: `{tenantId}_transactions`." This means all **31 datasets** must be duplicated per tenant. For 100 tenants, that's 3,100 Cognee datasets.

**Impact**: Massive Cognee storage proliferation in multi-tenant mode. The current Cognee deployment is single-tenant.

**Recommendation**: Wave 23 should specify the Cognee isolation strategy *before* Wave 16–17 create custom DataPoints and ontologies. Consider Cognee namespace partitioning instead of dataset prefixing.

### ISSUE C03 — WARNING: Cognee Datasets Created After Referenced

Some waves reference datasets that are created in the same wave:

- **Wave 11**: Creates `inventory_catalog`, `stock_movements`, `recon_patterns` via Agent 6 (depends on Agent 1 schema). Agent 4 (inventory_agent) needs to index to Cognee but depends on Agent 2 (service), not Agent 6 (Cognee).

**Impact**: Agent 4 may try to use Cognee tools before Agent 6 creates the datasets. However, the sub-wave ordering (Agent 6 runs in sub-wave 2, Agent 4 also in sub-wave 2) means they run **in parallel**, creating a race condition.

**Recommendation**: Either (a) Agent 4 should also depend on Agent 6, or (b) Agent tools should handle missing datasets gracefully.

### ISSUE C04 — INFO: Wave 16 DataPoint Definitions Are Well-Scoped

Wave 16's three custom DataPoints (`FinancialTransaction`, `BusinessRelationship`, `TaxEvent`) are well-defined with clear field lists and relationship types.

---

## 7. Frontend Dependencies

### ISSUE F01 — BLOCKER: TabId Type Will Have 21+ Entries Before Router Migration

As documented in ISSUE A04, every wave from 11–23 adds tabs to the `TabId` union type. The current type has 9 values. By Wave 23, it will have **21 values**, all rendered in a bottom navigation bar designed for 5 items.

**Impact**: UI will be unusable on mobile. Bottom navigation with 21 tabs is architecturally broken.

**Recommendation**: Introduce navigation grouping (e.g., "Finance" submenu for reports/budgets/tax, "Operations" for inventory/assets/documents) starting from Wave 11, or move router migration earlier.

### ISSUE F02 — WARNING: 13 New Feature Folders Created

| Wave | Feature Folders |
|------|----------------|
| 11 | `inventory/`, `reconciliation/` |
| 12 | `assets/`, `entities/` |
| 13 | `reports/`, `budgets/` |
| 14 | `documents/`, `matching/` |
| 15 | `forecasting/`, `compliance/` |
| 16 | `knowledge/` |
| 17 | `intelligence/` |
| 18 | `banking-products/` |
| 19 | `market/` |
| 20 | `admin/` |
| 21 | `streaming/` |
| 22 | `dashboards/` |
| 23 | `tenant/`, `subscription/` |
| 24 | `notifications/`, `offline/` |

**Total**: ~19 new feature folders + existing ones. This is architecturally sound (feature-folder pattern) but creates a large navigation surface.

### ISSUE F03 — WARNING: `client/src/api.ts` Shared File Contention

Waves 11 and up all need to add API client functions to `client/src/api.ts`. The coordination rules for Wave 11 say "Agent 8 first, then Agent 9" but cross-wave locking is unspecified.

**Impact**: Parallel waves will create merge conflicts in `api.ts`.

**Recommendation**: Either (a) split `api.ts` into per-feature API modules (e.g., `api/inventory.ts`, `api/assets.ts`) or (b) use a central API generation approach.

### ISSUE F04 — WARNING: `client/src/App.tsx` Shared File Contention

Same issue as F03 — multiple waves modify `App.tsx` to add routing/tabs.

### ISSUE F05 — INFO: `client/src/components/charts/` (Wave 22) Is Well-Structured

Wave 22's shared chart component library follows good patterns with a dedicated folder, responsive containers, and a gold color palette.

---

## 8. Infrastructure Dependencies

### ISSUE I01 — WARNING: Redis "Ghost Service" Dependency

Wave 17 says: "Enable Redis-backed caching for repeated queries (Redis was ghost service until now)." The docker-compose.yml references Redis, but Waves 11–16 don't use it.

**Impact**: If Redis isn't running or configured properly for Waves 11–16, it doesn't matter. But Wave 17 silently depends on Redis being operational.

**Recommendation**: Wave 17 should include a Redis health check and configuration verification step.

### ISSUE I02 — WARNING: three.js Dependency Chain

- **Wave 16**: `KnowledgeGraphExplorer.tsx` references "3D graph visualization (using three.js/force-graph)"
- **Wave 20**: `CogneeGraphViewer.tsx` with "three.js + 3d-force-graph" (separate from Wave 16)
- **Wave 22**: "D3.js directly (already available via three.js in Wave 20)"

**Problem**: three.js is referenced in 3 different waves with potentially different import patterns. No wave specifies where to install it.

**Recommendation**: Designate one wave (Wave 16 is earliest) as the three.js installer, and subsequent waves should import from a shared location.

### ISSUE I03 — INFO: Docker Service Count Stable

All waves reference the same Docker stack: "5 services: postgres, redis, cognee, server, client." No new services are added across Waves 11–24.

---

## 9. Recommended Reordering

### 9.1 Parallel Execution Opportunities

Based on TRUE data dependencies (not just sequential numbering):

```
PHASE A (After Wave 10):
  ├─ Track 1: Wave 11 → 12 → 13 → 15 (core accounting chain)
  ├─ Track 2: Wave 14 (only needs Wave 7+10, not 11-13)
  └─ Track 3: Wave 16 → 17 (only needs Wave 3)

PHASE B (After Phase A converges):
  ├─ Track 4: Wave 18 → 19 (external data, needs Wave 13)
  ├─ Track 5: Wave 20 (admin, needs Wave 16+17)
  └─ Track 6: Wave 22 (charts, needs Waves 11,13,15)

PHASE C (After Phase B):
  ├─ Track 7: Wave 21 (SDK migration, needs Wave 20)
  └─ Track 8: Wave 23 (multi-tenant, needs Wave 20)

PHASE D (After Phase C):
  └─ Wave 24 (responsive/PWA, needs Wave 22+23)
```

### 9.2 Estimated Time Savings

- **Current serial plan**: 14 waves × ~4-6 hours = ~56-84 hours
- **With parallelization**: ~8 sequential steps × ~5 hours = ~40 hours (estimated 30-50% reduction)

### 9.3 Pre-requisite Actions Before Any Wave

1. **Resolve BLOCKER issues** D01, A01, AG01, S01/S02, F01
2. **Pre-declare all AgentTypes** in a shared registry (fixes AG01)
3. **Introduce navigation grouping** before Wave 11 adds first new tabs (fixes F01)
4. **Split `api.ts`** into per-feature modules before Wave 11 (fixes F03)
5. **Add dual-schema rule** to shared standards document (fixes S02)

---

## 10. Summary Scorecard

| Category | Blockers | Warnings | Info |
|----------|----------|----------|------|
| Dependencies | 2 (D01, D02) | 3 (D03, D04, D05) | 1 (D06) |
| API Contracts | 1 (A01) | 3 (A02, A03, A04) | 2 (A05, A06) |
| Agent Contracts | 1 (AG01) | 3 (AG02, AG03, AG04) | 0 |
| Schema | 2 (S01, S02) | 3 (S03, S04, S05) | 0 |
| Cognee | 0 | 3 (C01, C02, C03) | 1 (C04) |
| Frontend | 1 (F01) | 3 (F02, F03, F04) | 1 (F05) |
| Infrastructure | 0 | 2 (I01, I02) | 1 (I03) |
| **TOTAL** | **7** | **20** | **6** |

### Top 7 Blockers (Must Fix Before Execution)

1. **D01**: Wave 14 dependency contradiction (declared vs actual)
2. **D02**: Wave 22 undeclared dependency on Wave 11
3. **A01**: `/api/forecasts` route collision between Waves 13 and 15
4. **AG01**: AgentType union requires cross-wave locking strategy
5. **S01**: Migration numbering assumes Waves 1–10 complete first (verify)
6. **S02**: Dual schema maintenance rule not enforced in Waves 12–24
7. **F01**: 21+ tabs in BottomNavigation before Wave 24 replaces it
