# GoldLedger Auth-Fix Agent Team — Launch Guide

## What this team does

Fixes the **26 security issues** identified in `docs/BACKEND_AUDIT_REPORT.md` using a
**6-agent team** across 3 sequential waves.

---

## Prerequisites

### 1. Agent Teams Feature Enabled
Already enabled in `.claude/settings.local.json`:
```json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

### 2. Cognee Hive Memory Running
```bash
# Check it's up:
curl -s http://localhost:9021/health
# If not running:
docker compose -p agent-cognee -f ~/Desktop/agent-cognee/docker-compose.yml up -d
```

### 3. Baseline Git State
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse"
git status
git stash  # if any uncommitted changes
```

---

## Team Architecture

```
fix-lead (Team Lead — orchestrates, verifies, shuts down)
  │
  ├── Wave 1 (parallel — no file conflicts)
  │   ├── auth-hardener      → CRIT-01, CRIT-02, HIGH-03, HIGH-04, HIGH-07, MED-01, MED-06
  │   ├── zvalidator-enforcer → CRIT-03 (55 routes missing zValidator)
  │   └── error-sanitizer    → HIGH-02 (err.message leaks in 30+ files)
  │
  ├── Wave 2 (after Wave 1 complete)
  │   └── schema-guardian    → HIGH-05, MED-02, LOW-05
  │
  └── Wave 3 (final)
      └── quality-verifier   → TSC verification, VERIFICATION_REPORT.md, hive memory
```

---

## Skill Assignment

| Agent | Skills |
|-------|--------|
| `fix-lead` | multi-agent-patterns, cognee-hive-memory, ctx-multi-agent, obra-verification |
| `auth-hardener` | security-auth-patterns, better-auth-best-practices, community-security-blue, api-design-hono-patterns, obra-systematic-debug |
| `zvalidator-enforcer` | api-design-hono-patterns, typescript-advanced-patterns, error-handling-patterns, obra-verification |
| `error-sanitizer` | error-handling-patterns, api-design-hono-patterns, obra-systematic-debug, typescript-advanced-patterns |
| `schema-guardian` | database-drizzle-patterns, neon-postgres, community-postgres, security-auth-patterns, obra-verification |
| `quality-verifier` | obra-verification, cognee-hive-memory, community-deep-research, obra-request-review |

---

## Launch Command

Paste this **exact prompt** into Claude Code to launch the team:

```
You are fix-lead, the team lead for the GoldLedger Auth-Fix team.

Read your agent file at `.claude/agents/fix-lead.md` and follow the STARTUP SEQUENCE exactly.

Your mission: Fix all 26 backend security issues from `docs/BACKEND_AUDIT_REPORT.md`
using a 6-agent team with the following wave structure:

- Wave 1 (parallel): auth-hardener, zvalidator-enforcer, error-sanitizer
- Wave 2 (after Wave 1): schema-guardian
- Wave 3 (after Wave 2): quality-verifier

Agent files are at:
  .claude/agents/fix-lead.md
  .claude/agents/auth-hardener.md
  .claude/agents/zvalidator-enforcer.md
  .claude/agents/error-sanitizer.md
  .claude/agents/schema-guardian.md
  .claude/agents/quality-verifier.md

Cognee Hive Memory MCP: cognee-agent-teams at http://localhost:9021/mcp
Query hive memory first, then create the team, create all tasks, and spawn Wave 1.
Do NOT write code yourself — delegate everything to teammates.
```

---

## Monitoring Progress

**In-process mode** (default — all agents in your terminal):
- `Shift+Down` — cycle through active teammates
- `Ctrl+T` — toggle task list view

**Split-pane mode** (requires tmux):
```bash
claude --teammate-mode tmux
```

---

## Expected Timeline

| Phase | Duration | What happens |
|-------|----------|-------------|
| Setup | 1 min | Lead queries hive memory, creates team + 8 tasks |
| Wave 1 | 10-20 min | 3 agents fix auth, validation, error handling in parallel |
| Wave 2 | 5-10 min | schema-guardian fixes DB schema + refresh token rotation |
| Wave 3 | 3-5 min | quality-verifier runs all checks, writes report, commits |
| Shutdown | 1 min | Lead gracefully shuts down teammates, cleans up |

---

## Expected Deliverables

- ✅ CRIT-01: `auth-routes.ts` password validation upgraded (min 1 → min 8 + complexity)
- ✅ CRIT-02: Rate limiting on ALL refresh endpoints
- ✅ CRIT-03: `zValidator` on all 55 missing mutating routes
- ✅ HIGH-02: `err.message` sanitized from 30+ route files
- ✅ HIGH-03: Legacy token tenant membership check enforced
- ✅ HIGH-04: CORS hardened — localhost blocked in production
- ✅ HIGH-05: Tenant refresh token rotation implemented
- ✅ HIGH-07: `validatePassword()` called in `AuthService.register()`
- ✅ MED-01: 256-bit invitation tokens
- ✅ MED-02: Role `pgEnum` constraint in DB schema
- ✅ MED-06: `parseInt(x, 10)` radix fixed in 10 locations
- ✅ LOW-05: JSON columns migrated to JSONB
- ✅ `docs/VERIFICATION_REPORT.md` written
- ✅ Cognee Hive Memory updated with all decisions and fixes
- ✅ TypeScript: 0 errors (server + client)

---

## If Something Goes Wrong

| Problem | Solution |
|---------|---------|
| Agent goes silent | `Shift+Down` → type "Status check - what are you working on?" |
| TSC errors after Wave 1 | Message the agent that owns the broken file |
| Agent marks task complete but TSC fails | Tell fix-lead "TSC is failing after Wave 1, send auth-hardener back to fix errors" |
| Hive Memory unreachable | `docker compose -p agent-cognee restart` then retry |
| Teammate not appearing | `Shift+Down` — may already be running but not visible |
