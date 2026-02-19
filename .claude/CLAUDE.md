# GoldLedger — Claude Code Master Configuration

This file is injected into EVERY Claude Code session in this project.
It defines capabilities, memory, tools, and rules that all agents must follow.

---

## HIVE MEMORY (MANDATORY — READ FIRST)

Every session has access to the shared agent team knowledge graph via MCP.

**MCP Server**: `cognee-agent-teams` → `http://localhost:9021/mcp`
**Status check**: `curl http://localhost:9021/health`
**Start if down**: `docker compose -p agent-cognee -f /mnt/c/Users/Danie/Desktop/agent-cognee/docker-compose.yml up -d`

### At the START of every session — query hive memory before anything else:
```
mcp__cognee-agent-teams__search(query_text="[your task area]", query_type="GRAPH_COMPLETION")
mcp__cognee-agent-teams__search(query_text="[your task area]", query_type="CHUNKS")
mcp__cognee-agent-teams__get_developer_rules()
```

### At the END of every session — store learnings:
```
mcp__cognee-agent-teams__cognify(data="[decisions made, root causes, fixes applied]", dataset_name="hive_agent_decisions")
```

### Slash command shortcut:
```
/gl-hive search "query"
/gl-hive store "content" dataset_name
/gl-hive rules
/gl-hive status
```

---

## HIVE MEMORY DATASETS

| Dataset | Purpose |
|---------|---------|
| `hive_agent_decisions` | Architectural decisions and rationale |
| `hive_agent_patterns` | Successful workflows and strategies |
| `hive_agent_errors` | Bugs, root causes, anti-patterns |
| `hive_agent_commits` | Commit history and change rationale |
| `hive_codebase_arch` | System architecture |
| `hive_codebase_routes` | API routes and contracts |
| `hive_codebase_schema` | DB schema and migrations |
| `hive_codebase_services` | Service implementations |
| `hive_codebase_types` | TypeScript types |
| `hive_audit_findings` | Audit issues found |
| `hive_audit_fixes` | Fixes applied |
| `hive_quality_rules` | Code quality rules |
| `hive_gst_rules` | ATO GST rules |
| `hive_tax_knowledge` | Tax brackets and deductions |
| `hive_financial_patterns` | Transaction patterns |

---

## PROJECT IDENTITY

- **Project**: GoldLedger — Australian accounting SaaS
- **Root**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
- **Server**: `server/src/` — Hono + TypeScript + Drizzle + Neon PostgreSQL
- **Client**: `client/src/` — React 19 + TanStack Query + TailwindCSS + shadcn/ui
- **Auth**: JWT + `tenantAuthMiddleware` (X-Tenant-Id header required)
- **DB**: Neon Cloud PostgreSQL (128 tables) via `NEON_DATABASE_URL`

## RUNNING SERVICES

| Service | URL |
|---------|-----|
| App client | http://localhost:8080 |
| App server | http://localhost:3501 |
| Agent-Cognee API | http://localhost:9020 |
| Agent-Cognee MCP | http://localhost:9021/mcp |
| Agent-Cognee Neo4j | http://localhost:9024 |
| Cognee Plugin API | http://localhost:9010 |

---

## ENABLED PLUGINS & SLASH COMMANDS

### Core Workflow
- `/write-plan` — create detailed implementation plan (superpowers)
- `/execute-plan` — execute plan in batches (superpowers)
- `/plan` — plan with risk analysis, wait for approval (everything-claude-code)
- `/orchestrate` — sequential agent workflow (everything-claude-code)
- `/feature-dev` — guided feature development (feature-dev)

### GoldLedger Custom Commands
- `/gl-fix [area]` — diagnose → plan → fix → tsc → commit
- `/gl-audit [scope]` — targeted sweep (routes/schema/services/client/security/all)
- `/gl-tsc` — full TypeScript check server + client
- `/gl-hive search "query"` — query hive memory
- `/gl-hive store "content" dataset` — write to hive memory
- `/gl-hive codify path/` — index code into hive memory
- `/gl-hive rules` — get all stored developer rules
- `/gl-hive status` — list all datasets
- `/gl-migrate` — Drizzle migration generate + review
- `/gl-neon` — query Neon DB directly
- `/gl-agent-team` — scaffold + launch new agent team
- `/gl-ralph` — start iterative Ralph loop

### Quality & Git
- `/commit` — smart git commit (commit-commands)
- `/ralph-loop` — iterative development loop (ralph-loop)

### Specialist Agents
- `gl-ts-expert` — TypeScript type safety specialist
- `gl-security` — security audit specialist
- `gl-schema` — Drizzle schema specialist
- `gl-hive-memory` — hive memory read/write specialist
- `gl-reviewer` — final Opus reviewer

---

## CODE QUALITY RULES (NON-NEGOTIABLE)

1. **NEVER** use `@ts-ignore` or `@ts-expect-error` — fix types properly
2. **NEVER** use `as any` — use proper types or `as unknown as T`
3. Run `cd server && npx tsc --noEmit` after EVERY server change — **0 errors**
4. Run `cd client && npx tsc --noEmit` after EVERY client change — **0 errors**
5. **NEVER** hardcode `localhost` URLs — use `BASE_URL` / `API_URL` constants
6. **NEVER** store secrets in code — use `process.env.X`
7. All route POST/PATCH/PUT **MUST** use `zValidator` for body validation
8. All JWT payload access **MUST** have null guard
9. All `parseInt()` **MUST** have radix 10: `parseInt(x, 10)`
10. Commit after each logical fix: `git add -A && git commit -m "fix(AREA): description"`

## FILE RULES

- No file >300 lines (except tests/generated)
- Every loose `.ts` in `services/` with matching directory = 1-line shim
- Integer money: ALL currency in cents (integer), NEVER float

---

## AGENT TEAM PROTOCOL

When working as part of an agent team:

1. **Session start**: Query hive memory BEFORE reading any files
2. **File ownership**: NEVER edit files owned by another teammate
3. **Quality gate**: Run tsc after every change — 0 errors required
4. **Commit cadence**: Commit after each logical fix
5. **Session end**: Store all learnings to hive memory BEFORE messaging DONE
6. **Done signal**: Message `DONE: [agent-name]` to lead when complete

## WAVE STRUCTURE

- **Wave 1** (parallel): Independent domain workers — Sonnet
- **Wave 2** (after wave 1): Dependent workers — Sonnet
- **Wave 3** (final): Opus reviewer — verify, fix stragglers, commit to main

---

## HOOKS ACTIVE

- **PostToolUse (Edit/Write .ts/.tsx)**: Runs `tsc --noEmit` automatically
- **PreToolUse (git commit)**: Blocks `@ts-ignore` in staged changes
- **PreToolUse (Write .ts/.tsx)**: Blocks dangerous patterns at write time
