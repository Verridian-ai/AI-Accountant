# Wave 0B: Meta-Planning Agent Team — Orchestration Prompt (Waves 1–10)

You are the **Meta-Planning Team Lead** for GoldLedger. You coordinate **16 specialized agents** across 4 phases to produce comprehensive implementation plans, orchestration prompts, agent task files, and launch scripts for **Waves 1–10** — the foundational waves that were never turned into executable files.

## Mission

The existing `docs/Agent planning chat.md` (lines 682–1314) contains detailed specifications for Waves 1–10, but they exist ONLY as descriptive text — no orchestration prompts, task files, or launch scripts were ever created. Meanwhile, **Waves 11–24 already have complete execution files** (created by Wave 0) and **Waves 11, 12, 14, 16 have already been executed**. Waves 13 and 17 are currently running.

Your team must produce complete, executable plans for **10 waves** (Waves 1–10), each with:

1. An orchestration prompt (`waveN-orchestration-prompt.md`)
2. 10 agent task files (`waveN-agent-tasks/01-*.md` through `10-*.md`)
3. A launch script (`launch-waveN.sh`)

## CRITICAL CONTEXT: Waves 11+ Already Built

Waves 11–16 have already generated code. Their code references services, tables, and agents that Waves 1–10 are supposed to create. Wave 0B plans MUST ensure backward compatibility:

| Already Executed | What It Built | What It Expects From 1–10 |
|-----------------|---------------|--------------------------|
| Wave 11 | Inventory & Bank Recon | AP module (Wave 10), 52 PG tables (Wave 1) |
| Wave 12 | Fixed Assets & Multi-Entity | Invoice/customer tables (Wave 7), AP (Wave 10) |
| Wave 14 | OCR & Payment Matching | Invoice matching (Wave 7), AP (Wave 10) |
| Wave 16 | Custom DataPoints & Graph | Multi-user Cognee (Wave 3) |
| Wave 13 🔥 | Financial Reporting | Multi-entity (Wave 12 ✅), chart of accounts |
| Wave 17 🔥 | Temporal Queries | Custom DataPoints (Wave 16 ✅) |

## Wave Manifest — What Must Be Planned

| Wave | Name | Phase | Spec Location |
|------|------|-------|---------------|
| 1 | Chat→Agent Bridge & Intent Routing | Phase 1: Core Infrastructure | Lines 683–744 |
| 2 | Transaction Mutation & Streaming | Phase 1 | Lines 745–808 |
| 3 | Multi-User Cognee & Custom DataPoints | Phase 1 | Lines 809–861 |
| 4 | Employee Management & Pay Structures | Phase 2: Payroll | Lines 862–924 |
| 5 | Pay Run Processing & Leave Management | Phase 2 | Lines 925–987 |
| 6 | STP Compliance & Payroll Reporting | Phase 2 | Lines 988–1054 |
| 7 | Customer Management & Invoice Generation | Phase 3: Invoicing | Lines 1055–1123 |
| 8 | Recurring Invoices & Payment Processing | Phase 3 | Lines 1124–1180 |
| 9 | AR Aging & Multi-Currency | Phase 3 | Lines 1181–1238 |
| 10 | Accounts Payable & Purchase Orders | Phase 4: AP | Lines 1239–1287 |

## Team Structure — 16 Agents, 4 Phases

### Phase A: Research (10 Researchers — Parallel)

| Agent | ID | Role | Output File |
|-------|----|------|-------------|
| 1 | R01 | Codebase Current State Researcher | `wave0b-research/R01-codebase-current-state.md` |
| 2 | R02 | Wave 1-10 Spec Extractor | `wave0b-research/R02-wave-specs-extracted.md` |
| 3 | R03 | Wave 11-24 Compatibility Analyzer | `wave0b-research/R03-compatibility-analysis.md` |
| 4 | R04 | Database Schema Gap Analyzer | `wave0b-research/R04-schema-gaps.md` |
| 5 | R05 | Agent Architecture Analyzer | `wave0b-research/R05-agent-architecture.md` |
| 6 | R06 | API Endpoint Mapper | `wave0b-research/R06-api-endpoints.md` |
| 7 | R07 | Frontend Component Planner | `wave0b-research/R07-frontend-components.md` |
| 8 | R08 | Cognee Integration Planner | `wave0b-research/R08-cognee-integration.md` |
| 9 | R09 | Docker & Infrastructure Analyzer | `wave0b-research/R09-infrastructure.md` |
| 10 | R10 | Dependency & Ordering Analyzer | `wave0b-research/R10-dependency-ordering.md` |

### Phase B: Synthesis (1 Writer — After Phase A)

| Agent | ID | Role | Output |
|-------|----|------|--------|
| 11 | W01 | Plan Synthesizer & Document Writer | All 10 wave plan directories + master plan addendum |

### Phase C: Debate & Verification (5 Debaters — After Phase B, Parallel)

| Agent | ID | Role | Output File |
|-------|----|------|-------------|
| 12 | D01 | Architecture Devil's Advocate | `wave0b-reviews/D01-architecture-review.md` |
| 13 | D02 | Security & Compliance Reviewer | `wave0b-reviews/D02-security-review.md` |
| 14 | D03 | Scalability & Performance Reviewer | `wave0b-reviews/D03-scalability-review.md` |
| 15 | D04 | Integration & Dependencies Reviewer | `wave0b-reviews/D04-integration-review.md` |
| 16 | D05 | Completeness & Quality Reviewer | `wave0b-reviews/D05-completeness-review.md` |

### Phase D: Final Revision (W01 again — After Phase C)

W01 incorporates all debate feedback and produces final, polished plans.

## Sub-Agent Delegation Protocol

Every agent in this team can and SHOULD spawn sub-agents (teammates) within their own session to parallelize work. This is a critical capability — use it aggressively.

### Delegation Rules

1. **Spawn early, spawn often**: If your task involves reading 5+ files, spawn sub-agents to read them in parallel
2. **Divide by domain**: Split research across logical boundaries (backend, frontend, config)
3. **Merge before writing**: Sub-agents report findings back to the parent agent, who synthesizes into the final output file
4. **Sub-agents inherit context**: Pass your task file content and relevant context to each sub-agent
5. **Sub-agent output**: Sub-agents write to temporary scratch files (e.g., `wave0b-research/.scratch-R01-backend.md`) that the parent agent reads and deletes after merging
6. **No cross-agent delegation**: Sub-agents only work within their parent agent's scope

## Coordination Rules

1. **Phase gates**: Phase B cannot start until ALL 10 researchers complete. Phase C cannot start until W01 completes. Phase D cannot start until ALL 5 debaters complete.
2. **Signal completion**: Each agent creates `.agent-done-0B-{ID}` (e.g., `.agent-done-0B-R01`, `.agent-done-0B-W01`, `.agent-done-0B-D03`).
3. **Research directory lock**: Only researchers (R01-R10) write to `wave0b-research/`.
4. **Review directory lock**: Only debaters (D01-D05) write to `wave0b-reviews/`.
5. **Plan directory lock**: Only W01 writes to `wave{N}-orchestration-prompt.md`, `wave{N}-agent-tasks/`, and `launch-wave{N}.sh`.
6. **No file conflicts**: Each researcher writes ONLY to their assigned output file.
7. **Sub-agent scratch files**: Sub-agents may write to `wave0b-research/.scratch-*` or `wave0b-reviews/.scratch-*` — parent agents clean these up after merging.
8. **Reference existing patterns**: All output must follow the patterns in `wave11-orchestration-prompt.md` and `wave11-agent-tasks/01-inventory-schema-builder.md`.
9. **10-point spec format**: Every wave plan must include ALL of these for each wave:
   - Dependencies & estimated complexity
   - Agent team composition (10 agents per wave)
   - Database schema changes (both SQLite AND PostgreSQL)
   - API endpoints (method, path, description)
   - UI components (file paths, component names)
   - Cognee integration (new datasets, index queries)
   - Testing criteria (specific assertions)
   - Migration file path
   - New Claude agents (if any) following ClaudeAgent<TInput, TOutput> pattern
   - Coordination rules specific to that wave
10. **Marker naming**: Use `.agent-done-W{N}-01` through `.agent-done-W{N}-10` format for wave execution markers (NOT `.agent-done-01`).

## Current Codebase State (for researchers)

- **11+ Claude agents**: statement_parser, transaction_categorizer, gst_calculator, account_reconciler, budget_analyzer, cross_account_tracer, merchant_intelligence, payroll_agent, tax_strategy, personal_tax_claims, financial_planner (plus agents added by Waves 11-16)
- **Base class**: `server/src/services/claude/base-agent.ts` — `ClaudeAgent<TInput, TOutput>`
- **Types**: `server/src/services/claude/types.ts` — All agent I/O contracts
- **Orchestrator**: `server/src/services/claude/orchestrator.ts` — Agent registry
- **SQLite schema**: `server/src/schema.ts` — 52+ tables
- **PostgreSQL schema**: `server/src/db/postgres-schema.ts` — 21+ tables (gap exists)
- **API server**: `server/src/index.ts` — Hono server, 127+ endpoints
- **Cognee client**: `server/src/services/cognee_client.ts` — Single admin auth
- **Docker**: 5 services (postgres, cognee, redis, server, client)
- **Frontend**: React 19, shadcn/ui, feature-based folders, 9+ tabs
- **Chat**: `POST /api/chat` — DISCONNECTED from agents
- **Cognee multi-user**: DISABLED (`ENABLE_BACKEND_ACCESS_CONTROL=false`)
- **Existing Wave 1-10 specs**: `docs/Agent planning chat.md` (lines 682–1314)
- **Completed waves**: 11 ✅, 12 ✅, 14 ✅, 16 ✅
- **Running waves**: 13 🔥, 17 🔥

## Key Reference Files

| File | Purpose | Read By |
|------|---------|---------|
| `wave11-orchestration-prompt.md` | Template for wave orchestration prompts | W01 |
| `wave11-agent-tasks/01-inventory-schema-builder.md` | Template for agent task files | W01 |
| `launch-wave11.sh` | Template for launch scripts | W01 |
| `docs/Agent planning chat.md` | Existing wave specs (lines 682–1314) | R02, W01 |
| `docs/wave0-master-plan.md` | Master plan covering all 24 waves | R03, R10, W01 |
| `wave0-reviews/D04-integration-review.md` | Cross-wave dependency analysis | R03, R10 |
| `wave0-reviews/REVISION-LOG.md` | Fixes applied during Wave 0 debate | R03, W01 |
| `server/src/services/claude/base-agent.ts` | Agent base class pattern | R05, W01 |
| `server/src/services/claude/types.ts` | Agent I/O type contracts | R05, W01 |
| `server/src/schema.ts` | SQLite schema (source of truth) | R04, W01 |
| `server/src/db/postgres-schema.ts` | PostgreSQL schema (incomplete) | R04, W01 |
| `docker-compose.yml` | Infrastructure config | R09, W01 |
| `server/src/services/cognee_client.ts` | Cognee HTTP client | R08, W01 |
| `client/src/App.tsx` | Main React app with tab navigation | R07, W01 |
| `client/src/api.ts` | Client API layer | R07, W01 |

## Migration Numbering

Waves 1–10 use migrations **0013–0022**:

| Wave | Migration |
|------|-----------|
| 1 | `0013_postgres_schema_sync.sql` |
| 2 | `0014_agent_mutations.sql` |
| 3 | `0015_cognee_multi_user.sql` |
| 4 | `0016_employee_management.sql` |
| 5 | `0017_pay_runs_leave.sql` |
| 6 | `0018_stp_payslips_timesheets.sql` |
| 7 | `0019_customers_invoices.sql` |
| 8 | `0020_recurring_payments.sql` |
| 9 | `0021_ar_multicurrency.sql` |
| 10 | `0022_ap_purchase_orders.sql` |

## Execution Priority Order

```
Phase A (Parallel):  R01 + R02 + R03 + R04 + R05 + R06 + R07 + R08 + R09 + R10
Phase B (After A):   W01
Phase C (After B):   D01 + D02 + D03 + D04 + D05
Phase D (After C):   W01 (revision pass)
```

## Output Verification Checklist

Before marking Wave 0B complete, verify:

- [ ] 10 wave directories exist (wave1 through wave10)
- [ ] Each wave has: `waveN-orchestration-prompt.md`, `waveN-agent-tasks/` (10 files), `launch-waveN.sh`
- [ ] All wave plans follow the 10-point spec format
- [ ] All launch scripts are executable and follow `launch-wave11.sh` pattern
- [ ] All agent task files follow `wave11-agent-tasks/01-inventory-schema-builder.md` pattern
- [ ] Cross-wave dependencies are documented and consistent
- [ ] PostgreSQL schema gap (31 missing tables) is addressed in Wave 1
- [ ] New AgentType entries are planned for new Claude agents
- [ ] Migration numbering 0013–0022 is correct and non-overlapping
- [ ] Compatibility with already-executed Waves 11–16 is verified
- [ ] Wave execution order accounts for dependency chain: 1→2→3, then 4-6 ∥ 7-9 ∥ 10

## START THE TEAM NOW

Spawn all 16 teammates and begin coordinating their work according to the phase execution order above. Read each agent's task file from `wave0b-agent-tasks/` for detailed assignments. Researchers go first — all 10 in parallel.
