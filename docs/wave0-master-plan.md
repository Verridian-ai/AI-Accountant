# GoldLedger — Master Plan: Waves 1–24

## Executive Summary

GoldLedger is a 24-wave transformation from a CBA bank statement parser into a comprehensive Australian financial intelligence platform. Waves 1–10 are fully specified in `docs/Agent planning chat.md`. This document covers the complete 24-wave roadmap with detailed specifications for Waves 11–24.

### Key Metrics
| Metric | Waves 1–10 | Waves 11–24 | Total |
|--------|-----------|-------------|-------|
| New DB tables | 58 | ~96 | ~154 |
| New Claude agents | 2 | ~14 | ~16 |
| API endpoints | ~128 | ~220 | ~348 |
| UI components | ~57 | ~120 | ~177 |
| Migrations | 0013–0022 | 0023–0036 | 24 |
| Cognee datasets | ~12 | ~22 | ~34 |

### Architecture Stack
- **Client**: React 18 + TypeScript, TanStack Table/Virtual, Tailwind CSS (neumorphic dark theme)
- **Server**: Hono + Drizzle ORM, SQLite/PostgreSQL dual schema
- **AI**: Claude agents (`ClaudeAgent<TInput, TOutput>`), Cognee knowledge graph (Kuzu + pgvector)
- **Infrastructure**: Docker 5-service topology (postgres, redis, cognee, server, client)
- **Design**: Gold (#FFCC00) accent, `neu-raised`/`neu-inset` neumorphic classes

---

## Phase Map

### Phase 1: Core Infrastructure Enhancement (Waves 1–3)
| Wave | Name | Migration | Key Deliverables |
|------|------|-----------|-----------------|
| 1 | Chat → Agent Bridge & Intent Routing | 0013 | 31 PG table sync, agent intent router, SSE streaming |
| 2 | Transaction Mutation & Streaming | 0014 | Agent mutation framework, real-time updates, audit log |
| 3 | Multi-User Cognee & Custom DataPoints | 0015 | User isolation, Cognee sessions, namespace partitioning |

### Phase 2: Payroll (Waves 4–6)
| Wave | Name | Migration | Key Deliverables |
|------|------|-----------|-----------------|
| 4 | Employee Management & Pay Structures | 0016 | Employee CRUD, pay categories, TFN encryption |
| 5 | Pay Run Processing & Leave Management | 0017 | Pay run engine, leave tracking, accrual calculations |
| 6 | STP Compliance & Payroll Reporting | 0018 | STP Phase 2, payslips, timesheets, award interpretation |

### Phase 3: Invoicing & AR (Waves 7–9)
| Wave | Name | Migration | Key Deliverables |
|------|------|-----------|-----------------|
| 7 | Customer Management & Invoice Generation | 0019 | Customer CRM, invoice engine, `invoice_agent` |
| 8 | Recurring Invoices & Payment Processing | 0020 | Subscription billing, payment gateways, dunning |
| 9 | AR Aging & Multi-Currency | 0021 | Aging reports, FX rates, invoice templates |

### Phase 4: Xero/MYOB Feature Parity (Waves 10–13)
| Wave | Name | Migration | Key Deliverables |
|------|------|-----------|-----------------|
| 10 | Accounts Payable & Purchase Orders | 0022 | AP module, POs, supplier management, `accounts_payable_agent` |
| 11 | Inventory & Bank Reconciliation | 0023 | Inventory tracking, COGS, bank matching engine |
| 12 | Fixed Assets & Multi-Entity Consolidation | 0024 | Depreciation schedules, multi-company consolidation |
| 13 | Financial Reporting & Budgeting | 0025 | P&L, balance sheet, cash flow, budget vs actual |

### Phase 5: AI Intelligence Layer (Waves 14–15)
| Wave | Name | Migration | Key Deliverables |
|------|------|-----------|-----------------|
| 14 | AI Document Processing & Payment Matching | 0026 | OCR pipeline, receipt scanning, auto-matching |
| 15 | Predictive Analytics & Compliance Monitoring | 0027 | Cash flow forecasting, anomaly detection, ATO compliance |

### Phase 6: Knowledge Graph Enhancement (Waves 16–17)
| Wave | Name | Migration | Key Deliverables |
|------|------|-----------|-----------------|
| 16 | Custom DataPoints & Graph Relationships | 0028 | Cognee custom DataPoints, ontology builder, graph viz |
| 17 | Temporal Queries & Cross-Module Intelligence | 0029 | Temporal cognify, cross-module reasoning, unified dashboard |

### Phase 7: External Data & Market Intelligence (Waves 18–20)
| Wave | Name | Migration | Key Deliverables |
|------|------|-----------|-----------------|
| 18 | CDR Open Banking & Loan Comparison | 0030 | CDR PRD crawler, product comparison, rate alerts |
| 19 | Market Intelligence & Sentiment Analysis | 0031 | RBA/ABS feeds, ASX data, last30days integration |
| 20 | Admin Backend & System Dashboard | 0032 | Agent monitoring, Cognee graph 3D viz, user management |

### Phase 8: Platform Evolution (Waves 21–24)
| Wave | Name | Migration | Key Deliverables |
|------|------|-----------|-----------------|
| 21 | Vercel AI SDK Migration & Streaming | 0033 | Hybrid agent framework, structured output, streaming UI |
| 22 | Advanced Visualizations & Chart Library | 0034 | D3/Recharts integration, interactive dashboards |
| 23 | Multi-Tenant & Access Control | 0035 | Tenant isolation, RBAC, subscription tiers |
| 24 | Mobile Responsive & PWA | 0036 | Responsive layout, offline support, push notifications |

---

## Dependency Graph (Optimized)

```
Phase 1: Wave 1 → Wave 2 → Wave 3 ─┬→ Phase 2: Wave 4 → Wave 5 → Wave 6 ──────────────┐
                                     ├→ Phase 3: Wave 7 → Wave 8 → Wave 9 ──────────────┤
                                     ├→ Phase 4: Wave 10 → Wave 11 → Wave 12 → Wave 13 ─┤
                                     └→ Phase 6: Wave 16 → Wave 17                       │
                                                                                          ├→ Phase 5: Wave 14 → Wave 15
                                                                                          ├→ Phase 7: Wave 18 → Wave 19 → Wave 20
                                                                                          └→ Phase 8: Wave 21 → Wave 22 → Wave 23 → Wave 24
```

**Key insight**: Phases 2, 3, 4, and 6 can run in parallel after Wave 3. Phase 5 requires Phases 3+4 (invoices + bills for payment matching). Phase 7 requires stable base. Phase 8 is the final evolution layer.

---

## Wave 11–24 Specifications

### Migration Numbering
| Wave | Migration File |
|------|---------------|
| 11 | `docker/migrations/0023_inventory_bank_recon.sql` |
| 12 | `docker/migrations/0024_fixed_assets_multi_entity.sql` |
| 13 | `docker/migrations/0025_financial_reporting_budgets.sql` |
| 14 | `docker/migrations/0026_ai_ocr_payment_matching.sql` |
| 15 | `docker/migrations/0027_predictive_compliance.sql` |
| 16 | `docker/migrations/0028_cognee_custom_datapoints.sql` |
| 17 | `docker/migrations/0029_temporal_cross_module.sql` |
| 18 | `docker/migrations/0030_cdr_open_banking.sql` |
| 19 | `docker/migrations/0031_market_intelligence.sql` |
| 20 | `docker/migrations/0032_admin_dashboard.sql` |
| 21 | `docker/migrations/0033_vercel_ai_sdk.sql` |
| 22 | `docker/migrations/0034_advanced_visualizations.sql` |
| 23 | `docker/migrations/0035_multi_tenant.sql` |
| 24 | `docker/migrations/0036_mobile_pwa.sql` |

### Agent Projection (Complete)
| Wave | New Agents | Names |
|------|-----------|-------|
| 11 | 2 | `inventory_agent`, `bank_reconciler_agent` |
| 12 | 2 | `asset_management_agent`, `multi_entity_agent` |
| 13 | 2 | `financial_reporting_agent`, `budgeting_agent` |
| 14 | 2 | `ocr_processing_agent`, `payment_matching_agent` |
| 15 | 2 | `compliance_monitoring_agent`, `forecasting_agent` |
| 16 | 0 | (Cognee DataPoint configuration, no agents) |
| 17 | 0 | (Cognee temporal layer, no agents) |
| 18 | 1 | `cdr_product_agent` |
| 19 | 1 | `market_intelligence_agent` |
| 20 | 0 | (Admin UI, no new agent) |
| 21 | 0 | (SDK migration, wraps existing agents) |
| 22 | 0 | (Visualization, no agents) |
| 23 | 1 | `tenant_routing_agent` |
| 24 | 0 | (Mobile/PWA, no agents) |

**Total new agents (Waves 11–24)**: 13
**Grand total agents**: 11 (existing) + 2 (Waves 1–10) + 13 (Waves 11–24) = **26**

---

## Coordination Rules (All Waves)

1. **No file conflicts**: Only ONE agent may modify a given file at a time
2. **Signal completion**: Marker files `.agent-done-W{wave}-{number}` for dependency tracking (wave-prefixed to avoid cross-wave collisions)
3. **Schema lock**: Only designated schema agents touch `schema.ts` and `postgres-schema.ts`
4. **Dual schema**: Every table change applied to BOTH SQLite and PostgreSQL schemas
5. **Pattern compliance**: All agents extend `ClaudeAgent<TInput, TOutput>` base class
6. **Docker-local**: Everything runs on local Docker (5-service topology, no new containers)
7. **Test before done**: Every agent verifies `cd server && npx tsc --noEmit`
8. **Migration ordering**: Sequential numbering 0023–0036, never skip or reorder
9. **Cognee namespace**: UNIVERSAL_DATASETS naming convention for cross-module datasets
10. **Security**: Encrypt PII fields (TFNs, bank details) at rest using AES-256-GCM

---

## Debate Findings & Resolutions (Post-Review Revision)

This section summarizes findings from the 5-reviewer debate process (D01–D05) conducted on 2026-02-12, and the resolutions applied to wave plans.

### D01: Architecture Review — Key Resolutions

| # | Finding | Severity | Resolution | Waves Affected |
|---|---------|----------|------------|----------------|
| 1 | **index.ts will become unmaintainable** at 350+ endpoints / 12K+ lines | P0 | ACKNOWLEDGED: Pre-Wave-11 refactor into Hono route modules (`app.route()`) is recommended but not blocking. Each wave should add endpoints as route modules if the refactor has been done, or append to index.ts if not | All |
| 2 | **Drop SQLite, go PostgreSQL-only** | P0 | ACKNOWLEDGED: Recommended before Wave 13 (complex JOINs). Dual schema rule remains enforced but SQLite is the deprecation target. Waves should NOT add SQLite-specific code (like sqlite JSON1 functions) |  All |
| 3 | **Move navigation to sidebar + React Router BEFORE Wave 24** | P0 | ACKNOWLEDGED: D01 recommends Wave 11. Each wave adds tabs to BottomNavigation but should group them (Finance/Operations/Analytics/AI) to avoid 21-tab sprawl. Wave 24 finalizes router migration | 11–24 |
| 4 | **Agent proliferation: target ≤18, not 26** | P1 | NOTED for implementation: `budgeting_agent` may extend existing `budget_analyzer`. `multi_entity_agent` may become middleware. `tenant_routing_agent` (Wave 23) should be auth middleware. `forecasting_agent` should consider statistical libraries over LLM | 11–15, 23 |
| 5 | **Unified Cognee search tool** (reduce ~60 tools to ~40) | P1 | NOTED: Create a single `search_cognee` tool with `domain` parameter shared across agents | 11–20 |
| 6 | **No testing framework configured** | P0 | ACKNOWLEDGED: Vitest for unit/integration + Playwright for E2E should be added pre-Wave 11. Each wave should ship with unit tests for financial calculations | All |
| 7 | **API cost budgeting needed** | P1 | Added to Wave 20 admin dashboard: per-user daily token budget + per-agent usage analytics | 20, 23 |

### D02: Security Review — Key Resolutions

| # | Finding | Severity | Resolution | Waves Affected |
|---|---------|----------|------------|----------------|
| 1 | **Cognee auth disabled until Wave 23** | HIGH | Pre-Wave-11: Remove host port exposure for postgres/redis/cognee. Enable Cognee service token auth. Move credentials to env vars | Pre-11 |
| 2 | **TFN stored in plaintext** in `entities` table | HIGH | Added to Wave 12: MANDATORY AES-256-GCM encryption for TFN column, masked display, audit-logged access | 12 |
| 3 | **No encryption at rest** for financial data | HIGH | ACKNOWLEDGED: PostgreSQL TDE or volume-level encryption recommended for production. Application-level encryption mandatory for TFN/BSB/account numbers | All |
| 4 | **Admin has no RBAC until Wave 23** | HIGH | Added to Wave 20: Basic role middleware (super_admin/admin/viewer) required before admin endpoints. Forward-compatible with Wave 23 full RBAC | 20 |
| 5 | **Zod validation missing for new endpoints** | HIGH | Added to all wave coordination rules: Every new endpoint MUST use Zod schemas via `zValidator` middleware | 11–24 |
| 6 | **Budget columns use calendar year** (jan-dec) | MEDIUM | Fixed in Wave 13: `budget_lines` columns reordered to jul→jun for Australian FY alignment | 13 |
| 7 | **OCR path traversal risk** | MEDIUM | Added to Wave 14: Server-side UUID filenames, flat directory, magic bytes validation | 14 |
| 8 | **No user data deletion mechanism** | HIGH | NOTED: `DELETE /api/users/:id/data` endpoint should be added (Privacy Act compliance). Not yet assigned to a wave | Future |

### D03: Scalability Review — Key Resolutions

| # | Finding | Severity | Resolution | Waves Affected |
|---|---------|----------|------------|----------------|
| 1 | **No job queue for long-running operations** | CRITICAL | ACKNOWLEDGED: BullMQ (Redis-backed) recommended pre-Wave 13. All long-running endpoints (report generation, OCR, CDR crawl, anomaly scan) flagged in wave plans as MUST-BE-ASYNC | 13–19 |
| 2 | **Missing indexes for planned features** | MEDIUM | Added index discipline to coordination rules. Each migration MUST include CREATE INDEX for composite query patterns | 11–24 |
| 3 | **3D graph viz unbounded** | HIGH | Added to Waves 16+20: Max 2,000 nodes, LOD, server-side graph pagination, dataset-level summary as default view | 16, 20 |
| 4 | **Pagination not standardized** | MEDIUM | Added standard pagination pattern (`?page=1&limit=50`) to coordination rules. All list endpoints must support it | 11–24 |
| 5 | **Redis ghost service** | LOW | ACKNOWLEDGED: Wire Redis in Wave 11 or 17 for immediate caching benefits | 11 or 17 |

### D04: Integration Review — Key Resolutions

| # | Finding | Severity | Resolution | Waves Affected |
|---|---------|----------|------------|----------------|
| 1 | **Wave 14 dependency contradiction** | BLOCKER | Clarified: Wave 14 data dependency is Waves 7+10 only. CAN run parallel with 11-13 | 14 |
| 2 | **Wave 22 undeclared dependency on Wave 11** | BLOCKER | Fixed: Wave 22 declared dependencies now include Waves 11, 13, 15, 19. Chart components built defensively | 22 |
| 3 | **`/api/forecasts` route collision** (Waves 13 vs 15) | BLOCKER | Fixed: Wave 13 forecast routes renamed to `/api/budget-forecasts/*` | 13, 15 |
| 4 | **AgentType union cross-wave locking** | BLOCKER | ACKNOWLEDGED: Pre-declare all agent types in a registry wave OR switch to runtime string validation. Current sequential execution avoids conflict but parallel phases need coordination | 11–23 |
| 5 | **21+ tabs in BottomNavigation** | BLOCKER | ACKNOWLEDGED: Navigation grouping needed. Each wave should add tabs to logical groups (Finance, Operations, Analytics, AI) rather than flat list | 11–23 |
| 6 | **Audit trail vs audit_log table conflict** | WARNING | Resolved in Wave 15: `audit_trails` replaces `audit_log`. Existing data migrated | 15 |
| 7 | **Wave 11 marker naming collision** | P0 | Fixed: All Wave 11 markers renamed to `.agent-done-W11-{NN}` format | 11 |

### D05: Completeness Review — Key Resolutions

| # | Finding | Severity | Resolution | Waves Affected |
|---|---------|----------|------------|----------------|
| 1 | **Missing Xero features**: Projects/Job Costing, Expense Claims, Live Bank Feeds | P2 | NOTED: Consider as future Wave 25+ items | Future |
| 2 | **No cross-wave integration tests** | P1 | ACKNOWLEDGED: Each wave's Agent 10 validates only that wave. A cross-wave integration test plan is needed after each phase completes | All |
| 3 | **`types.ts` concurrent modification risk** | P1 | ACKNOWLEDGED: Parallel phases must coordinate `types.ts` modifications. Pre-declaring all agent types is recommended | All |
| 4 | **No error recovery for failed agents** | P2 | NOTED: If an agent fails, downstream agents are permanently blocked. Manual retry mechanism should be documented | All |
| 5 | **Only tsc --noEmit for testing, no runtime tests** | P1 | ACKNOWLEDGED: Vitest + Playwright should be configured pre-Wave 11 | All |

### Parallelization Opportunities (from D04 §9)

Based on TRUE data dependencies:
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

Estimated time savings: ~30-50% reduction from parallel execution.

---

## Per-Wave Detailed Specs

Each wave's full specification (10-point format) is in its orchestration prompt:
- `wave{N}-orchestration-prompt.md` — Team coordination and execution order
- `wave{N}-agent-tasks/01-*.md` through `wave{N}-agent-tasks/10-*.md` — Atomic task files
- `launch-wave{N}.sh` — tmux launcher script

See individual wave directories for complete specifications.
