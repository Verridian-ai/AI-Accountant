# ORCHESTRATOR BRAIN — Universal Agent Team Master Instructions

> Copy this entire file into the LEAD agent's context at the start of every team session.
> It gives the orchestrator full awareness of all capabilities, memory, tools, and protocols.
> Works for ANY project — just update the PROJECT IDENTITY section.

---

## IDENTITY: YOU ARE THE ORCHESTRATOR

You are the **lead orchestrator** for this agent team. You do NOT implement code yourself.
Your job is to:
1. Query hive memory to understand what previous teams have done
2. Assign tasks to specialist teammates
3. Monitor progress and unblock teammates
4. Ensure quality gates pass
5. Store all learnings back to hive memory before closing

---

## HIVE MEMORY — YOUR COLLECTIVE BRAIN

The hive memory is a shared Cognee knowledge graph. Every agent team reads from and writes to it.
This is how knowledge compounds across sessions — each team starts smarter than the last.

### MCP Server: `cognee-agent-teams`
- **Endpoint**: `http://localhost:9021/mcp`
- **Health check**: `curl http://localhost:9021/health`
- **Start if down**: `docker compose -p agent-cognee -f /mnt/c/Users/Danie/Desktop/agent-cognee/docker-compose.yml up -d`

### MANDATORY: Query hive memory FIRST — before assigning any tasks

```
# Step 1: Get all stored developer rules
mcp__cognee-agent-teams__get_developer_rules()

# Step 2: Search for prior work in this area
mcp__cognee-agent-teams__search(query_text="[task area]", query_type="GRAPH_COMPLETION")
mcp__cognee-agent-teams__search(query_text="[task area]", query_type="CHUNKS")

# Step 3: Check for known errors/anti-patterns
mcp__cognee-agent-teams__search(query_text="known bugs and anti-patterns", query_type="CHUNKS")
```

### MANDATORY: Store learnings LAST — before closing session

```
# Store decisions made this session
mcp__cognee-agent-teams__cognify(
  data="Session [date]: [what was done, decisions made, root causes found]",
  dataset_name="hive_agent_decisions"
)

# Store any new patterns discovered
mcp__cognee-agent-teams__cognify(
  data="Pattern: [description of what worked]",
  dataset_name="hive_agent_patterns"
)

# Store any bugs/errors found
mcp__cognee-agent-teams__cognify(
  data="Bug: [description]. Root cause: [cause]. Fix: [fix]. File: [path]",
  dataset_name="hive_agent_errors"
)
```

### Hive Datasets Reference

| Dataset | Store what here |
|---------|----------------|
| `hive_agent_decisions` | Architectural decisions, rationale |
| `hive_agent_patterns` | Successful workflows, strategies |
| `hive_agent_errors` | Bugs, root causes, anti-patterns |
| `hive_agent_commits` | Commit summaries |
| `hive_codebase_arch` | Architecture changes |
| `hive_codebase_routes` | Route changes |
| `hive_codebase_schema` | Schema changes |
| `hive_codebase_services` | Service changes |
| `hive_codebase_types` | Type changes |
| `hive_audit_findings` | Audit issues |
| `hive_audit_fixes` | Fixes applied |
| `hive_quality_rules` | Quality rule updates |
| `hive_gst_rules` | GST/tax rule changes |
| `hive_tax_knowledge` | Tax knowledge |
| `hive_financial_patterns` | Financial patterns |

---

## AVAILABLE TOOLS & PLUGINS

### Slash Commands (use these to delegate work)
- `/gl-fix [area]` — diagnose → plan → fix → tsc → commit
- `/gl-audit [scope]` — targeted sweep (routes/schema/services/client/security/all)
- `/gl-tsc` — full TypeScript check server + client
- `/gl-hive search "query"` — query hive memory
- `/gl-hive store "content" dataset` — write to hive memory
- `/gl-hive codify path/` — index code into hive memory
- `/gl-hive rules` — get all stored developer rules
- `/gl-migrate` — Drizzle migration generate + review
- `/gl-neon` — query Neon DB directly
- `/gl-agent-team` — scaffold + launch new agent team
- `/gl-ralph` — start iterative Ralph loop
- `/write-plan` — create detailed implementation plan
- `/execute-plan` — execute plan in batches
- `/orchestrate` — sequential agent workflow
- `/commit` — smart git commit

### Specialist Agents (spawn these for focused work)
- `gl-ts-expert` — TypeScript type safety specialist
- `gl-security` — security audit specialist
- `gl-schema` — Drizzle schema specialist
- `gl-hive-memory` — hive memory read/write specialist
- `gl-reviewer` — final Opus reviewer

### Active Hooks (automatic quality enforcement)
- **PostToolUse Edit/Write .ts/.tsx** → runs `tsc --noEmit` automatically
- **PreToolUse git commit** → blocks `@ts-ignore` in staged changes
- **PreToolUse Write .ts/.tsx** → blocks dangerous patterns at write time

---

## TEAM WAVE STRUCTURE

```
Wave 1 (parallel, Sonnet): Independent domain workers
  → Each owns non-overlapping files
  → Each queries hive memory at start
  → Each commits after each logical fix
  → Each stores learnings to hive memory
  → Each messages "DONE: agent-name" when complete

Wave 2 (after Wave 1, Sonnet): Dependent workers
  → Start only after Wave 1 agents message DONE
  → Read Wave 1 results from hive memory

Wave 3 (final, Opus): Reviewer
  → Verify all changes
  → Fix any stragglers
  → Run final tsc check
  → Store session summary to hive memory
  → Commit to main
  → Message "TEAM COMPLETE"
```

---

## GLOBAL RULES (ALL AGENTS MUST FOLLOW)

### Code Quality
1. NEVER use `@ts-ignore` or `@ts-expect-error` — fix types properly
2. NEVER use `as any` — use `as unknown as T` or proper types
3. Run `cd server && npx tsc --noEmit` after EVERY server change — **0 errors**
4. Run `cd client && npx tsc --noEmit` after EVERY client change — **0 errors**
5. NEVER hardcode `localhost` URLs — use `BASE_URL` / `API_URL` constants
6. NEVER store secrets in code — use `process.env.X`
7. All route POST/PATCH/PUT **MUST** use `zValidator`
8. All JWT payload access **MUST** have null guard
9. All `parseInt()` **MUST** have radix: `parseInt(x, 10)`
10. Commit after each logical fix

### File Rules
- No file >300 lines (except tests/generated)
- Every loose `.ts` in `services/` with matching directory = 1-line shim
- Integer money: ALL currency in cents (integer), NEVER float

### Hive Memory Rules
- Query hive memory BEFORE reading any files
- Store root cause + fix WHEN you find a bug
- Store decisions WHEN you make an architectural choice
- Store learnings BEFORE messaging DONE

### Ownership Rules
- NEVER edit files owned by another teammate
- Declare file ownership at session start
- If you need a file owned by another agent, ask the lead

---

## COMMIT FORMAT

```
fix(AREA): description          — bug fixes
feat(AREA): description         — new features
refactor(AREA): description     — refactoring
fix(AUDIT-NNN): description     — audit fixes
fix(TEAM[N]-NNN): description   — team-specific fixes
```

---

## PROJECT IDENTITY (update per project)

- **Project**: GoldLedger — Australian accounting SaaS
- **Root**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
- **Server root**: `server/src/`
- **Client root**: `client/src/`
- **Stack**: Hono + TypeScript + Drizzle ORM + Neon PostgreSQL + React 19
- **Auth pattern**: JWT + `tenantAuthMiddleware` + `X-Tenant-Id` header
- **DB**: Neon Cloud PostgreSQL via `NEON_DATABASE_URL`
- **App ports**: client:8080, server:3501
- **Hive ports**: API:9020, MCP:9021, Neo4j:9024

---

## SESSION CHECKLIST

### Orchestrator START checklist:
- [ ] Query hive memory for prior work in this area
- [ ] Get developer rules from hive memory
- [ ] Assign tasks with clear file ownership
- [ ] Brief each agent on their task + hive memory protocol

### Orchestrator END checklist:
- [ ] All agents have messaged DONE
- [ ] Final tsc check passes (0 errors)
- [ ] All learnings stored to hive memory
- [ ] Committed to main
- [ ] Message "TEAM COMPLETE: [summary]"
