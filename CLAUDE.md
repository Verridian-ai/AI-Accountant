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

## References

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [Neon Data Anonymization](https://neon.com/docs/workflows/data-anonymization)
- [Cognee AI Docs](https://docs.cognee.ai/)
- `docs/NATIVE_MASKING_ARCHITECTURE.md` — v4 streaming-native architecture
- `docs/TS_ERROR_REPORT.md` — TypeScript error task list
- `docs/DATA_MASKING_PLAN.md` — 110 PII column masking rules
- `docs/COGNEE_NEON_BRIDGE_PLAN.md` — Cognee dual-database bridge
