# AGENT-02: cognee-sessions-fixer
# Wave 1 — Fix cognee-sessions.ts using hive memory context
# Model: claude-sonnet-4-6

## YOUR MISSION
Use hive memory to understand the codebase context, then audit and fix
`server/src/services/cognee-sessions.ts` and the surrounding cognee service files.
This proves agents can use hive memory to get context BEFORE reading files.

## FILES YOU OWN
- server/src/services/cognee-sessions.ts
- server/src/services/cognee/ (all files in this directory)
- Do NOT touch routes/, schema/, or client/

---

## STEP 1: QUERY HIVE MEMORY FIRST (before reading any files)

```
mcp__cognee-agent-teams__get_developer_rules()
```

```
mcp__cognee-agent-teams__search(
  search_query="cognee sessions service TypeScript implementation",
  search_type="GRAPH_COMPLETION"
)
```

```
mcp__cognee-agent-teams__search(
  search_query="cognee service architecture and patterns",
  search_type="CHUNKS"
)
```

```
mcp__cognee-agent-teams__search(
  search_query="known bugs in cognee services",
  search_type="CHUNKS"
)
```

Use what you learn from hive memory to guide your approach BEFORE opening any files.

---

## STEP 2: READ YOUR FILES

Now read the files you own:
1. `server/src/services/cognee-sessions.ts`
2. `server/src/services/cognee/` — list all files, read each one
3. Check if there's a `server/src/services/cognee.ts` shim file

---

## STEP 3: AUDIT CHECKLIST

For each file in `server/src/services/cognee/`:

### TypeScript Quality
- [ ] No `@ts-ignore` or `@ts-expect-error`
- [ ] No `as any` — use proper types
- [ ] All function parameters typed
- [ ] All return types explicit
- [ ] No implicit `any` from untyped parameters

### Code Quality
- [ ] No file >300 lines — split if needed
- [ ] Proper error handling (try/catch with typed errors)
- [ ] No hardcoded URLs — use env vars
- [ ] No console.log left in production code (use logger)

### Shim Pattern
- [ ] If `server/src/services/cognee.ts` exists and there's a `cognee/` directory,
      it must be a 1-line shim: `export * from './cognee/index.js'`
- [ ] `server/src/services/cognee/index.ts` must exist as barrel

### Cognee-Sessions Specific
- [ ] Session creation/retrieval properly typed
- [ ] Redis connection errors handled gracefully
- [ ] Session TTL/expiry logic correct
- [ ] No hardcoded session keys

---

## STEP 4: FIX ALL ISSUES FOUND

Fix each issue found in the audit. After each fix:
```bash
cd server && npx tsc --noEmit
```
Must show 0 errors before proceeding.

Commit after each logical fix:
```bash
git add -A && git commit -m "fix(TEAM8-NNN): [description]"
```

---

## STEP 5: STORE FINDINGS TO HIVE MEMORY

After completing fixes, store what you found:

```
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-8-session-2026-02-19-001] [AGENT_SESSION: agent-02-cognee-sessions-fixer-2026-02-19-001] cognee-sessions.ts audit: [list issues found and fixed]. Files: server/src/services/cognee-sessions.ts, server/src/services/cognee/. Root causes: [list]. Fixes applied: [list]."
)
```

```
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-8-session-2026-02-19-001] [AGENT_SESSION: agent-02-cognee-sessions-fixer-2026-02-19-001] cognee service pattern: [describe the correct pattern for cognee services in this codebase, what you learned]"
)
```

---

## STEP 6: QUALITY GATE

```bash
cd server && npx tsc --noEmit
```

Must show **0 errors**. If errors exist, fix them before proceeding.

---

## DONE

Message the lead: `DONE: cognee-sessions-fixer`
