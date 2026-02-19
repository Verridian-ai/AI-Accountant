# AGENT-03: reviewer
# Wave 2 — Final Verification, Report, Commit
# Model: claude-opus-4-5
# START CONDITION: Both Wave 1 agents have messaged DONE

## YOUR MISSION
You are the Opus reviewer. Verify all Wave 1 work, run the final quality gate,
write the team report, and commit everything to main. You also verify the hive
memory system is fully operational by querying it and confirming Wave 1 agents
wrote their learnings correctly.

## FILES YOU OWN
- agent-team-8/TEAM8-REPORT.md (create this)
- You may fix any remaining issues in any file

---

## STEP 1: QUERY HIVE MEMORY (mandatory — do this first)

```
mcp__cognee-agent-teams__get_developer_rules()
```

```
mcp__cognee-agent-teams__search(
  query_text="agent team 8 validation results",
  query_type="GRAPH_COMPLETION"
)
```

```
mcp__cognee-agent-teams__search(
  query_text="cognee sessions fixer findings",
  query_type="CHUNKS"
)
```

```
mcp__cognee-agent-teams__list_data()
```

Verify that Wave 1 agents wrote their learnings to hive memory.
If `hive_agent_decisions` and `hive_audit_fixes` have new entries from this session,
the hive memory write cycle is confirmed working.

---

## STEP 2: VERIFY WAVE 1 WORK

### Check hive-validator output
- Read `agent-team-8/HIVE-VALIDATION-REPORT.md`
- Verify all checks passed
- If any checks failed, investigate and fix

### Check cognee-sessions-fixer output
- Run `cd server && npx tsc --noEmit`
- Verify 0 errors
- Review any commits made by agent-02
- Check `server/src/services/cognee-sessions.ts` and `server/src/services/cognee/`

---

## STEP 3: FINAL QUALITY GATE

```bash
cd server && npx tsc --noEmit
```

```bash
cd client && npx tsc --noEmit
```

Both must show **0 errors**. Fix any remaining issues before proceeding.

---

## STEP 4: WRITE TEAM REPORT

Create `agent-team-8/TEAM8-REPORT.md`:

```markdown
# Agent Team 8 — Hive Memory Integration Test Report
**Date**: [today]
**Team**: hive-validator + cognee-sessions-fixer + reviewer (Opus)

## Mission
Validate that agent-cognee hive memory system works end-to-end with real agent teams.

## Hive Memory System Status
- Stack: [all 5 containers healthy / issues found]
- MCP endpoint: http://localhost:9021/mcp — [operational/failed]
- Datasets: [count] datasets available
- Search (CHUNKS): [working/failed]
- Search (GRAPH_COMPLETION): [working/failed]
- codify (code indexing): [working/failed]
- Write (cognify): [working/failed]
- Read/write cycle: [CONFIRMED/FAILED]

## Wave 1 Results

### agent-01 hive-validator
[summary of what was validated and found]

### agent-02 cognee-sessions-fixer
[summary of what was fixed in cognee-sessions.ts]

## TypeScript Quality Gate
- Server tsc: [0 errors / N errors]
- Client tsc: [0 errors / N errors]

## Hive Memory Write Verification
[List the entries that Wave 1 agents wrote to hive memory — confirms the loop works]

## Commits Made
[list all commits from this session]

## Verdict
[PASS/FAIL] — Hive memory integration with agent teams is [fully operational/needs fixes]

## For Future Agent Teams
The hive memory system is now ready. Every future team should:
1. Start with: mcp__cognee-agent-teams__get_developer_rules()
2. Search before reading files
3. Write learnings before messaging DONE
4. The MCP server is at http://localhost:9021/mcp (cognee-agent-teams in .mcp.json)
```

---

## STEP 5: STORE SESSION SUMMARY TO HIVE MEMORY

```
mcp__cognee-agent-teams__cognify(
  data="Agent team 8 complete (reviewer, Opus). Hive memory integration validated. All 5 containers healthy. 15 datasets operational. Read/write cycle confirmed. codify indexing working. cognee-sessions.ts audited and fixed. Future teams: use mcp__cognee-agent-teams__get_developer_rules() at session start, search before reading files, write learnings before DONE.",
  dataset_name="hive_agent_decisions"
)
```

```
mcp__cognee-agent-teams__cognify(
  data="Hive memory integration pattern for agent teams: 1) get_developer_rules() at start, 2) search GRAPH_COMPLETION + CHUNKS before reading files, 3) cognify learnings to appropriate dataset before DONE, 4) MCP server: cognee-agent-teams at http://localhost:9021/mcp, 5) Stack: docker compose -p agent-cognee up -d",
  dataset_name="hive_agent_patterns"
)
```

---

## STEP 6: FINAL COMMIT

```bash
git add -A && git commit -m "feat(TEAM8): hive memory integration validated — agent teams + cognee fully operational

- HIVE-VALIDATION-REPORT.md: confirms all 5 containers healthy, 15 datasets, search working
- cognee-sessions.ts: audited and fixed
- TEAM8-REPORT.md: full integration test results
- Hive memory read/write cycle confirmed end-to-end"
```

---

## DONE

Message the lead: `DONE: reviewer — TEAM COMPLETE`
