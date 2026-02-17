# GoldLedger — Refactoring Project Context

> All agent team members: read this file before starting any work.

## Project

GoldLedger is a full-stack Australian financial management platform. Hono TypeScript server, React client, PostgreSQL (with SQLite local mode), Cognee knowledge graph memory.

## Refactoring Goal

Break the monolithic codebase into modules following the 300-line-per-file enterprise standard. All tasks are defined in `docs/REFACTORING_TASKS_DETAILED.md` with step-by-step instructions.

## Key Files

| File | Purpose |
|------|---------|
| `docs/REFACTORING_TASKS_DETAILED.md` | Every task with step-by-step instructions |
| `agent-team/task-tracker.md` | Status of all tasks (single source of truth) |
| `server/src/index.ts` | Main server + routes (being split) |
| `server/src/schema.ts` | DB schema, 845 lines, Proxy wrapper lines 28-75 |
| `server/src/validation/index.ts` | Zod validation, 424 lines |
| `server/src/middleware/security.ts` | OWASP headers + rate limits, 345 lines |
| `server/src/middleware/audit.ts` | Audit logging, 504 lines |
| `server/src/services/claude/` | 7 TypeScript Claude agents |
| `server/src/services/orchestrator/` | Python subprocess orchestrator |
| `server/src/services/parsers/` | 9 bank + 3 format + credit card parsers |
| `client/src/api.ts` | Client API layer, 1316 lines |

## Task Tracker Statuses

```
[ ] — Available (not started)
[/] — In progress (claimed by an agent)
[R] — Ready for review (execution complete)
[x] — Approved (QA passed)
[!] — Rejected (QA found issues, needs fix)
```

## Git Conventions

- **Branch:** `refactor/REFACTOR-XXX-short-name`
- **Commit:** `refactor(REFACTOR-XXX): description`
- **Base:** Always from `main`
- **No force pushes** — add fix commits instead

## Verification Commands (Run After EVERY Task)

```bash
npx tsc --noEmit
npx eslint . --config eslint.config.mjs
cd server && npx eslint . --config eslint.config.js && cd ..
cd client && npx eslint . --config eslint.config.js && cd ..
npm test
wc -l <every new or modified file>   # must be ≤ 300 lines
```

## Enterprise Standard

- **300 lines max per file** — no exceptions
- Strict TypeScript — no `any`, no `ts-ignore`
- Every split must preserve all existing functionality
- Import paths must resolve after every split
- No dead code left behind

## Pre-Existing Gemini Work

REFACTOR-001 through 007 were done by a Gemini agent. This work may:
- Not follow the branch naming convention
- Be committed directly to `main`
- Not have run verification steps
- Exceed the 300-line file limit

Check `git log` and `git branch -a` to locate Gemini's changes.

## Dependency Quick Reference

**No dependencies (start immediately):** 001, 028, 029, 047, 053, 060

**Critical path:** 001 → 002 → 003 → 011 → 012 → 013/014 → 015 → 016 → 019 → 023 → 031 → 032-040 → 041

**Key bottlenecks (many tasks depend on these):**
- REFACTOR-002 → unlocks 003, 008, 009, 010, 030
- REFACTOR-011 → unlocks 012, 021
- REFACTOR-012 → unlocks 013, 014, 022, 056
- REFACTOR-016 → unlocks 037, 049, 051, 057, 058, 059
- REFACTOR-019 → unlocks 020, 023, 024, 044, 045, 046
- REFACTOR-031 → unlocks 032, 033, 034, 035, 036, 039, 040
