# GoldLedger — Gemini Fix Wave: Client TypeScript Error Resolution

## Overview
Fix ALL 298 TypeScript compilation errors in the client to get Docker building successfully.

## Agent Team (4 Agents — Sequential)

| Agent | Role | Fixes | Est. Time |
|-------|------|-------|-----------|
| **01** | API Stubs & Missing Exports | ~197 errors (TS2305, TS2339, TS2551, TS2724) | 15-25 min |
| **02** | Type Annotations | ~76 errors (TS7006, TS18046) | 10-20 min |
| **03** | Type Compatibility | ~25 errors (TS2322, TS2345, TS2769, TS2352, TS2304, TS2307) | 10-15 min |
| **04** | Build Verifier & Docker | Remaining + Docker build + migrations | 15-25 min |

## Execution Order
Agents MUST run sequentially: 01 → 02 → 03 → 04

Each agent waits for the previous agent's marker file before starting:
- Agent 01: starts immediately
- Agent 02: waits for `.agent-done-GF-01`
- Agent 03: waits for `.agent-done-GF-02`
- Agent 04: waits for `.agent-done-GF-03`

## Project Structure
- **Client**: `client/` — React 18 + TypeScript + Vite + Tailwind
- **Server**: `server/` — Hono + Drizzle ORM + TypeScript
- **Docker**: `docker-compose.yml` — 5 services (postgres, cognee, redis, server, client)
- **Migrations**: `docker/migrations/` — SQL files 0009-0036

## Key Files
- `client/src/api.ts` — Main API client (Agent 01 primary target)
- `client/tsconfig.app.json` — TypeScript config (strict mode)
- `docker-compose.yml` — Docker stack config (Agent 04 target)
- `docker/migrations/` — PostgreSQL migration files

## Current Error Summary (298 total)
```
175 TS2305 — Module has no exported member (missing api.ts exports)
 67 TS7006 — Parameter implicitly has 'any' type
 20 TS2339 — Property does not exist on type
  9 TS18046 — Is of type 'unknown'
  8 TS2322 — Type not assignable
  6 TS2345 — Argument type not assignable
  3 TS2769 — No overload matches
  2 TS2724 — Did you mean? (typos)
  2 TS2551 — Did you mean? (typos)
  2 TS2304 — Cannot find name
  2 TS2352 — Type conversion mistake
  2 TS2307 — Cannot find module
```

## Success Criteria
1. `cd client && npx tsc -b --noEmit` → 0 errors
2. `cd server && npx tsc --noEmit` → 0 errors
3. `docker compose build` → SUCCESS
4. `docker compose up -d` → all 5 services running

## Rules
- Do NOT delete features or components
- Do NOT change business logic
- Prefer minimal fixes (type annotations, stubs, casts)
- Use `// @ts-expect-error` only as absolute last resort
- Create marker files when each agent completes

