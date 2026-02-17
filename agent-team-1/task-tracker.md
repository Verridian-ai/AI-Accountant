# Refactoring Task Tracker — GoldLedger

> **Shared coordination file.** Agents: update status atomically. Read before claiming.
> Last updated: _(auto)_

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]`  | Available — not yet claimed |
| `[C]`  | Claimed by agent (see Agent column) |
| `[/]`  | In progress |
| `[R]`  | In QA review |
| `[!]`  | QA rejected — needs rework |
| `[x]`  | Complete and verified |

---

## Wave 0 — No Dependencies (can start immediately)

| Status | Task | Title | Effort | Risk | Agent | Branch |
|--------|------|-------|--------|------|-------|--------|
| `[x]` | REFACTOR-001 | Archive Deprecated Files | 2h | Low | Gemini | verified — build clean |
| `[ ]` | REFACTOR-028 | Consolidate PDF Libraries | 3h | Low | | |
| `[x]` | REFACTOR-029 | Move @types to devDependencies | 15m | VLow | Claude | All @types already in devDependencies |
| `[ ]` | REFACTOR-047 | Add Response Compression | 1h | Low | | |
| `[ ]` | REFACTOR-053 | Architecture Decision Records | 4h | None | | |
| `[ ]` | REFACTOR-060 | Security Headers Audit | 2h | Low | | |

## Wave 1 — Depends on Wave 0

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[x]` | REFACTOR-002 | Configure ESLint + Prettier | 001 | 4h | Low | Gemini | verified — build clean |

## Wave 2 — Depends on Wave 1

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[x]` | REFACTOR-003 | Tighten TypeScript Config | 002 | 3h | Med | Gemini | verified — build clean |
| `[x]` | REFACTOR-008 | Structured Logger | 002 | 6h | Med | Augment | verified — build clean |
| `[x]` | REFACTOR-009 | Remove Hardcoded Secrets | 002 | 2h | High | Augment | verified — build clean |
| `[x]` | REFACTOR-010 | Fix TODO/FIXME Comments | 002 | 4h | Low | Augment | verified — build clean |
| `[ ]` | REFACTOR-030 | Add CI/CD Pipeline | 002 | 4h | Low | | |

## Wave 3 — Depends on Wave 2

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[x]` | REFACTOR-004 | Eliminate `any` Batch 1 | 003 | 8h | Med | Gemini | verified — build clean |
| `[x]` | REFACTOR-011 | Create Shared Types Package | 003 | 6h | Med | Augment | verified — build clean |
| `[ ]` | REFACTOR-050 | Performance Monitoring Setup | 008 | 4h | Low | | |
| `[ ]` | REFACTOR-055 | Developer Onboarding Guide | 030 | 4h | None | | |
| `[ ]` | REFACTOR-061 | Secrets Management Audit | 009 | 2h | Low | | |

## Wave 4 — Depends on Wave 3

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[x]` | REFACTOR-005 | Eliminate `any` Batch 2 | 004 | 8h | Med | Gemini | verified — build clean |
| `[x]` | REFACTOR-012 | Extract Auth Routes | 011 | 4h | High | Augment | verified — build clean |
| `[x]` | REFACTOR-021 | Split Client API | 011 | 6h | Med | Gemini | Modularized client/src/api/ and fixed AuditEntry types. |

## Wave 5 — Depends on Wave 4

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[x]` | REFACTOR-006 | Eliminate `any` Batch 3 | 005 | 6h | Med | Gemini | verified — build clean |
| `[x]` | REFACTOR-013 | Extract Transaction Routes | 012 | 6h | High | Gemini | verified — build clean |
| `[x]` | REFACTOR-014 | Extract Account Routes | 012 | 4h | High | Gemini | verified — build clean |
| `[x]` | REFACTOR-022 | Error Handling Framework | 012 | 4h | Med | Gemini | Implemented Global Error Handler + PoC on Auth/Statements. |
| `[ ]` | REFACTOR-026 | Split Large Client Components | 021 | 6h | Med | | |

## Wave 6 — Depends on Wave 5

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[x]` | REFACTOR-007 | Eliminate `any` Batch 4 | 006 | 4h | Low | Gemini | verified — build clean |
| `[x]` | REFACTOR-015 | Extract Routes Batch 1 | 013,014 | 8h | High | Claude | 36 route files verified — all extracted |
| `[x]` | REFACTOR-017 | Service Layer: Transactions | 013 | 6h | Med | Gemini | Completed via TransactionRepository. |
| `[x]` | REFACTOR-018 | Service Layer: Accounts | 014 | 4h | Med | Gemini | Created AccountService & Repository. |
| `[ ]` | REFACTOR-042 | Route-Based Code Splitting | 021,026 | 4h | Med | | |
| `[ ]` | REFACTOR-052 | Storybook for UI Components | 026 | 8h | Low | | |
| `[ ]` | REFACTOR-039 | Client Component Tests | 031*,026 | 8h | Low | | |

## Wave 7 — Depends on Wave 6

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[x]` | REFACTOR-016 | Extract Routes Batch 2 Final | 015 | 12h | High | Gemini | verified — build clean |
| `[x]` | REFACTOR-019 | Repository Layer (Core) | 017,018 | 8h | Med | Gemini | Created Transaction, Account, Statement, User repositories. |
| `[ ]` | REFACTOR-043 | Optimize Client Bundle | 042 | 4h | Med | | |
| `[ ]` | REFACTOR-048 | Service Worker Caching | 042 | 6h | Med | | |

## Wave 8 — Depends on Wave 7

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[ ]` | REFACTOR-020 | Split Schema into Domains | 019 | 6h | High | | |
| `[ ]` | REFACTOR-023 | Dependency Injection Container | 019 | 4h | Med | | |
| `[/]` | REFACTOR-024 | Split Large Services Batch 1 | 019 | 8h | Med | Claude | |
| `[ ]` | REFACTOR-044 | DB Connection Pooling | 019 | 3h | Med | | |
| `[ ]` | REFACTOR-037 | Integration Tests: API Core | 031*,016 | 8h | Med | | |
| `[ ]` | REFACTOR-051 | OpenAPI/Swagger Docs | 016 | 8h | Low | | |
| `[x]` | REFACTOR-057 | Input Validation All Routes | 016,022 | 8h | Med | Gemini | Consolidating Zod schemas (started with Invoicing). |
| `[ ]` | REFACTOR-058 | Apply RBAC to All Routes | 016,036* | 6h | High | | |
| `[ ]` | REFACTOR-059 | CORS & Rate Limiting | 016 | 4h | Med | | |
| `[ ]` | REFACTOR-049 | Server Startup Optimization | 016,023 | 4h | Med | | |

## Wave 9 — Depends on Wave 8

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[ ]` | REFACTOR-025 | Split Large Services Batch 2 | 024 | 8h | Med | | |
| `[ ]` | REFACTOR-027 | Consolidate AI SDKs | 024 | 4h | Med | | |
| `[ ]` | REFACTOR-045 | DB Query Optimization | 019,044 | 6h | Med | | |
| `[ ]` | REFACTOR-046 | Redis Caching Layer | 019,044 | 6h | Med | | |
| `[ ]` | REFACTOR-031 | Set Up Test Infrastructure | 023,030 | 6h | Low | | |
| `[ ]` | REFACTOR-038 | Integration Tests: Extended | 037 | 8h | Med | | |
| `[ ]` | REFACTOR-056 | Refresh Token Mechanism | 012,036* | 6h | High | | |

## Wave 10 — Depends on Wave 9

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[ ]` | REFACTOR-054 | JSDoc Coverage | 024,025 | 8h | None | | |
| `[ ]` | REFACTOR-062 | Dependency Security Audit | 027,028,029 | 2h | Low | | |
| `[ ]` | REFACTOR-032 | Unit Tests: Tax | 031 | 8h | Low | | |
| `[ ]` | REFACTOR-033 | Unit Tests: Payroll | 031 | 6h | Low | | |
| `[ ]` | REFACTOR-034 | Unit Tests: Invoicing | 031 | 6h | Low | | |
| `[ ]` | REFACTOR-035 | Unit Tests: Bank Recon | 031 | 6h | Low | | |
| `[ ]` | REFACTOR-036 | Unit Tests: Auth & RBAC | 031 | 4h | Low | | |
| `[ ]` | REFACTOR-040 | E2E Tests: Critical Flows | 031 | 8h | Med | | |
| `[ ]` | REFACTOR-063 | Account Lockout Protection | 056 | 4h | Med | | |

## Wave 11 — Final

| Status | Task | Title | Deps | Effort | Risk | Agent | Branch |
|--------|------|-------|------|--------|------|-------|--------|
| `[ ]` | REFACTOR-041 | Coverage Enforcement | 032-040 | 2h | Low | | |

> **Note:** Tasks marked with `*` have cross-wave dependencies. Agents must verify ALL deps are `[x]` before starting.
> **Note:** Wave assignments are approximate. An agent may start a task as soon as ALL its specific dependencies are `[x]`, regardless of wave number.
