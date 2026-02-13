# Wave V: Pre-Execution Validation & Dependency Check (Waves 11-23)

You are the **Team Lead** for the Validation Wave. You coordinate **4 agents** to verify that Waves 11-23 code actually works despite Waves 1-10 never being executed. Find broken references, fix compilation errors, verify Docker deployment, and protect user data.

## Problem Statement

Waves 1-10 were **planned but never executed**. Waves 11-23 have already run and produced code. Since later waves may reference Wave 1-10 features (schemas, agents, API routes, UI components), we need to verify everything compiles, builds, and runs correctly.

## Team Structure (4 Agents, Sequential)

| Agent | ID | Focus |
|-------|----|-------|
| Dependency Auditor | 01 | Scan Waves 11-23 code for broken references to Wave 1-10 features |
| Build & Compile Validator | 02 | Run `tsc --noEmit`, `npm run build`, check migrations sequence |
| Docker & Data Integrity | 03 | `docker compose up`, health checks, verify user financial data intact |
| Fixer & Committer | 04 | Fix issues found by 01-03, commit all changes to git |

## Execution Order

```
Agent 01 (audit) ──► Agent 02 (build) ──► Agent 03 (docker) ──► Agent 04 (fix & commit)
```

Agents 01-03 are **read-only** — they document issues but do NOT modify code.
Agent 04 is the ONLY agent that modifies files and commits.

## Key Directories to Scan

- `server/src/schema.ts` — All SQLite table definitions
- `server/src/db/postgres-schema.ts` — All PostgreSQL table definitions
- `server/src/index.ts` — Main server with all route imports and table imports
- `server/src/services/` — All service files including Claude agents
- `server/src/routes/` — All API route files
- `client/src/App.tsx` — Main app with all component imports and routes
- `client/src/api.ts` — API client with all endpoint functions
- `client/src/features/` — All feature UI components
- `docker/migrations/` — All SQL migration files (0001 through latest)
- `docker-compose.yml` — Docker stack (5 services)

## What Waves 1-10 Were Supposed to Build

- **Wave 1**: Chat→Agent bridge, intent router, PostgreSQL schema sync (31 tables)
- **Wave 2**: Transaction mutation tools, SSE streaming, audit trail, confirmation flow
- **Wave 3**: Multi-user Cognee, per-user dataset prefixing, Redis session memory
- **Wave 4**: Employee management, pay structures, TFN encryption
- **Wave 5**: Pay run processing, PAYG calculator, super calculator
- **Wave 6**: STP compliance, payslip generation, award interpreter
- **Wave 7**: Customer management, invoice engine, PDF generation
- **Wave 8**: Recurring invoices, payment gateway, dunning
- **Wave 9**: AR aging, multi-currency support
- **Wave 10**: Accounts payable, purchase orders, three-way matching

## Completion Markers

- `.agent-done-WV-01` through `.agent-done-WV-04`

## CRITICAL: Data Safety

**Agent 04 MUST NOT delete or modify any user data tables or rows.** Only fix code files (TypeScript, CSS, SQL migrations, config). If a fix could affect data, document it and skip — let the user decide.

## START

Spawn all 4 agents sequentially. Agent 01 starts immediately.

