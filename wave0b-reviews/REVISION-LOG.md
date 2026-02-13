# Wave 0B Phase D — Revision Log

**Date**: 2026-02-13
**Phase**: D (Final Revision Pass)
**Reviewer**: Phase D Lead Agent
**Input**: 5 debate review files (D01-D05)
**Scope**: Wave 1-10 orchestration prompts, launch scripts, agent task files

---

## Summary

Phase D incorporated HIGH and CRITICAL severity findings from all 5 debate reviews into the Wave 1-10 planning files. The majority of revisions were already applied during a prior partial pass (tagged with `REVISION NOTE:` annotations). This final pass identified and fixed **6 remaining gaps** that were missed.

### Statistics

| Metric | Count |
|--------|-------|
| Debate reviews analyzed | 5 (D01-D05) |
| CRITICAL findings across all reviews | 10 |
| HIGH findings across all reviews | 15+ |
| MEDIUM findings across all reviews | 13+ |
| LOW findings across all reviews | 11+ |
| Files modified in this pass | 12 |
| Orchestration prompts updated | 10 (all waves) |
| Launch scripts fixed | 2 (Wave 2, Wave 8) |

---

## Prior Revisions (Already Applied Before This Pass)

The following findings were already incorporated into wave files before this Phase D pass:

### Wave 1 (Chat→Agent Bridge)
- D02-CRIT-01: Authentication middleware section added
- D02-SEC-03: CSRF protection section added
- D04-MARKER-01 / D05-L-02: Marker naming standardized to `W01-`
- D01-DC-05: Error handling pattern with typed error classes
- D01-CRIT-04: Route extraction mandate (agent-routes-extended.ts)
- D01-CRIT-02 / D04-DEP-01: Migration 0013 idempotency (IF NOT EXISTS)

### Wave 2 (Transaction Mutation & Streaming)
- D02-CRIT-02: `agent_sessions.user_id` changed from NULL to NOT NULL
- D01-CRIT-01: SQL injection whitelist section (MUTABLE_TABLES, column validation)
- D02-CRIT-02: User identity binding for mutation confirm/reject
- D02-SEC-03: CSRF protection
- D02-SEC-07: Audit log data redaction
- D04-MARKER-01 / D05-L-02: Marker naming standardized to `W02-`
- D01-DC-05: Error handling for mutations
- D04-CONSIST-06: Zod validation coordination rule
- D03-B1: SSE connection cleanup + EventBus abstraction

### Wave 3 (Multi-User Cognee)
- D02-CRIT-03: Cognee password → refresh token storage (not password)
- D01-DC-09: Auth remains disabled for gradual migration (Phase 1)
- D03-S5: LRU-bounded token cache (1000 entries, 5-min sweep)
- D03-B3: Shared + private dataset strategy (reduces 35x to ~15x per user)

### Wave 4 (Employee Management)
- D02-CRIT-01: Auth middleware requirement
- D02-SEC-01: TFN encryption fail-fast in production
- D02-COMP-02: Super guarantee rate configurable via env var
- D05-H-05: Error handling for bank detail validation
- D02: BSB encryption, bank account encryption

### Wave 5 (Pay Run Processing)
- D02-COMP-03 / D01-DC-08: PAYG tax tables configurable (tax-tables.ts, FY-keyed)
- D02-COMP-02: Super rate from config, not hardcoded
- D02-COMP-05: Completed pay runs immutable (409 on PATCH, reversals only)
- D03-B4: Batch INSERT + single transaction + background queue (>20 employees)

### Wave 6 (STP Compliance)
- D02-CRIT-04: STP xmlPayload encrypted at rest (AES-256-GCM)
- D02-COMP-01: STP Phase 2 mandatory fields added
- D02: Timesheet approval authorization (manager role required)
- D02: STP error handling (retry 3x with backoff)
- D02: Pluggable STP adapter (mock/production via ATO_STP_MODE)

### Wave 7 (Customer Management & Invoicing)
- D01-CRIT-03: Pagination standardized to `?offset=0&limit=50`
- D04-ROUTE-04: Wave 14 namespace compatibility documented
- D02-COMP-06: Invoice number locking (implicit in pagination note)

### Wave 8 (Recurring Invoices & Payments)
- D02-CRIT-05: Payment gateway API keys encrypted (AES-256-GCM)
- D02: Idempotency keys for payment operations
- D02: Stripe webhook signature verification
- D03-S8: Recurring invoice scheduler (node-cron polling)
- D03-S9: Dunning email rate limiting (3/customer/day, 10/batch)

### Wave 9 (AR Aging & Multi-Currency)
- D03-S3: Exchange rate caching (Redis 1h TTL, fallback chain)
- D02: Multi-currency GST (ATO date-of-supply requirement)
- D01: PDF generation DRY (reuse Wave 7 pdf-lib)

### Wave 10 (Accounts Payable)
- D03-B5: Three-way matching index (`po_receipt_lines(po_line_id)`)
- D02-COMP-04: ABN validation (mod-89 + ABR lookup)
- D02-SEC-05: Supplier bank encryption (separate BANK_ENCRYPTION_KEY)
- D02-SEC-08: Separation of duties (PO creator ≠ goods receiver)
- D04-DEP-01: Migration 0022 idempotency

---

## New Revisions (Applied in This Pass)

### FIX-01: Wave 1 — IntentRouter Dynamic Agent List (D01-CRIT-05)
**Severity**: CRITICAL | **File**: `wave1-orchestration-prompt.md`
**Change**: Added coordination rule 16 requiring IntentRouter's system prompt to be dynamically generated from Orchestrator's agent registry via `getRegisteredAgents()` method. Prevents hardcoded agent list from missing Waves 7/10 new agents.

### FIX-02: Wave 1 — Intent Classification Optimization (D03-B2)
**Severity**: HIGH | **File**: `wave1-orchestration-prompt.md`
**Change**: Added coordination rule 17 mandating: (a) keyword pre-filter bypassing Haiku for obvious matches, (b) Redis cache with 60s TTL for intent classifications, (c) 2-second classification timeout with fallback, (d) parallel Promise.all() dispatch for independent multi-agent intents.

### FIX-03: Wave 2 — Nginx SSE Config for /api/chat/stream (D03-B7)
**Severity**: HIGH | **File**: `wave2-orchestration-prompt.md`
**Change**: Added coordination rule 18 requiring nginx location block for `/api/chat/stream` with SSE proxy settings (`proxy_buffering off`, `proxy_read_timeout 86400s`, `X-Accel-Buffering no`). Also requires `proxy_read_timeout 120s` on generic `/api/` location.

### FIX-04: Waves 4, 9, 10 — Pagination Standardization (D01-CRIT-03)
**Severity**: CRITICAL | **Files**: `wave4-orchestration-prompt.md`, `wave9-orchestration-prompt.md`, `wave10-orchestration-prompt.md`
**Change**: Changed pagination rules from `?page=1&limit=50` to `?offset=0&limit=50` with explicit `(NOT ?page=)` and revision note. This completes the pagination standardization across all 10 waves.

### FIX-05: All Waves — Rate Limiting (D01-DC-04 / D02-SEC-06)
**Severity**: HIGH | **Files**: All 10 orchestration prompts
**Change**: Added rate limiting coordination rule to every wave. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min, sensitive endpoints (TFN/payment/STP) 10 req/min.

### FIX-06: All Waves — Code Splitting & Virtual Scrolling (D03-S6)
**Severity**: HIGH | **Files**: All 10 orchestration prompts
**Change**: Added code splitting coordination rule requiring `React.lazy()` + `Suspense` for all new feature components and `@tanstack/react-virtual` for lists with 100+ rows. Wave 3 received backend-only variant.

### FIX-07: Wave 2 Launch Script — Marker Reference Fix
**Severity**: HIGH | **File**: `launch-wave2.sh`
**Change**: Fixed 3 occurrences of `.agent-done-W1-$i` to `.agent-done-W01-$i` to match the zero-padded marker convention established by D04-MARKER-01.

### FIX-08: Wave 8 Launch Script — Marker + Claude Invocation Fix (D05-P0-2)
**Severity**: HIGH | **File**: `launch-wave8.sh`
**Change**: (a) Replaced single `.agent-done-wave7` marker check with proper 10-marker W07 check loop. (b) Changed `claude --print -p` to `claude --dangerously-skip-permissions -p` to match standard launch script pattern.

---

## Findings NOT Applied (Deferred or Out of Scope)

The following findings were acknowledged but intentionally NOT applied in this revision pass:

| Finding | Severity | Reason |
|---------|----------|--------|
| D01-DC-01: Dual schema sustainability | MEDIUM | Requires architectural decision to deprecate SQLite schema — too large for revision pass |
| D01-DC-02: Tab navigation scaling (22+ tabs) | MEDIUM | UX redesign — deferred to future wave |
| D01-DC-07: Observability/tracing (OpenTelemetry) | MEDIUM | Infrastructure addition — deferred to future wave |
| D02-SEC-02: SSE streams not authenticated | MEDIUM | Depends on auth implementation (Issue A) |
| D02-SEC-04: File upload sanitization | MEDIUM | Per-wave concern, not cross-cutting rule |
| D02 Issue A: Authentication debt | SYSTEMIC | Entire auth system is out of scope for planning revision |
| D02 Issue B: Encryption key management | SYSTEMIC | Key management strategy beyond scope |
| D02 Issue C: Privacy Act compliance | SYSTEMIC | Legal/compliance assessment beyond scope |
| D02 Issue D: Security testing wave | SYSTEMIC | New wave proposal beyond scope |
| D03-S2: Agent mutation table bloat | MEDIUM | Retention policy can be added during implementation |
| D03-S7: Database connection pooling | MEDIUM | Infrastructure config — added to backlog |
| D05-M-01: Wave 8 prompt format deviation | LOW | Cosmetic only, functional equivalence confirmed |
| D05-L-01: Launch script structural variants | LOW | W2 and W8 functional differences partially resolved |
| D01-SUG-01 through SUG-07 | LOW | Nice-to-have suggestions, not blocking |
| D03-O1 through O8 | LOW | Optimization opportunities for implementation phase |

---

## Cross-Reference: Debate Finding Coverage

| Finding ID | Source | Severity | Status |
|-----------|--------|----------|--------|
| D01-CRIT-01 | Architecture | P0 | Applied (Wave 2) |
| D01-CRIT-02 | Architecture | P0 | Applied (Wave 1, 10) |
| D01-CRIT-03 | Architecture | P0 | Applied (All waves) — **FIX-04 completed in this pass** |
| D01-CRIT-04 | Architecture | P0 | Applied (Wave 1) |
| D01-CRIT-05 | Architecture | HIGH | Applied (Wave 1) — **FIX-01 completed in this pass** |
| D01-DC-01 | Architecture | MEDIUM | Deferred |
| D01-DC-02 | Architecture | MEDIUM | Deferred |
| D01-DC-03 | Architecture | MEDIUM | Applied (Wave 1, FIX-02) |
| D01-DC-04 | Architecture | MEDIUM | Applied (All waves) — **FIX-05 completed in this pass** |
| D01-DC-05 | Architecture | MEDIUM | Applied (Wave 1, 2) |
| D01-DC-06 | Architecture | MEDIUM | Applied (Wave 3 — shared/private datasets) |
| D01-DC-07 | Architecture | MEDIUM | Deferred |
| D01-DC-08 | Architecture | MEDIUM | Applied (Wave 5) |
| D01-DC-09 | Architecture | MEDIUM | Applied (Wave 3 — gradual auth migration) |
| D02-CRIT-01 | Security | CRITICAL | Applied (Wave 1, 4) |
| D02-CRIT-02 | Security | CRITICAL | Applied (Wave 2) |
| D02-CRIT-03 | Security | CRITICAL | Applied (Wave 3) |
| D02-CRIT-04 | Security | CRITICAL | Applied (Wave 6) |
| D02-CRIT-05 | Security | CRITICAL | Applied (Wave 8) |
| D02-COMP-01 | Security | HIGH | Applied (Wave 6) |
| D02-COMP-02 | Security | HIGH | Applied (Wave 4, 5) |
| D02-COMP-03 | Security | HIGH | Applied (Wave 5) |
| D02-COMP-04 | Security | HIGH | Applied (Wave 10) |
| D02-COMP-05 | Security | HIGH | Applied (Wave 5) |
| D02-COMP-06 | Security | HIGH | Applied (Wave 7) |
| D02-SEC-01 | Security | MEDIUM | Applied (Wave 4) |
| D02-SEC-02 | Security | MEDIUM | Deferred |
| D02-SEC-03 | Security | MEDIUM | Applied (Wave 1, 2) |
| D02-SEC-04 | Security | MEDIUM | Deferred |
| D02-SEC-05 | Security | MEDIUM | Applied (Wave 10) |
| D02-SEC-06 | Security | MEDIUM | Applied (All waves) — **FIX-05 completed in this pass** |
| D02-SEC-07 | Security | MEDIUM | Applied (Wave 2) |
| D02-SEC-08 | Security | MEDIUM | Applied (Wave 10) |
| D02-SEC-09 | Security | MEDIUM | Applied (Wave 3 — opaque IDs) |
| D02-SEC-10 | Security | MEDIUM | Deferred |
| D03-B1 | Scalability | HIGH | Applied (Wave 2) |
| D03-B2 | Scalability | HIGH | Applied (Wave 1) — **FIX-02 completed in this pass** |
| D03-B3 | Scalability | HIGH | Applied (Wave 3) |
| D03-B4 | Scalability | HIGH | Applied (Wave 5) |
| D03-B5 | Scalability | HIGH | Applied (Wave 10) |
| D03-B6 | Scalability | HIGH | Applied (Wave 1 — route extraction) |
| D03-B7 | Scalability | HIGH | Applied (Wave 2) — **FIX-03 completed in this pass** |
| D03-S1 | Scalability | MEDIUM | Deferred |
| D03-S2 | Scalability | MEDIUM | Deferred |
| D03-S3 | Scalability | MEDIUM | Applied (Wave 9) |
| D03-S4 | Scalability | MEDIUM | Deferred |
| D03-S5 | Scalability | MEDIUM | Applied (Wave 3) |
| D03-S6 | Scalability | MEDIUM | Applied (All waves) — **FIX-06 completed in this pass** |
| D03-S7 | Scalability | MEDIUM | Deferred |
| D03-S8 | Scalability | MEDIUM | Applied (Wave 8) |
| D03-S9 | Scalability | MEDIUM | Applied (Wave 8) |
| D04-DEP-01 | Integration | CRITICAL | Applied (Wave 1, 10) |
| D04-MARKER-01 | Integration | HIGH | Applied (Waves 1, 2) — **FIX-07 launch script fix in this pass** |
| D04-CONSIST-01 | Integration | MEDIUM | Applied (All waves) — **FIX-04 in this pass** |
| D04-CONSIST-06 | Integration | MEDIUM | Applied (Wave 2) |
| D05-P0 #1 | Completeness | P0 | Applied (Waves 1, 2 markers) |
| D05-P0 #2 | Completeness | P0 | Applied (Wave 8 launch) — **FIX-08 in this pass** |
| D05-P1 #3 | Completeness | P1 | Applied (Pagination) — **FIX-04 in this pass** |

---

## Verification Checklist

- [x] All 10 orchestration prompts have rate limiting coordination rule
- [x] All 10 orchestration prompts have code splitting coordination rule
- [x] All 10 orchestration prompts use `?offset=0&limit=50` pagination (not `?page=`)
- [x] All marker naming uses zero-padded format (`W01-` through `W10-`)
- [x] Wave 2 launch script checks for W01 markers (not W1)
- [x] Wave 8 launch script checks for W07 markers (not .agent-done-wave7)
- [x] Wave 8 launch script uses `claude --dangerously-skip-permissions` (not `--print`)
- [x] IntentRouter uses dynamic agent list from Orchestrator registry
- [x] Intent classification has caching + keyword pre-filter + timeout
- [x] Nginx config requirement added for `/api/chat/stream` SSE endpoint
- [x] REVISION-LOG.md created with full change documentation
- [x] Marker file `.agent-done-0B-W01` created

---

*Revision pass completed 2026-02-13 by Phase D Lead Agent.*
