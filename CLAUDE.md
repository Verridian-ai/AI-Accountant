# GoldLedger — FINAL DELIVERY Context

This file provides context for Claude Code agent teams executing the **Final Delivery** of GoldLedger.

## FINAL DELIVERY IS ACTIVE — 3 Sequential Phases, 8 Agents Total

**Phase 1 planning: COMPLETE. Phase 2 execution: DONE. Phase 3 error resolution: DEFINED. FINAL DELIVERY: IN PROGRESS.**

## Quick Reference: What to Read

| Phase | Prompt | Required Reading |
|-------|--------|-----------------|
| **A: Build Fix** | `scripts/refactor-agent-teams/prompts/phase-a-build-fix.txt` | `docs/TS_ERROR_REPORT.md` |
| **B: Neon + v4** | `scripts/refactor-agent-teams/prompts/phase-b-neon-v4.txt` | `docs/NATIVE_MASKING_ARCHITECTURE.md`, `docs/DATA_MASKING_PLAN.md` |
| **C: Verify** | `scripts/refactor-agent-teams/prompts/phase-c-verify.txt` | All docs above |

---

## Current State

| Component | Status |
|-----------|--------|
| Server TS errors | **119** (target: 0) |
| Client TS errors | **0** (maintain) |
| `: any` occurrences | **560** (target: < 50) |
| Docker | 5 services (postgres, cognee, redis, server, client) |
| Database | Local PostgreSQL 17 + pgvector (`ai_accountant`) |
| Cognee | Local Docker build from `./cognee-repo` on port 8000 |
| Neon | API key available, project NOT yet created |
| Git | Branch `refactor/REFACTOR-018-account-service`, 100+ modified files |

---

## Phase A: Fix Build and Ship to Docker (4 Opus 4.6 Agents)

**Goal**: 0 TS errors. Docker builds. App serves requests.

| Agent | Role | Scope |
|-------|------|-------|
| `module-fixer` | Create 25+ missing module files | 49 TS2307 errors |
| `session-fixer` | Fix sessionId + index.ts types | 65 TS errors |
| `any-killer-1` | Eliminate `: any` from top 18 files | 323 occurrences |
| `any-killer-2` | Sweep remaining 64 files + Docker verify | 237 occurrences |

**Deliverable**: `npx tsc --noEmit` = 0 errors. `docker compose up -d` succeeds. Health check returns 200.

**Commit**: `refactor(FINAL-001): zero TS errors, Docker build green`

---

## Phase B: Neon Cloud + v4 Streaming Masking (2 Opus 4.6 + 1 Sonnet)

**Goal**: Neon Cloud live with production data, deterministic masking, streaming unredaction pipeline.

| Agent | Model | Role |
|-------|-------|------|
| `neon-deployer` | Opus 4.6 | Create Neon project, migrate data, set up AI masked branch |
| `v4-architect` | Opus 4.6 | Build streaming unredactor, amount tagger, aggregate tool |
| `bridge-wirer` | Sonnet | Wire Neon into all existing services |

### v4 Architecture: 5 Speed Hacks

1. **Deterministic Masking**: `anon.pseudo_*(salt, column)` — same input always produces same output. Cognee graph stays stable.
2. **Tagged Amounts**: Real amounts replaced with `[[amt:ID]]` tags. Real values in Redis. LLM never sees real dollars.
3. **Streaming Unredactor**: Node.js Transform stream swaps masked tokens for real data as Claude streams tokens.
4. **Tool-Delegated Aggregation**: `get_exact_totals` tool queries production Neon for real sums. LLM never does math.
5. **Generative UI**: Claude triggers `{"ui": "TransactionTable"}` for large datasets. Frontend renders real data natively.

### Data Classification

| Type | Datasets | Masking |
|------|----------|---------|
| **PUBLIC** | `tax_rulings`, `gst_rules`, `deduction_patterns` | None — flows freely |
| **PRIVATE** | `bank_transactions`, `merchant_data`, `financial_insights` | Full masking via Neon AI branch |

### New Files (Phase B creates)

- `server/src/db/neon-connection.ts` — Dual connection pools (production + AI masked)
- `server/src/services/neon/branch-manager.ts` — Neon API branch management
- `server/src/services/neon/deterministic-masking-rules.sql` — 110 rules with `anon.pseudo_*()`
- `server/src/services/pipeline/streaming-unredactor.ts` — Transform stream for inline unredaction
- `server/src/services/pipeline/amount-tagger.ts` — `[[amt:ID]]` tag system + Redis
- `server/src/services/pipeline/token-map-builder.ts` — Merge name pseudonyms + amount tags
- `server/src/services/data-classification.ts` — PUBLIC/PRIVATE dataset registry
- `server/src/services/tools/aggregate-tool.ts` — `get_exact_totals` production query tool

**Commit**: `feat(FINAL-002): Neon Cloud live, v4 streaming masking, dual DB pools`

---

## Phase C: Integration Verification (1 Opus 4.6 Agent)

**Goal**: All data flows verified. Full stack operational. Commit-ready.

10 verification tests covering:
1. Docker stack health (5 services)
2. Neon Cloud connectivity (production + AI branches)
3. Deterministic masking stability
4. Dual connection pool verification
5. PUBLIC knowledge flow (zero masking)
6. PRIVATE knowledge flow (full masking + unredaction)
7. Streaming unredaction
8. Aggregate tool (exact math)
9. Cognee memory writeback
10. Fallback mode (USE_NEON=false)

**Deliverable**: `docs/VERIFICATION_REPORT.md` with all test results.

**Commit**: `feat(FINAL-003): integration verified, full stack operational`

---

## Architecture After Delivery

```
User <-> React Client :8080 <-> Hono Server :3501
                                    |
                    +---------------+---------------+
                    |               |               |
            Neon Production    Neon AI Branch    Cognee :8000
            (real data)        (masked data)        |
                    |               |           Local PG :5432
                    |               |           (cognee_db only)
                    |               |
                    +-------+-------+
                            |
                    Claude Opus 4.6
                    (via OpenRouter)
                            |
                    StreamingUnredactor
                    (real data to user)
```

**Key change**: Local PostgreSQL hosts ONLY the 13 Cognee/AI tables. All 128 accounting tables move to Neon Cloud.

---

## Project Structure

- **server/**: Hono + Drizzle ORM backend (TypeScript)
- **client/**: React 19 + Vite + Tailwind v4 frontend
- **docs/**: Architecture docs, masking plans, integration plans
- **scripts/refactor-agent-teams/**: Agent team prompts and launch scripts
- **docker-compose.yml**: 5-service Docker topology
- **cognee-repo/**: Cloned Cognee source (built as Docker image)

## Key Paths

- Server entry: `server/src/index.ts`
- Schema: `server/src/schema.ts`
- DB: `server/src/db-adapter.ts`, `server/src/db/neon-connection.ts` (new)
- Services: `server/src/services/` (100+ files)
- Pipeline: `server/src/services/pipeline/` (new — unredactor, tagger, token map)
- Neon: `server/src/services/neon/` (new — branch manager, masking rules)
- Tools: `server/src/services/tools/` (new — aggregate tool)
- Cognee: `server/src/services/cognee*/`
- Routes: `server/src/routes/`
- Docker: `docker-compose.yml`, `server/Dockerfile`, `client/Dockerfile`

## Launch Commands

```bash
# From project root (Windows):
RUN_FINAL_DELIVERY.bat        # Phase A (default)
RUN_FINAL_DELIVERY.bat b      # Phase B
RUN_FINAL_DELIVERY.bat c      # Phase C

# From WSL2 directly:
./scripts/refactor-agent-teams/launch-final-delivery.sh a
./scripts/refactor-agent-teams/launch-final-delivery.sh b
./scripts/refactor-agent-teams/launch-final-delivery.sh c
```

## Golden Rules

1. **Never delete code** without confirming zero references
2. **Always run** `npx tsc --noEmit` after every change
3. **Read the file BEFORE editing it**
4. **NEVER use** `@ts-ignore` or `@ts-expect-error` — always add real types
5. **Max 500 lines** per commit
6. **USE_NEON=false** must always work (fallback to local PG)
7. **All new TypeScript** must be strict (no `: any`)
8. **Commit format**: `refactor(FINAL-NNN): description` or `feat(FINAL-NNN): description`

## Verification Commands

```bash
# Type check
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# Docker
docker compose build && docker compose up -d
docker compose ps
curl http://localhost:3501/api/health

# Metrics
grep -rn ': any' server/src/ --include='*.ts' | grep -v test | grep -v .d.ts | wc -l
grep -rn 'as any' server/src/ --include='*.ts' | grep -v test | grep -v .d.ts | wc -l
```

## Refactoring Rules — File Splitting

**Active Task**: Split all files over 500 lines into modular directory structures.

### Split Pattern (MANDATORY for every file)

1. **Read** the file fully before editing
2. **Identify** logical groupings (types, helpers, main logic, constants, etc.)
3. **Create** a directory with the same name as the file (minus extension)
4. **Extract** code into sub-modules within that directory
5. **Create** an `index.ts` barrel that re-exports all public API symbols
6. **Replace** the original file with a 1-line shim: `export * from './name/index.js';`
7. **Verify** with `npx tsc --noEmit` — zero new errors allowed
8. **Commit** with: `refactor: split {filename} into {dirname}/ modules`

### For React Components (.tsx)

- Main component stays in `ComponentName/ComponentName.tsx`
- Extract sub-components into `ComponentName/SubComponent.tsx`
- Extract hooks into `ComponentName/hooks.ts` or `ComponentName/useX.ts`
- Extract types into `ComponentName/types.ts`
- Barrel: `ComponentName/index.tsx` re-exports the default/named exports

### For Route Extraction (server/src/index.ts)

- Each domain group goes into `server/src/routes/{domain}.ts`
- Route file exports a Hono sub-app via `new Hono()`
- Main `index.ts` wires via `app.route('/api/domain', domainRoutes)`
- Keep middleware, app init, SSE setup in `index.ts`

### File Ownership

- Each teammate owns a specific, non-overlapping set of files
- **NEVER** edit a file assigned to another teammate
- If you need something from another teammate's file, message them

### Quality Gates

- `npx tsc --noEmit` must pass after every file split
- All existing imports must continue to resolve
- No `@ts-ignore` or `@ts-expect-error` — fix the types properly
- No `: any` in new code

## References

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [Neon Data Anonymization](https://neon.com/docs/workflows/data-anonymization)
- [Cognee AI Docs](https://docs.cognee.ai/)
- `docs/NATIVE_MASKING_ARCHITECTURE.md` — v4 streaming-native architecture
- `docs/TS_ERROR_REPORT.md` — TypeScript error task list
- `docs/DATA_MASKING_PLAN.md` — 110 PII column masking rules
- `docs/COGNEE_NEON_BRIDGE_PLAN.md` — Cognee dual-database bridge

---

## Plugin Arsenal (29 plugins, 58+ commands, 40+ agents, 7 MCP servers)

### Non-Negotiable Rules (enforced by hooks)
1. NEVER use `@ts-ignore` or `@ts-expect-error` — fix types properly
2. NEVER use `as any` — use proper types or `as unknown as T`
3. Run `cd server && npx tsc --noEmit` after EVERY server file change — 0 errors required
4. Run `cd client && npx tsc --noEmit` after EVERY client file change — 0 errors required
5. NEVER hardcode `localhost:3000` or `localhost:8080` — use `BASE_URL` / `API_URL`
6. NEVER store secrets in code — use `process.env.X`
7. All route POST/PATCH/PUT handlers MUST use `zValidator` for body validation
8. All JWT payload access MUST have null guard
9. All `parseInt()` calls MUST have radix 10
10. Commit after each logical fix group

### GoldLedger Custom Commands
- `/gl-fix "issue"` — Full fix workflow: diagnose, plan, fix, verify, commit
- `/gl-audit routes|schema|services|client|security|all` — Targeted audit sweep
- `/gl-migrate "name"` — Generate and review Drizzle migration
- `/gl-agent-team "name" "mission" N` — Scaffold and launch agent team
- `/gl-tsc` — Full TypeScript check (server + client)
- `/gl-neon "SQL"` — Query Neon database directly
- `/gl-ralph "problem"` — Start iterative Ralph loop
- `/gl-hive search|store|codify|rules` — Query/write to Hive Memory knowledge graph

### Plugin Slash Commands
- `/plan` — Step-by-step planning with risk analysis (everything-claude-code)
- `/write-plan` — Detailed implementation plan (superpowers)
- `/execute-plan` — Execute a written plan in batches (superpowers)
- `/orchestrate feature|bugfix|refactor|security "desc"` — Multi-agent orchestration
- `/feature-dev "desc"` — Guided feature development with codebase exploration
- `/tdd` — Test-driven development workflow
- `/build-fix` — Build error diagnosis and fix loop
- `/ralph-loop "task"` — Iterative self-improving AI loop
- `/code-review` — Full code review
- `/review-pr` — 6-agent comprehensive PR review (pr-review-toolkit)
- `/verify` — Verification before completion
- `/commit` — Smart git commit with auto-message
- `/commit-push-pr` — Commit, push, and create PR
- `/hookify "behavior"` — Create hook to prevent unwanted behavior
- `/revise-claude-md` — Update CLAUDE.md with session learnings

### Available Specialist Agents

**Plugin Agents** (invoke with Task tool):
- `code-reviewer` — Code quality (pr-review-toolkit + everything-claude-code)
- `silent-failure-hunter` — Find swallowed errors (pr-review-toolkit)
- `type-design-analyzer` — TypeScript type design (pr-review-toolkit)
- `security-reviewer` — Security vulnerabilities (everything-claude-code)
- `architect` — System design (everything-claude-code)
- `planner` — Implementation planning (everything-claude-code)
- `build-error-resolver` — Build error diagnosis (everything-claude-code)
- `tdd-guide` — Test-driven development (everything-claude-code)
- `database-reviewer` — PostgreSQL/Supabase review (everything-claude-code)

**GoldLedger Custom Agents**:
- `gl-ts-expert` — TypeScript expert for Hono/Drizzle/React (uses context7 + serena MCPs)
- `gl-security` — Security reviewer for auth and middleware (uses sonatype-guide + serena MCPs)
- `gl-schema` — Database schema expert for Drizzle/Neon (uses context7 + serena MCPs)
- `gl-reviewer` — Full-stack code reviewer (uses sonatype-guide + serena + greptile MCPs)
- `gl-hive-memory` — Hive Memory knowledge graph agent (uses cognee-hive-local MCP)

### MCP Servers (7 active)
| MCP Server | Tools | Use For |
|------------|-------|---------|
| context7 | resolve-library-id, query-docs | Real-time Hono/Drizzle/React/Neon docs |
| serena | find_symbol, search_for_pattern, get_symbols_overview | Codebase navigation and symbol lookup |
| github | create_pull_request, create_issue, list_commits | PR/issue management |
| greptile | list_merge_requests, trigger_code_review | AI code review on PRs |
| sonatype-guide | getComponentVersion, getRecommendedComponentVersions | Dependency CVE scanning |
| playwright | browser_navigate, browser_click, browser_snapshot | Browser E2E testing |
| circleback | (meeting context) | Meeting notes and discussion tracking |

### Per-Agent Plugin/MCP Matrix

| Agent Role | MCPs | Commands | Agents |
|-----------|------|----------|--------|
| **Architect/Planner** | context7, serena, github | /plan, /write-plan, /feature-dev | architect, planner |
| **Code Review** | serena, greptile, sonatype-guide | /review-pr, /code-review, /verify | gl-reviewer, silent-failure-hunter, type-design-analyzer |
| **TypeScript/Build** | context7, serena | /gl-tsc, /gl-fix, /build-fix | gl-ts-expert, build-error-resolver |
| **Security** | sonatype-guide, serena, github | /gl-audit security, /orchestrate security | gl-security, security-reviewer |
| **Database/Schema** | context7, serena | /gl-migrate, /gl-neon | gl-schema, database-reviewer |
| **Testing/QA** | playwright, context7 | /tdd, /e2e, /verify | tdd-guide, e2e-runner |
| **Documentation** | context7, github | /revise-claude-md, /update-codemaps | doc-updater |
| **Git/Release** | github, greptile | /commit, /commit-push-pr | (commit-commands plugin) |
| **Full-Stack Dev** | context7, serena, github | /feature-dev, /orchestrate, /ralph-loop | code-architect, code-explorer |
| **Knowledge Graph** | cognee-hive-local | /gl-hive | gl-hive-memory |

### Active Hooks
| Hook | Trigger | Action |
|------|---------|--------|
| pre-commit-gate | `git commit` | Blocks @ts-ignore/@ts-expect-error in staged changes |
| block-dangerous-patterns | Write .ts/.tsx | Blocks @ts-ignore, hardcoded secrets |
| post-edit-tsc | Edit/Write .ts/.tsx | Runs tsc, reports error count |

### Agent Team Architecture
Teams live in `agent-team-N/` directories.
Launch: `bash '/mnt/c/Users/Danie/Desktop/claude-agent-teams/scripts/launch-team.sh' '/mnt/c/Users/Danie/Desktop/CBA Statements Parse' 'agent-team-N/orchestration-prompt.md' 'session-name' 'N'`
Attach: `wsl -e bash -c "tmux attach -t session-name"`

### File Ownership Rules (for agent teams)
- `server/src/routes/` — route handlers only
- `server/src/services/` — business logic only
- `server/src/schema/` — schema definitions only
- `client/src/features/` — feature components only
- `client/src/api/` — API client only
