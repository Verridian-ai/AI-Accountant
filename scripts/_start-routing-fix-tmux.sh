#!/bin/bash
# GoldLedger Routing Fix — Agent Team Launcher
# 7 agents: rfx-lead + 6 specialists executing 52 tasks from ROUTING_DB_PLAN.md
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

SESSION="gl-routing-fix"
PROJECT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"

echo "[1/5] Killing stale session..."
tmux kill-session -t "$SESSION" 2>/dev/null || true

echo "[2/5] Checking Cognee hive memory..."
python3 -c "
import urllib.request, sys
try:
    urllib.request.urlopen('http://localhost:9021/mcp')
    print('  agent-cognee MCP (9021) UP')
except Exception as e:
    print('  WARNING: agent-cognee offline -', e)
" 2>/dev/null || echo "  WARNING: agent-cognee check skipped"

echo "[3/5] Creating tmux session: $SESSION"
tmux new-session -d -s "$SESSION" -c "$PROJECT" -x 240 -y 55

tmux set-option -t "$SESSION" status-style "bg=colour235,fg=colour246"
tmux set-option -t "$SESSION" status-left "#[fg=colour208,bold] GL-ROUTING-FIX #[fg=colour246]| "
tmux set-option -t "$SESSION" status-right "#[fg=colour246]%H:%M | #[fg=colour208]6-AGENT TEAM"
tmux set-option -t "$SESSION" pane-active-border-style "fg=colour208"
tmux set-option -t "$SESSION" mouse on

echo "[4/5] Launching Claude Code (opus)..."
tmux send-keys -t "$SESSION" "cd '$PROJECT' && claude --dangerously-skip-permissions" Enter

echo "Waiting 14s for Claude to initialize..."
sleep 14

echo "[5/5] Sending routing fix orchestration prompt..."

PROMPT="You are the rfx-lead agent (see .claude/agents/rfx-lead.md). Your mission: coordinate 6 specialist agents to execute all 52 atomic tasks from docs/ROUTING_DB_PLAN.md.

CONTEXT — Critical Issues to Fix:
1. neon-connection.ts dual-pool BUILT but never wired — all traffic through wrapPgDb() which returns 'any'
2. 19 POST/PUT/PATCH handlers missing zValidator (CLAUDE.md Rule 7 violation)
3. migration.ts + migration-ext.ts have NO auth — live vulnerability
4. transfers.ts, payroll.ts, batch-uploads.ts — money/PII endpoints unprotected
5. 4 deprecated db/ files safe to delete
6. 8 route files >300 lines, 28 parseInt() missing radix 10

AGENT ROSTER:
- rfx-db-foundation (subagent_type=general-purpose): TASK-001–007, model=opus
- rfx-route-validator (subagent_type=general-purpose): TASK-008–016, model=sonnet
- rfx-security (subagent_type=general-purpose): TASK-017–025, model=sonnet
- rfx-code-quality (subagent_type=general-purpose): TASK-026–037, model=sonnet
- rfx-schema-migrator (subagent_type=general-purpose): TASK-038–047, model=opus
- rfx-ops-gate (subagent_type=general-purpose): TASK-048–052 + verification, model=sonnet

Step 1: Query hive memory for prior routing/security findings.
Step 2: Record baseline metrics (TSC errors, zValidator gaps, auth gaps, parseInt count).
Step 3: TeamCreate team 'goldledger-routing-fix'.
Step 4: Launch Wave 1 — spawn rfx-db-foundation, rfx-route-validator, rfx-security simultaneously via Task tool. Also send rfx-code-quality their Wave 1 parseInt tasks.
Step 5: Await all Wave 1 DONE messages. Run Phase 1+2+3 verification gates.
Step 6: Launch Wave 2 — spawn rfx-schema-migrator + message rfx-code-quality to do Wave 2 file splitting.
Step 7: Await Wave 2 DONE. Run Phase 4 verification gate.
Step 8: Launch Wave 3 — spawn rfx-ops-gate.
Step 9: Await rfx-ops-gate DONE. Present executive summary with before/after metrics."

tmux send-keys -t "$SESSION" "$PROMPT" Enter

echo ""
echo "DONE — session ready: $SESSION"
tmux ls | grep "$SESSION"
echo ""
echo "To attach: wsl.exe bash /mnt/c/Users/Danie/Desktop/_gl_routing_fix_attach.sh"
