# GoldLedger Refined Refactoring Plan

**Version**: 2.0
**Date**: 2026-02-17
**Status**: Planning Complete — Ready for Phase 2 Execution
**Authors**: 6-Agent Planning Team (Architect Reviewer, Cognee Specialist, Codebase Auditor, Docker Engineer, Task Decomposer, Devil's Advocate)
**Supersedes**: `docs/REFACTORING_PLAN.md` v1.1 (2026-02-16)

---

## 1. Executive Summary

### What Changed Since v1.1

The original 63-task, 20-week refactoring plan was written against a pre-refactoring codebase snapshot. Since then, **significant refactoring has already been executed** on branch `refactor/REFACTOR-018-account-service`. This refined plan reconciles the plan with actual codebase state, removes completed tasks, adds newly-identified gaps, and restructures the timeline.

### Key Findings from 6-Agent Audit

| Finding | Impact |
|---------|--------|
| **20+ tasks already DONE** (routes extracted, services split, client API split) | Plan scope reduced by ~35% |
| **`server/src/index.ts`** went from 7,458 → **172 lines** | All route extraction tasks complete |
| **`client/src/api.ts`** deleted, replaced by 18 modules | Client API split complete |
| **80+ service subdirectories** created | Service splitting complete |
| **Testing remains at <5% coverage** (14 test files for 197K LOC) | Testing is #1 priority |
| **948 `any` types remain** (server only; client is clean at 0) | Type safety partially done |
| **`schema.ts` GREW to 2,328 lines** (113 tables) | Schema split is highest-risk remaining task |
| **0 of 20+ Claude agents accessible from chat** | Agent wiring is a critical Cognee gap |
| **Forward-only migrations, no rollback** | Docker rollback via pg_dumpall snapshots |
| **Cognee multi-tenant isolation DISABLED** | Cognee integration plan created separately |

### Revised Metrics

| Metric | Original (v1.1) | Actual (2026-02-17) | Target |
|--------|-----------------|---------------------|--------|
| `server/src/index.ts` lines | 7,458 | **172** | <300 ✅ DONE |
| `client/src/api.ts` lines | 2,763 | **DELETED** (18 modules) | Split ✅ DONE |
| `any` type usages | 1,134 | **948** (server only) | <50 documented exceptions |
| `console.log` calls | 894 | **0** | 0 ✅ DONE |
| TODO/FIXME comments | 34 | **0** | 0 ✅ DONE |
| Hardcoded secrets | 2 | **0** | 0 ✅ DONE |
| Test files | 12 | **14** | >150 |
| Test coverage | <5% | **<5%** | >60% |
| Source lines | 170,397 | **~197,000** | ~210K (with tests) |
| Files >300 lines (server) | 178 | **0** (services) | 0 ✅ DONE (services) |
| Files >300 lines (client) | — | **105** | <20 |
| Route files | 3 | **36** | 36 ✅ DONE |
| Service subdirectories | 0 | **80+** | 80+ ✅ DONE |
| Zod validation on routes | — | **7/36** (19%) | 36/36 (100%) |
| RBAC on routes | — | **3/36** (8%) | 36/36 (100%) |
| Schema.ts lines | 2,145 | **2,328** (grew!) | Split into domain modules |

---

## 2. Task Status Reconciliation

### Tasks COMPLETED (Remove from Active Plan)

These 20 tasks are confirmed done based on codebase audit evidence:

| Task | Evidence |
|------|----------|
| REFACTOR-001: Archive Deprecated Files | Files deleted outright |
| REFACTOR-002: ESLint/Prettier/Husky | Single root `eslint.config.mjs`, `.prettierrc`, `.husky/pre-commit` |
| REFACTOR-006: Client `any` Elimination | Client has 0 `any` types |
| REFACTOR-008: Structured Logger | `server/src/lib/logger.ts` + `middleware/request-logger.ts` |
| REFACTOR-009: Remove Hardcoded Secrets | `lib/config.ts` with `requireEnv()`/`optionalEnv()`, 0 secrets found |
| REFACTOR-010: Fix TODOs | 0 TODO/FIXME remaining |
| REFACTOR-011: Shared Types Package | `packages/shared/` with 11 type files (763 lines) |
| REFACTOR-012: Extract Auth Routes | `routes/auth-routes.ts` exists |
| REFACTOR-013: Extract Transaction Routes | `routes/transactions.ts` exists |
| REFACTOR-014: Extract Account Routes | `routes/accounts.ts` exists |
| REFACTOR-015: Extract Routes Batch 1 | `statements.ts`, `reports.ts`, `dashboard.ts`, `settings.ts` exist |
| REFACTOR-016: Extract Routes Batch 2 | 36 route files total, `index.ts` = 172 lines |
| REFACTOR-017: Transaction Service Layer | Transaction routes + repository exist |
| REFACTOR-018: Account Service Layer | `services/accounts/` with 5 files |
| REFACTOR-021: Split Client API | `client/src/api/` with 18 modules, original deleted |
| REFACTOR-022: Error Handling Framework | `errors.ts` (222L) + `middleware/error-handler.ts` (53L) |
| REFACTOR-024: Split Services Batch 1 | All target services split into subdirectories |
| REFACTOR-025: Split Services Batch 2 | 80+ subdirectories, 0 files >300L in services/ |
| REFACTOR-030: CI/CD Pipeline | `.github/workflows/ci.yml` exists |

### Tasks PARTIALLY DONE (Reduced Scope)

| Task | Status | Remaining Work |
|------|--------|----------------|
| REFACTOR-003: TS Config | Client done, **server missing 5 strict flags** | Enable `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess` on server |
| REFACTOR-004/005: `any` Batch 1-2 | Reduced from 1,134 → 948 | 948 server `any` remain |
| REFACTOR-019: Repository Layer | 4 repos exist (account, transaction, statement, user) | Missing repos for payroll, invoicing, bills, etc. |
| REFACTOR-042: Code Splitting | React.lazy in `routes.tsx` (Wave 24) | Verify bundle analysis, may be complete |
| REFACTOR-048: Service Worker | PWA with `sw.js` (Wave 24) | Verify caching strategy adequacy |

### Tasks SKIPPED (Team Consensus: Low ROI)

| Task | Reason |
|------|--------|
| REFACTOR-023: DI Container | Module imports + `vi.mock()` sufficient at this scale. Adding DI re-refactors a just-refactored codebase. Team unanimous. |
| REFACTOR-047: Response Compression | Local Docker app; latency not a concern |
| REFACTOR-049: Server Startup Optimization | No evidence of slow starts |
| REFACTOR-050: Prometheus Metrics | No monitoring stack; enterprise overhead for local app |
| REFACTOR-052: Storybook | Low ROI; no external design consumers |
| REFACTOR-054: JSDoc on All Exports | TypeScript types ARE the documentation |
| REFACTOR-055: Onboarding Guide | Single-user/small-team app |

### Tasks DEFERRED (Do After Core Refactoring)

| Task | Reason |
|------|--------|
| REFACTOR-051: OpenAPI/Swagger | No external API consumers yet; revisit when API is public |
| REFACTOR-053: Architecture Decision Records | Documentation debt; not blocking anything |
| REFACTOR-028: Consolidate PDF Libraries | All 4 libs serve different purposes; forced consolidation may break features |

### NEW Tasks (Identified by Planning Team)

| ID | Task | Priority | Rationale |
|----|------|----------|-----------|
| REFACTOR-NEW-01 | Fix `wrapPgDb()` type safety | P0 | Root cause of DB-layer `any`; every query returns untyped. Create typed wrapper functions (conservative approach). |
| REFACTOR-NEW-02 | Cognee architecture consolidation | P1 | See `docs/COGNEE_INTEGRATION_PLAN.md`. Wire intent router, add circuit breaker, enable sessions. |
| REFACTOR-NEW-03 | Agent framework rationalization | P1 | Remove dead Python orchestrator, create agent registry, document 20+ agents |
| REFACTOR-NEW-04 | Docker integration test suite | P1 | Smoke test all 5 services + key endpoints. Must pass before merging any phase. |
| REFACTOR-NEW-05 | SQLite deprecation | P2 | Remove `sqliteTable()` pattern, go PostgreSQL-only. Eliminates dual-schema maintenance. |
| REFACTOR-NEW-06 | Split large client components | P1 | 105 client files >300 lines. TransactionTable (1,317L), BASDashboard (1,052L), StatementList (872L) etc. |

---

## 3. Revised Phase Structure

### Phase 1: Foundation Completion (Week 1-2)

**Goal**: Complete remaining type safety and config work.

| Task | Est. LOC | Risk | Parallelizable |
|------|----------|------|----------------|
| REFACTOR-003: Server TS strict flags (5 flags, one at a time) | ~300 | Medium | No (sequential — each flag surfaces new errors) |
| REFACTOR-004/005/007: Eliminate remaining 948 server `any` | ~600 | Medium | Yes (after R003) |
| REFACTOR-NEW-01: `wrapPgDb()` typed wrappers | ~200 | HIGH | Yes (independent) |
| REFACTOR-029: Move @types to devDeps | ~10 | None | Yes |

**Docker Checkpoint**: Tag images after Phase 1. Run `tsc --noEmit` on both server + client.

### Phase 2: Security Hardening (Week 1-3, parallel with Phase 1)

**Goal**: Secure all routes before adding test infrastructure. Pulled forward from original Phase 6 because security should not wait for tests.

| Task | Est. LOC | Risk | Parallelizable |
|------|----------|------|----------------|
| REFACTOR-057: Zod validation on ALL 36 routes | ~500 | Low | Yes (per-route, independent) |
| REFACTOR-058: RBAC middleware on ALL 36 routes | ~400 | Low | Yes (per-route, after Zod) |
| REFACTOR-056: Refresh token mechanism | ~300 | Medium | Yes (independent) |
| REFACTOR-063: Account lockout | ~150 | Low | After R056 |
| REFACTOR-059: Production CORS + rate limiting | ~100 | Low | Yes |
| REFACTOR-060: Security headers audit | ~50 | None | Yes |
| REFACTOR-061: Secrets management audit | ~50 | None | Yes |
| REFACTOR-062: Dependency audit (npm audit) | ~50 | Low | After R027 |

**Docker Checkpoint**: All routes validated + RBAC'd. Smoke test auth flows.

### Phase 3: Testing (Week 2-6, overlapping)

**Goal**: Go from <5% to >60% test coverage. This is the critical path.

| Task | Est. LOC | Risk | Dependencies |
|------|----------|------|-------------|
| REFACTOR-031: Test infrastructure (Vitest, Playwright, mocks, test DB) | ~500 | Low | None — START IMMEDIATELY |
| REFACTOR-032: Tax calculation tests (GST, BAS, STP, income tax) | ~400 | Low | After R031 |
| REFACTOR-033: Payroll tests (super, leave, STP Phase 2) | ~400 | Low | After R031 |
| REFACTOR-034: Invoicing tests (generation, matching, aging) | ~400 | Low | After R031 |
| REFACTOR-035: Bank reconciliation tests | ~300 | Low | After R031 |
| REFACTOR-036: Auth & RBAC tests | ~300 | Low | After R031 |
| REFACTOR-037: Core API integration tests | ~400 | Low | After R031 |
| REFACTOR-038: Extended API integration tests | ~400 | Low | After R031 |
| REFACTOR-039: Component tests | ~400 | Low | After R031 |
| REFACTOR-040: E2E tests (Playwright) | ~500 | Medium | After R031 + some integration tests |
| REFACTOR-041: Coverage enforcement in CI | ~50 | None | After all tests |

**Notes**:
- R032-R039 are ALL parallelizable after R031 completes
- Target: >60% coverage (not 80% — realistic for 197K LOC; devil's advocate recommendation)
- Focus testing on financial calculations first (GST, BAS, payroll, tax) where correctness is legally required
- Include Wave 13-24 features: CDR crawling, anomaly detection, compliance monitoring, multi-tenant

**Docker Checkpoint**: All tests pass in Docker. Coverage report generated.

### Phase 4: Architecture Cleanup (Week 5-7, overlapping with late Phase 3)

**Goal**: Address remaining structural issues now that tests provide a safety net.

| Task | Est. LOC | Risk | Dependencies |
|------|----------|------|-------------|
| REFACTOR-020: Split `schema.ts` (2,328L → domain modules) | ~200 | HIGH | Tests must exist first |
| REFACTOR-027: Consolidate AI SDK | ~300 | HIGH | Tests must exist for agents |
| REFACTOR-NEW-03: Agent framework rationalization | ~200 | Medium | After R027 |
| REFACTOR-NEW-05: SQLite deprecation | ~300 | HIGH | After R020 |
| REFACTOR-NEW-06: Split large client components | ~400 | Medium | Independent |
| REFACTOR-026: Split remaining >300L components | ~300 | Medium | Same as NEW-06 |
| REFACTOR-043: Bundle optimization | ~100 | Low | After R026 |

**Docker Checkpoint**: Rebuild all images. Full smoke test.

### Phase 5: Cognee Integration (Week 5-8, parallel with Phase 4)

**Goal**: Execute the Cognee integration plan (see `docs/COGNEE_INTEGRATION_PLAN.md`).

| Task | Est. LOC | Risk | Dependencies |
|------|----------|------|-------------|
| REFACTOR-NEW-02a: Consolidation (remove Python orchestrator, wire intent router, circuit breaker) | ~300 | Medium | Phase 1 complete |
| REFACTOR-NEW-02b: Intelligence (DataPoint registration, batch cognify, temporal metadata) | ~400 | Medium | After 2a |
| REFACTOR-NEW-02c: Security (enable Cognee auth, migrate datasets, admin override) | ~300 | HIGH | After 2b, Docker backup |
| REFACTOR-NEW-02d: Agent Access (wire all agents to chat, confirmation flows, streaming) | ~300 | Medium | After 2c |

**WARNING**: Phase C (enabling `ENABLE_BACKEND_ACCESS_CONTROL`) will orphan all existing data ingested under the shared admin user. Must re-ingest data under per-user accounts. **Requires Docker volume backup before execution.**

**Docker Checkpoint**: Cognee health check passes. Agent chat test. Knowledge graph query test.

### Phase 6: Performance & Polish (Week 7-8)

**Goal**: Final optimizations and remaining items.

| Task | Est. LOC | Risk | Dependencies |
|------|----------|------|-------------|
| REFACTOR-044: DB connection pooling | ~100 | Medium | After R020 |
| REFACTOR-045: Query optimization | ~200 | Low | After R044 |
| REFACTOR-046: Redis caching strategy | ~200 | Low | Independent |
| REFACTOR-NEW-04: Docker integration test suite | ~300 | Low | After all phases |
| Final merge preparation | — | Medium | All phases complete |

**Docker Checkpoint**: Full `docker compose build && docker compose up -d`. All 5 services healthy. All tests pass.

---

## 4. Revised Timeline — Sprint Execution Model

The devil's advocate and codebase-auditor converged on a sprint-based execution model using the litmus test: **"Does this prevent wrong numbers in financial reports?"** If yes → Sprint 1. Otherwise → Sprint 2+.

### Sprint 0: Enabling (Week 1) — SERIALIZED, SINGLE AGENT
- **REFACTOR-020**: Split `schema.ts` (2,328L, 113 tables → domain modules)
- This is a serialization point — must complete before parallel agent work begins
- Prevents migration conflicts when multiple agents modify DB-related code

### Sprint 1: Financial Safety Net (Week 1-4) — PARALLEL AGENTS
- REFACTOR-031: Test infrastructure (Vitest, Playwright, mocks, test DB)
- REFACTOR-032 + 033: Tax + Payroll tests (legally mandated accuracy)
- Scoped `any` elimination on financial paths (~200 of 948 in BAS/GST/payroll/tax/recon/invoicing)
- REFACTOR-003: Server TS strict flags (bundles with `any` elimination)
- REFACTOR-057: Input validation (Zod) on all 36 routes
- Client financial component tests: CurrencyDisplay, GSTSummary, ProfitAndLoss, BalanceSheet, BASPage

### Sprint 2: Risk Reduction (Week 4-6) — PARALLEL AGENTS
- REFACTOR-007: Remaining `any` elimination in non-financial paths
- REFACTOR-034-037: Invoice, bank recon, auth, API integration tests
- REFACTOR-058: RBAC audit on all routes
- REFACTOR-NEW-01: `wrapPgDb()` typed wrappers
- REFACTOR-056: Refresh token mechanism

### Sprint 3: Architecture & Cognee (Week 5-7) — PARALLEL AGENTS
- REFACTOR-027: Consolidate AI SDK
- REFACTOR-NEW-02a-d: Cognee integration (4 sub-phases)
- REFACTOR-NEW-03: Agent framework rationalization
- REFACTOR-NEW-06: Split large client components (105 files >300L)
- REFACTOR-039-040: Component + E2E tests

### Sprint 4: Polish & Merge (Week 7-8)
- REFACTOR-NEW-04: Docker integration test suite
- REFACTOR-044-046: DB pooling, query optimization, Redis caching
- REFACTOR-041: Coverage enforcement in CI
- Final merge preparation + Docker deployment verification

```
Week 1:   Sprint 0 (schema split, serialized) + Sprint 1 begins
Week 1-4: Sprint 1 (financial safety net, parallel agents)
Week 4-6: Sprint 2 (risk reduction, parallel agents)
Week 5-7: Sprint 3 (architecture + Cognee, parallel agents)
Week 7-8: Sprint 4 (polish + merge)
```

**Total: 8 weeks with 8-agent parallel execution** (down from 20 weeks with 1 FTE)

### Critical Path

```
R020 (schema split, 3 days) → R031 (test infra, 3 days) → R032+033 (tax+payroll tests, 2 weeks) → Merge
```

All other work is parallel to this critical path.

---

## 5. Remaining Task Summary (39 Active Tasks)

| # | Task | Phase | Priority | Est. LOC |
|---|------|-------|----------|----------|
| 1 | REFACTOR-003: Server TS strict flags | 1 | P0 | 300 |
| 2 | REFACTOR-004/005/007: Eliminate 948 server `any` | 1 | P0 | 600 |
| 3 | REFACTOR-NEW-01: `wrapPgDb()` typed wrappers | 1 | P0 | 200 |
| 4 | REFACTOR-029: Move @types to devDeps | 1 | P2 | 10 |
| 5 | REFACTOR-057: Zod validation all routes | 2 | P0 | 500 |
| 6 | REFACTOR-058: RBAC all routes | 2 | P0 | 400 |
| 7 | REFACTOR-056: Refresh tokens | 2 | P1 | 300 |
| 8 | REFACTOR-063: Account lockout | 2 | P1 | 150 |
| 9 | REFACTOR-059: CORS + rate limiting | 2 | P1 | 100 |
| 10 | REFACTOR-060: Security headers | 2 | P2 | 50 |
| 11 | REFACTOR-061: Secrets audit | 2 | P2 | 50 |
| 12 | REFACTOR-062: Dependency audit | 2 | P2 | 50 |
| 13 | REFACTOR-031: Test infrastructure | 3 | P0 | 500 |
| 14 | REFACTOR-032: Tax calculation tests | 3 | P0 | 400 |
| 15 | REFACTOR-033: Payroll tests | 3 | P0 | 400 |
| 16 | REFACTOR-034: Invoicing tests | 3 | P1 | 400 |
| 17 | REFACTOR-035: Bank reconciliation tests | 3 | P1 | 300 |
| 18 | REFACTOR-036: Auth & RBAC tests | 3 | P0 | 300 |
| 19 | REFACTOR-037: Core API integration tests | 3 | P1 | 400 |
| 20 | REFACTOR-038: Extended API integration tests | 3 | P1 | 400 |
| 21 | REFACTOR-039: Component tests | 3 | P1 | 400 |
| 22 | REFACTOR-040: E2E tests | 3 | P1 | 500 |
| 23 | REFACTOR-041: Coverage enforcement | 3 | P1 | 50 |
| 24 | REFACTOR-020: Split schema.ts | 4 | P1 | 200 |
| 25 | REFACTOR-027: Consolidate AI SDK | 4 | P1 | 300 |
| 26 | REFACTOR-NEW-03: Agent framework rationalization | 4 | P1 | 200 |
| 27 | REFACTOR-NEW-05: SQLite deprecation | 4 | P2 | 300 |
| 28 | REFACTOR-NEW-06: Split large client components | 4 | P1 | 400 |
| 29 | REFACTOR-026: Split remaining components | 4 | P1 | 300 |
| 30 | REFACTOR-043: Bundle optimization | 4 | P2 | 100 |
| 31 | REFACTOR-NEW-02a: Cognee consolidation | 5 | P1 | 300 |
| 32 | REFACTOR-NEW-02b: Cognee intelligence | 5 | P1 | 400 |
| 33 | REFACTOR-NEW-02c: Cognee security/auth | 5 | P0 | 300 |
| 34 | REFACTOR-NEW-02d: Cognee agent access | 5 | P1 | 300 |
| 35 | REFACTOR-044: DB connection pooling | 6 | P2 | 100 |
| 36 | REFACTOR-045: Query optimization | 6 | P2 | 200 |
| 37 | REFACTOR-046: Redis caching | 6 | P2 | 200 |
| 38 | REFACTOR-NEW-04: Docker integration tests | 6 | P1 | 300 |
| 39 | Final merge + deployment | 6 | P0 | — |

**Total estimated LOC**: ~9,760 (down from ~22,000 in v1.1)

---

## 6. Risk Register (Revised)

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | `schema.ts` split breaks migrations | Medium | Critical | Test with `drizzle-kit generate` before committing. pg_dumpall backup. |
| R2 | `wrapPgDb()` fix breaks all DB queries | Medium | Critical | Use typed wrapper functions (additive), don't modify proxy itself. |
| R3 | Cognee auth enablement orphans data | High | High | Re-ingest under per-user accounts. Full Cognee volume backup first. |
| R4 | 300+ uncommitted changes on current branch | High | High | Merge or rebase BEFORE starting Phase 2 execution. |
| R5 | AI SDK consolidation breaks agents | Medium | High | Require agent integration tests (Phase 3) before consolidating (Phase 4). |
| R6 | Testing phase takes longer than 4 weeks | Medium | Medium | Target 60% not 80%. Focus on financial calculations first. |
| R7 | Agent teams step on each other's files | Medium | Medium | Strict file ownership per agent. Serialize shared-file tasks. |
| R8 | No down-migrations for schema changes | High | Medium | pg_dumpall checkpoints after each phase. See `docs/DOCKER_ROLLBACK_PLAN.md`. |
| R9 | Cognee Docker image unversioned | High | Medium | Pin to commit hash before starting. Tag image. |
| R10 | Stale branch merge nightmare | Medium | High | Resolve current branch FIRST. Small, frequent merges thereafter. |

---

## 7. Pre-Execution Checklist

Before starting Phase 2 execution, these MUST be done:

- [ ] **Merge current branch**: Resolve `refactor/REFACTOR-018-account-service` (300+ uncommitted changes)
- [ ] **Run snapshot**: Execute `docs/DOCKER_ROLLBACK_PLAN.md` pre-refactor snapshot (tag images + pg_dumpall + volume backup)
- [ ] **Pin Cognee commit**: Record exact git commit hash of `cognee-repo/` in docker-compose.yml
- [ ] **Verify Docker health**: All 5 services healthy (`docker compose ps`)
- [ ] **Verify baselines**: `cd server && npx tsc --noEmit` and `cd client && npx tsc --noEmit`
- [ ] **Run existing tests**: `cd server && npm test` — all 14 tests pass
- [ ] **Fix encryption keys**: Replace default hex keys in docker-compose.yml with env vars

---

## 8. Companion Documents

| Document | Purpose |
|----------|---------|
| `docs/COGNEE_INTEGRATION_PLAN.md` | Detailed 4-phase Cognee migration plan (10 gaps, 7 risks) |
| `docs/DOCKER_ROLLBACK_PLAN.md` | Rollback scripts, checkpoint protocol, emergency recovery |
| `docs/PHASE2_AGENT_TEAM_DEFINITION.md` | 8-agent team: roles, spawn prompts, task assignments, file ownership |
| `docs/REFACTORING_TASKS_DETAILED.md` | Original atomic task guide (reference — status outdated) |

---

## 9. Success Criteria

The refactoring is complete when ALL of these are true:

| Metric | Target |
|--------|--------|
| `any` types (server) | <50 (documented exceptions only) |
| `any` types (client) | 0 ✅ (already met) |
| Test coverage (server) | >60% lines, >50% branches |
| Test coverage (client) | >50% lines |
| E2E scenarios passing | ≥5 critical paths |
| Zod validation coverage | 36/36 routes (100%) |
| RBAC middleware coverage | 36/36 routes (100%) |
| `schema.ts` | Split into ≤5 domain modules |
| Client files >300L | <20 (down from 105) |
| Docker health check | All 5 services healthy |
| Cognee agents from chat | ≥10 agents accessible |
| `tsc --noEmit` | 0 errors (both server + client) |
| All tests pass | `npm test` exits 0 |
| Docker rollback tested | Snapshot + rollback script verified |

---

## 10. Approval

This refined plan was produced by a 6-agent planning team after:
- Full codebase audit (197K LOC, 1,205 source files)
- Full document review (8 planning documents)
- Cross-team debate and challenge (devil's advocate stress-testing)
- Dependency graph analysis (63 tasks, critical path identification)
- Docker topology analysis (5 services, 3 volumes, 31 migrations)
- Cognee integration audit (47 source files, 41 datasets, 10 gaps)

**Ready for Phase 2 execution.** See `docs/PHASE2_AGENT_TEAM_DEFINITION.md` for the execution team.
