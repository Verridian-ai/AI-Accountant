# AGENT-TEAM-8 — Hive Memory Integration Test Team

## MISSION
Verify that the agent-cognee hive memory system works end-to-end with real agent team sessions.
This team will: read from hive memory, do real work, write back to hive memory, and prove the
collective intelligence loop is functioning. This is the validation team.

## MODELS
- All agents: claude-sonnet-4-6
- Reviewer: claude-opus-4-6

## PROJECT ROOT
/mnt/c/Users/Danie/Desktop/CBA Statements Parse

## HIVE MEMORY — MANDATORY FOR ALL AGENTS

**MCP Server**: `cognee-agent-teams` → `http://localhost:9021/mcp`

### EVERY AGENT MUST DO THIS AT SESSION START:
```
1. mcp__cognee-agent-teams__get_developer_rules()
2. mcp__cognee-agent-teams__search(search_query="[your task area]", search_type="GRAPH_COMPLETION")
3. mcp__cognee-agent-teams__search(search_query="[your task area]", search_type="CHUNKS")
```

### EVERY AGENT MUST DO THIS BEFORE MESSAGING DONE:
```
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-8-session-YYYY-MM-DD-NNN] [AGENT_SESSION: agent-NN-ROLE-YYYY-MM-DD-NNN] [summary of what you did, decisions made, bugs found, fixes applied]"
)
```

---

## GLOBAL RULES

1. NEVER use `@ts-ignore` or `@ts-expect-error`
2. NEVER use `as any`
3. Run `cd server && npx tsc --noEmit` after every server change — 0 errors
4. Run `cd client && npx tsc --noEmit` after every client change — 0 errors
5. Commit after each logical fix: `git add -A && git commit -m "fix(TEAM8-NNN): description"`
6. NEVER edit files owned by another teammate
7. Query hive memory BEFORE reading any files
8. Store learnings to hive memory BEFORE messaging DONE

---

## WAVE STRUCTURE

### WAVE 1 (parallel — start immediately)
- **agent-01-hive-validator**: Validates hive memory is working, indexes the codebase, writes a full health report
- **agent-02-cognee-sessions-fixer**: Reads hive memory for context, fixes `cognee-sessions.ts` and related cognee service files

### WAVE 2 (after Wave 1 DONE)
- **agent-03-reviewer**: Opus reviewer — verifies all work, runs final tsc, writes TEAM8-REPORT.md, commits to main

---

## WAVE 1 ASSIGNMENTS

### AGENT-01: hive-validator (model: claude-sonnet-4-6)
**Task file**: agent-team-8/tasks/agent-01-hive-validator.md

### AGENT-02: cognee-sessions-fixer (model: claude-sonnet-4-6)
**Task file**: agent-team-8/tasks/agent-02-cognee-sessions-fixer.md

---

## WAVE 2 ASSIGNMENTS

### AGENT-03: reviewer (model: claude-opus-4-6)
**Task file**: agent-team-8/tasks/agent-03-reviewer.md
**Start condition**: Both Wave 1 agents have messaged DONE

---

## DONE SIGNALS

Each agent messages the lead when complete:
- `DONE: hive-validator`
- `DONE: cognee-sessions-fixer`
- `DONE: reviewer — TEAM COMPLETE`

---

## PLUGINS AVAILABLE

All agents have access to:
- `/gl-hive search "query"` — query hive memory
- `/gl-hive store "content" dataset` — write to hive memory
- `/gl-hive rules` — get developer rules
- `/gl-tsc` — full TypeScript check
- `/gl-fix [area]` — diagnose → fix → verify → commit
- `/gl-audit [scope]` — targeted sweep
- `/commit` — smart git commit
- `/write-plan` — create implementation plan
- `/execute-plan` — execute plan in batches
