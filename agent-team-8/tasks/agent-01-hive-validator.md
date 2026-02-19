# AGENT-01: hive-validator
# Wave 1 — Hive Memory Validation & Codebase Indexing
# Model: claude-sonnet-4-5

## YOUR MISSION
Prove the hive memory system works end-to-end. Read from it, index the codebase into it,
write a validation report, and confirm the collective intelligence loop is operational.
This is the most important test — if you succeed, every future agent team benefits.

## FILES YOU OWN
- agent-team-8/HIVE-VALIDATION-REPORT.md (create this)
- You do NOT modify any source code files

---

## STEP 1: QUERY HIVE MEMORY (do this FIRST — before anything else)

```
mcp__cognee-agent-teams__get_developer_rules()
```
Record what rules are returned.

```
mcp__cognee-agent-teams__search(
  query_text="GoldLedger code quality rules TypeScript",
  query_type="GRAPH_COMPLETION"
)
```
Record the response.

```
mcp__cognee-agent-teams__search(
  query_text="agent team patterns and wave structure",
  query_type="CHUNKS"
)
```
Record the response.

```
mcp__cognee-agent-teams__search(
  query_text="known bugs and anti-patterns GoldLedger",
  query_type="CHUNKS"
)
```
Record the response.

```
mcp__cognee-agent-teams__list_data()
```
Record all datasets and their content counts.

---

## STEP 2: INDEX THE CODEBASE INTO HIVE MEMORY

Use `codify` to build code-specific knowledge graphs from the actual source:

```
mcp__cognee-agent-teams__codify(
  source_code_path="/mnt/c/Users/Danie/Desktop/CBA Statements Parse/server/src/routes"
)
```

```
mcp__cognee-agent-teams__codify(
  source_code_path="/mnt/c/Users/Danie/Desktop/CBA Statements Parse/server/src/schema"
)
```

```
mcp__cognee-agent-teams__codify(
  source_code_path="/mnt/c/Users/Danie/Desktop/CBA Statements Parse/server/src/services/cognee"
)
```

---

## STEP 3: WRITE NEW KNOWLEDGE TO HIVE MEMORY

Store the current state of the codebase as a snapshot:

```
mcp__cognee-agent-teams__cognify(
  data="Codebase snapshot (agent-team-8, 2026-02-19): GoldLedger server has 63 route files, 19 schema files, 26 Claude AI agents. Client has React 19 + TanStack Query. Auth uses JWT + tenantAuthMiddleware + X-Tenant-Id header. All currency in integer cents. Neon PostgreSQL via NEON_DATABASE_URL. wrapPgDb() proxy adds .get()/.all()/.run() for SQLite compat.",
  dataset_name="hive_codebase_arch"
)
```

```
mcp__cognee-agent-teams__cognify(
  data="Agent team 8 validation: Hive memory system confirmed operational. MCP server cognee-agent-teams at http://localhost:9021/mcp is healthy. 15 hive datasets seeded. CHUNKS and GRAPH_COMPLETION search types working. codify indexing working. Read/write cycle confirmed.",
  dataset_name="hive_agent_decisions"
)
```

---

## STEP 4: WRITE VALIDATION REPORT

Create `agent-team-8/HIVE-VALIDATION-REPORT.md` with:

```markdown
# Hive Memory Validation Report
**Date**: [today]
**Agent**: hive-validator (agent-team-8)

## Stack Health
- agent-cognee-api: [status]
- agent-cognee-mcp: [status]
- agent-cognee-postgres: [status]
- agent-cognee-redis: [status]
- agent-cognee-neo4j: [status]

## MCP Connection
- Endpoint: http://localhost:9021/mcp
- Status: [connected/failed]

## Dataset Inventory
[list all datasets from list_data() with counts]

## Search Test Results
### get_developer_rules()
[paste result]

### GRAPH_COMPLETION: "GoldLedger code quality rules"
[paste result]

### CHUNKS: "agent team patterns"
[paste result]

## Codify Results
- server/src/routes: [status]
- server/src/schema: [status]
- server/src/services/cognee: [status]

## Write Test Results
- hive_codebase_arch write: [status]
- hive_agent_decisions write: [status]

## Verdict
[PASS/FAIL] — Hive memory is [operational/not operational]

## Recommendations
[any issues found, improvements needed]
```

---

## STEP 5: COMMIT

```bash
git add -A && git commit -m "feat(TEAM8-001): hive memory validation report — system confirmed operational"
```

---

## STEP 6: STORE FINAL LEARNINGS TO HIVE MEMORY

```
mcp__cognee-agent-teams__cognify(
  data="Hive validation complete (agent-team-8). All 5 containers healthy. 15 datasets seeded. CHUNKS + GRAPH_COMPLETION search working. codify indexing working. MCP at http://localhost:9021/mcp confirmed. Codebase indexed: routes, schema, cognee services.",
  dataset_name="hive_agent_decisions"
)
```

---

## DONE

Message the lead: `DONE: hive-validator`
