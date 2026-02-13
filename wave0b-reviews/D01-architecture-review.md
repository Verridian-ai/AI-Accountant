# D01: Architecture Devil's Advocate Review — Waves 1–10

**Reviewer**: Agent D01 (Architecture Devil's Advocate)
**Date**: 2026-02-13
**Scope**: All 10 wave orchestration prompts + sampled agent task files (20+ files reviewed)
**Methodology**: Adversarial review of architecture decisions, backward compatibility, security, and scalability

---

## 1. CRITICAL ISSUES (Must-Fix — HIGH Severity)

### CRIT-01: SQL Injection in MutationTools `executeUpdate()` / `executeCreate()` / `executeDelete()`

**Wave**: 2, Task File: `02-mutation-tools-service.md`
**Severity**: P0 — CRITICAL SECURITY VULNERABILITY

The `MutationTools` class constructs SQL via string interpolation of **agent-provided table and column names**:

```typescript
// executeUpdate():
const setClause = columns.map((col) => `${col} = ?`).join(', ');
await this.db.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, targetId]);

// executeCreate():
await this.db.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);

// executeDelete():
await this.db.run(`DELETE FROM ${table} WHERE id = ?`, [targetId]);
```

An agent with a malformed or adversarial `targetTable` or column name (e.g., `"transactions; DROP TABLE users; --"`) would allow SQL injection. While agents are internal, this violates defense-in-depth. The `table` and column names come from `MutationProposal.targetTable` and `afterState` keys — both from agent output which could be influenced by prompt injection.

**Required Fix**:
1. Whitelist allowed table names: `const MUTABLE_TABLES = ['transactions', 'accounts', ...] as const;`
2. Validate column names against known schema columns
3. Reject any table/column not in the whitelist
4. Use parameterized queries for ALL values (already done for values, but table/column names cannot be parameterized in SQL)

---

### CRIT-02: Migration Number Conflicts with Existing Migrations

**Waves**: 1–10 (migrations 0013–0022)
**Severity**: P0 — WILL BREAK DEPLOYMENT

The existing migration directory contains:
```
0009_complete_schema.sql
0010_add_missing_columns.sql
0011_final_schema_sync.sql
0012_tax_return_platform.sql
0023_inventory_bank_recon.sql
0024_fixed_assets_multi_entity.sql
0025_financial_reporting.sql
0026_ai_ocr_payment_matching.sql
0028_cognee_datapoints.sql
0029_temporal_intelligence.sql
```

Waves 1–10 plan to create migrations **0013–0022**. But **migrations 0023–0029 already exist** from Waves 11–17 (partially executed). This means:
- Migration 0022 (Wave 10: AP) will be applied **before** 0023 (Wave 11: Inventory) — correct ordering.
- However, `0013` through `0022` need to slot in between `0012` and `0023`.
- **If the migration runner applies in filename order**, it will try to apply 0013 AFTER 0023–0029, which already reference tables that 0013 creates.

**Required Fix**:
1. Verify the migration runner applies in **numeric filename order** (not modification date)
2. Document that Waves 11–17 migrations (0023–0029) were created out-of-order and may have implicit dependencies on 0013–0022 tables
3. Alternatively, consider re-numbering Waves 11–17 migrations to 0033–0039 to eliminate ambiguity, OR apply 0013–0022 FIRST in a separate step before any Wave 11+ re-execution

---

### CRIT-03: Pagination Inconsistency Across Waves

**Waves**: 1, 4, 5, 7, 8, 9, 10
**Severity**: P0 — API CONTRACT CONFLICT

Two different pagination patterns are specified:
- **Waves 1, 5, 6**: `?offset=0&limit=50` returning `{ data: T[], total: number }`
- **Waves 4, 7, 9, 10**: `?page=1&limit=50` returning `{ data: T[], total: number }`

These are **incompatible** APIs. Frontend developers must know which pattern each endpoint uses. Existing codebase uses `?offset=0&limit=50` (e.g., `fetchTransactions` returns `{ transactions, total }`).

**Required Fix**:
- Standardize ALL new endpoints to ONE pattern (recommend `?offset=0&limit=50` to match existing codebase convention)
- OR document a migration path from page-based to offset-based
- Update coordination rules in ALL wave prompts to specify the chosen standard

---

### CRIT-04: `index.ts` Concurrent Modification — Single File, Multiple Waves

**Waves**: 1–10 (every wave touches index.ts)
**Severity**: P0 — WILL CAUSE MERGE CONFLICTS

The `server/src/index.ts` file currently has 243 route handlers. Every wave adds more endpoints directly to this file:
- Wave 1: +9 endpoints
- Wave 2: +6 endpoints
- Wave 3: +4 endpoints
- Wave 4: +15 endpoints
- Wave 5: +15 endpoints
- Wave 6: +18 endpoints
- Wave 7: +17 (via route file, but still mounts in index.ts)
- Wave 8: +13 endpoints
- Wave 9: +12 endpoints
- Wave 10: +22 endpoints

That's **131 new endpoints** being added to a file that already has 243. This file will be **~3000+ lines** after Wave 10. Every wave modifies it, creating sequential bottlenecks and merge conflict risks.

**Required Fix**:
- **Mandate route file extraction** starting Wave 1: All new endpoints go in route files under `server/src/routes/` (e.g., `chat-routes.ts`, `payroll-routes.ts`, `invoicing-routes.ts`, `ap-routes.ts`)
- Wave 7 already does this (`invoicing-routes.ts`) — this pattern should be universal
- `index.ts` only mounts route files: `app.route('/api', chatRoutes); app.route('/api', payrollRoutes);`

---

### CRIT-05: 21 Existing Agents — 2 New Agents in Waves 1–10 — But IntentRouter Lists ALL

**Waves**: 1 (intent router), 7 (invoice_agent), 10 (accounts_payable_agent)
**Severity**: HIGH — POTENTIAL ROUTING FAILURES

The IntentRouter in Wave 1 lists 21 agents in its system prompt. But Waves 7 and 10 add `invoice_agent` and `accounts_payable_agent` respectively. The IntentRouter won't know about these new agents unless it's updated.

**Required Fix**:
- IntentRouter system prompt must be **dynamically generated** from the orchestrator's agent registry, not hardcoded
- Add `getRegisteredAgents()` method to Orchestrator that returns agent metadata
- IntentRouter.classify() should call this before each classification to get the current agent list
- Alternatively: Wave 7 and Wave 10 must explicitly update the IntentRouter's agent mapping

---

## 2. DESIGN CONCERNS (Should-Fix — MEDIUM Severity)

### DC-01: Dual Schema Sustainability — Why Not Just PostgreSQL?

**All Waves**
**Impact**: Every new table requires definition in BOTH `schema.ts` (sqliteTable) AND `postgres-schema.ts` (pgTable)

The codebase uses `sqliteTable()` for ALL schema definitions even though production runs on PostgreSQL via `wrapPgDb()`. This dual-schema pattern means:
- Every wave agent that creates tables must create TWO schema definitions
- Type mismatches between SQLite and PG (INTEGER vs BOOLEAN, TEXT vs TIMESTAMP) create subtle bugs
- `wrapPgDb()` returns `any`, so there's no type safety at runtime anyway
- Drizzle already supports PostgreSQL natively — the SQLite layer adds no value

**Recommendation**: Wave 1 (migration 0013) already syncs 33 tables to PG. This is the ideal point to:
1. Mark `schema.ts` as deprecated for new development
2. Wave 1+ creates tables ONLY in `postgres-schema.ts`
3. `wrapPgDb()` wrapper should return typed Drizzle PG client instead of `any`
4. SQLite tables remain for backward compat but no new tables added

**Counter-argument**: This is a large refactor. If the team disagrees, the dual-schema pattern is tolerable but adds ~30% overhead per wave.

---

### DC-02: Tab Navigation Will Not Scale — 19 + 3 = 22+ Tabs

**Waves**: 4 (payroll), 7 (invoicing), 10 (AP)
**Impact**: Mobile unusable, desktop cluttered

Current `TabId` type has 19 values. Waves 4, 7, and 10 add `payroll`, `invoicing`, and `ap` respectively. That's 22+ tabs.

The BottomNavigation component shows only 4 tabs on mobile (dashboard, transactions, accounts, analytics) with the rest accessible via a "Menu" button. Desktop shows all tabs. At 22+ tabs:
- Desktop: Horizontal scrolling or wrapping required
- The hamburger menu becomes a long unstructured list
- Users can't find features

**Recommendation**:
- Group tabs into categories: **Core** (dashboard, transactions, accounts), **Finance** (analytics, gst, tax, bas), **Operations** (payroll, invoicing, ap), **Intelligence** (knowledge, intelligence, reports)
- Implement a sidebar navigation for desktop (medium screens+) while keeping bottom nav for mobile
- OR implement a tab overflow dropdown with search

---

### DC-03: Haiku for Intent Classification — Speed vs Accuracy Tradeoff

**Wave**: 1 (IntentRouter)
**Impact**: Misrouted queries degrade user experience

The plan uses Claude Haiku for intent classification (~100ms, ~$0.001/call). This is fast and cheap, but:
- Ambiguous queries like "prepare my taxes" could route to `tax_strategy`, `personal_tax_claims`, `gst_calculator`, or `financial_reporting`
- Multi-intent messages ("Show my invoices and calculate BAS") have no handling — the classification returns a single `primaryAgent`
- The `multi_agent` intent type exists but has no clear execution pipeline for chaining agents

**Recommendation**:
1. Add a **rule-based pre-filter** before the LLM classification for common patterns (e.g., "BAS" → `gst_calculator`, "payslip" → `payroll_agent`)
2. For multi-intent messages, split the query and classify each part independently
3. Add an `ambiguous` intent type that triggers a clarification question back to the user
4. Log all classifications with user feedback to build a training set for fine-tuning

---

### DC-04: Missing Rate Limiting for 131 New API Endpoints

**All Waves**
**Impact**: Every new endpoint is a potential DoS vector

The audit remediation added rate limiting to existing endpoints, but the 131 new endpoints across Waves 1–10 don't specify rate limit configuration. The coordination rules mention "Zod validation" but NOT rate limiting.

**Recommendation**:
- Add a rate limit rule to ALL coordination rules: "All new endpoints must use the existing rate limiter middleware"
- Specify per-route limits:
  - Read endpoints: 100 req/min
  - Write endpoints: 30 req/min
  - Sensitive endpoints (TFN access, payment processing): 10 req/min
  - Streaming endpoints: 10 concurrent connections

---

### DC-05: No Error Handling Strategy Across Waves

**All Waves**
**Impact**: Inconsistent error responses, debugging difficulty

Each wave creates services independently with ad-hoc error handling. There's no standardized:
- Error class hierarchy (e.g., `NotFoundError`, `ValidationError`, `ConflictError`)
- Error response format (some return `{ error: string }`, others `{ answer: string }`)
- Error logging pattern (some use `console.error`, others swallow errors)

**Recommendation**:
- Wave 1 should create a shared `server/src/errors.ts` with typed error classes
- All routes should use a global error handler that formats errors consistently
- Hono provides `app.onError()` — wire it up in Wave 1

---

### DC-06: Cognee Dataset Explosion — 12+ New Datasets in Waves 1–10

**Waves**: 3, 4, 5, 6, 7, 8, 9, 10
**Impact**: Cognify becomes expensive, cross-dataset search becomes slow

Each wave adds 1–3 new Cognee datasets. By Wave 10:
- Original: 27 datasets
- Wave 3: +2 (employee_profiles, pay_structures → actually Wave 4)
- Wave 4: +2 (employee_profiles, pay_structures)
- Wave 5: +2 (pay_run_history, leave_patterns)
- Wave 6: +3 (stp_compliance, award_rates, timesheet_patterns)
- Wave 7: +2 (customer_profiles, invoice_history)
- Wave 8: +1 (payment_patterns)
- Wave 9: +1 (ar_aging_patterns)
- Wave 10: +2 (supplier_profiles, bill_patterns)

Total: 27 + 15 = **42 datasets**. With per-user prefixing (Wave 3), this becomes `42 × users` datasets. Each `cognify()` call processes an entire dataset. With 42+ datasets, a full cognify cycle could take hours.

**Recommendation**:
- Implement lazy cognification — only cognify when data changes, not on every add
- Batch cognify into a background job (already partially done)
- Consider dataset consolidation: `employee_profiles` + `pay_structures` → `payroll_data`
- Set a hard limit on dataset count per user (e.g., 30)

---

### DC-07: No Observability / Tracing Infrastructure

**All Waves**
**Impact**: Production debugging will be extremely difficult

21+ agents, 374+ endpoints, 42+ Cognee datasets — but no:
- Structured logging (currently `console.log` / `console.error`)
- Request ID propagation across agent invocations
- Distributed tracing (OpenTelemetry)
- Performance metrics (latency histograms, error rates)
- Agent invocation dashboards (beyond the basic `/api/agents/status` in Wave 1)

**Recommendation**:
- Wave 1 should add a `requestId` middleware that tags every request
- Pass `requestId` through IntentRouter → AgentDispatcher → Agent → MutationTools
- Consider pino for structured logging (JSON format, compatible with Docker log aggregation)
- Add agent metrics: invocations/sec, avg latency, error rate per agent

---

### DC-08: FY2024-25 Tax Tables Will Be Outdated

**Wave**: 5 (PAYG Calculator)
**Impact**: Incorrect tax withholding when ATO updates rates

The PAYG calculator hardcodes FY2024-25 tax brackets. Australia updates tax tables annually. For FY2025-26:
- Stage 3 tax cuts already changed brackets (from 1 Jul 2024)
- Super guarantee rate increases annually (11.5% → 12% in FY2025-26)

**Recommendation**:
- Store tax brackets in a database table (`tax_brackets` — already exists in schema!) instead of hardcoding
- Add a financial year parameter to all calculations
- Create a `tax-tables.ts` configuration file that's easily updated
- Super rate should be configurable via environment variable

---

### DC-09: Wave 3 Enables Cognee Authentication — Breaks All Existing Callers

**Wave**: 3 (docker config changes)
**Impact**: Enabling `REQUIRE_AUTHENTICATION=true` on Cognee will break all existing calls using the admin token pattern

Wave 3 changes Docker config to `REQUIRE_AUTHENTICATION=true` and `ENABLE_BACKEND_ACCESS_CONTROL=true`. This is a **breaking change** for all existing code that assumes auth is disabled.

The mitigation is that `getAuthToken()` falls back to admin token, but:
- The admin token format may change when auth is enabled
- Cognee may reject the previous token format
- All existing Wave 11–17 services that call CogneeClient don't pass userId

**Recommendation**:
- Add a migration step that refreshes/re-authenticates the admin user after enabling auth
- Test all existing Cognee calls with auth enabled BEFORE Wave 3 deployment
- Consider making this a Wave 3 sub-task with explicit verification

---

## 3. SUGGESTIONS (Nice-to-Have — LOW Severity)

### SUG-01: Agent Task File Marker Naming Inconsistency

Marker naming varies across waves:
- Wave 1: `.agent-done-W1-01` (no zero-pad on wave number)
- Wave 3: `.agent-done-W03-01` (zero-padded)
- Wave 5: `.agent-done-W05-01` (zero-padded)
- Wave 8: `.agent-done-W08-01` (zero-padded) + `.agent-done-wave8` (completion marker)

This has already been partially fixed by D05 debate findings, but Wave 1 and Wave 2 still use un-padded naming (`W1-`, `W2-`). These should be standardized to `W01-`, `W02-`.

---

### SUG-02: PDF Generation — `pdf-lib` Is Low-Level

Wave 7 uses `pdf-lib` for invoice PDFs. While this avoids Chromium, `pdf-lib` requires manual positioning of every text element, line, and shape. For complex invoices with variable-length line items, this is error-prone.

**Alternative**: Consider `@react-pdf/renderer` for more declarative PDF generation, or HTML-to-PDF via `jspdf` + `html2canvas` (both pure JS, no Chromium).

---

### SUG-03: Wave 8 Stripe Integration — PaymentIntent Without Client Confirmation

Wave 8's Stripe integration creates a `PaymentIntent` server-side without client-side confirmation (no Stripe Elements). This means:
- The payment is charged immediately without the user entering card details
- This only works if the customer has a saved payment method

**Recommendation**: Either:
1. Add client-side Stripe Elements for card collection
2. Or clearly document that Wave 8 Stripe is for "push payments" (server-initiated) only, not customer self-service

---

### SUG-04: Batch Operations Need Progress Tracking

Wave 2's `batchProposeMutations()` processes proposals sequentially in a loop. For 100+ transactions, this could take 10+ seconds with no progress feedback.

**Recommendation**: Add batch progress events (`batch_progress: { completed: 50, total: 100 }`) via SSE.

---

### SUG-05: Consider Route File Conventions Early

Wave 7 creates `invoicing-routes.ts`, Wave 8 creates `payments-routes.ts`. Without a naming convention, routes could end up as:
- `invoicing-routes.ts` vs `payroll-routes.ts` vs `agent-routes-extended.ts` vs inline in `index.ts`

**Recommendation**: Establish a convention: `{domain}-routes.ts` mounted at `/api/{domain}/*`.

---

### SUG-06: Wave 10 AP Depends on Wave 3, Not Wave 9 — Good!

The master plan correctly identifies that Wave 10 (AP) can run in parallel with Waves 7–9 (Invoicing), both depending only on Wave 3. This is efficient parallelization. However, Wave 10's "Current State (After Wave 3)" section lists "5 migrations (0009–0015) applied" — this implies it runs immediately after Wave 3, but the migration count should account for 0009–0012 + 0023–0029 = 10 existing migrations + 0013–0015 = 13 total.

---

### SUG-07: Wave 9 Exchange Rates — External API Not Specified

Wave 9 mentions "refresh rates from external API" but doesn't specify which API. Common options:
- European Central Bank (ECB): Free, no API key, XML format
- Open Exchange Rates: Freemium, JSON, 1000 req/month free
- Fixer.io: Freemium, EUR base only on free tier

**Recommendation**: Specify the API in the task file, or make it configurable via env var `EXCHANGE_RATE_API`.

---

## 4. PER-WAVE VERDICT

| Wave | Name | Verdict | Rationale |
|------|------|---------|-----------|
| **1** | Chat→Agent Bridge & Intent Routing | **NEEDS REVISION** | CRIT-01 (SQL injection in mutation tools is Wave 2, but IntentRouter hardcodes agent list — CRIT-05), CRIT-03 (pagination inconsistency), CRIT-04 (index.ts bloat). Must extract routes into files, dynamically generate agent list. |
| **2** | Transaction Mutation & Streaming | **NEEDS REVISION** | CRIT-01 (SQL injection in MutationTools — must whitelist tables/columns), DC-05 (error handling). Otherwise well-designed mutation lifecycle. |
| **3** | Multi-User Cognee & Custom DataPoints | **NEEDS REVISION** | DC-09 (enabling auth breaks existing callers — needs migration strategy). Good backward compat approach with optional userId. |
| **4** | Employee Management & Pay Structures | **APPROVE** | Well-specified, TFN encryption handled correctly, clear separation of concerns. Minor: pagination says `?page=1&limit=50` vs offset pattern (CRIT-03). |
| **5** | Pay Run Processing & Leave Management | **APPROVE** | Thorough PAYG tables, correct ATO rates. Good leave accrual design. DC-08 (hardcoded tax rates) is a concern but acceptable for v1. |
| **6** | STP Compliance & Payroll Reporting | **APPROVE** | STP Phase 2 spec is detailed and correct. Mock ATO endpoint is appropriate. Payslip HTML-to-string approach is pragmatic. |
| **7** | Customer Management & Invoice Generation | **APPROVE** | Good use of route file (`invoicing-routes.ts`). Table names match Wave 12/14 expectations. `pdf-lib` is functional. New `invoice_agent` is well-scoped. |
| **8** | Recurring Invoices & Payment Processing | **APPROVE** (conditional) | Stripe integration is server-side only — documented clearly. Dunning is well-designed. Conditional on SUG-03 being documented. |
| **9** | AR Aging & Multi-Currency | **APPROVE** | Aging buckets are standard (current/30/60/90+). Exchange rate caching via Redis is correct. Good GST sales summary addition. |
| **10** | Accounts Payable & Purchase Orders | **APPROVE** | Three-way matching is well-specified. Table names match Wave 11 expectations. Agent I/O contract is clear. |

---

## 5. CROSS-CUTTING SUMMARY

### Issues by Priority

| Priority | Count | Issues |
|----------|-------|--------|
| P0 Critical | 5 | CRIT-01 (SQL injection), CRIT-02 (migration order), CRIT-03 (pagination), CRIT-04 (index.ts bloat), CRIT-05 (hardcoded agent list) |
| P1 High | 9 | DC-01 through DC-09 |
| P2 Low | 7 | SUG-01 through SUG-07 |

### Waves Requiring Revision

1. **Wave 1**: Must address CRIT-04 (route extraction), CRIT-05 (dynamic agent list)
2. **Wave 2**: Must address CRIT-01 (SQL injection whitelist)
3. **Wave 3**: Must address DC-09 (auth migration strategy)
4. **All Waves**: Must address CRIT-03 (standardize pagination to offset-based)

### What's Done Well

- **Backward compatibility** is extensively documented and enforced (BC-01 through BC-10)
- **Dual schema** coordination rules prevent concurrent modification
- **Monetary amounts** consistently use INTEGER (cents) — no floating-point money
- **Zod validation** mandated for all new endpoints
- **Dependency graph** is well-optimized (Waves 4–6, 7–9, 10 can run in parallel)
- **Cognee integration** is additive (new datasets, not replacing existing)
- **Agent mutation framework** (Wave 2) is architecturally sound — propose/confirm/execute is the right pattern
- **Australian-specific compliance** (PAYG tables, STP Phase 2, NES leave, super guarantee) is detailed and correct

---

*Review completed 2026-02-13. All 10 wave orchestration prompts and 20+ agent task files analyzed.*
