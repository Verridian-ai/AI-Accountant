#!/bin/bash
# GoldLedger Routing + DB Migration Plan — Agent Team Launcher
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

SESSION="gl-routing-plan"
PROJECT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"

echo "[1/5] Killing stale session..."
tmux kill-session -t "$SESSION" 2>/dev/null || true

echo "[2/5] Checking Cognee hive memory..."
curl -s http://localhost:9021/health > /dev/null 2>&1 && echo "  agent-cognee MCP (9021) UP" || echo "  WARNING: agent-cognee offline"

echo "[3/5] Creating tmux session: $SESSION"
tmux new-session -d -s "$SESSION" -c "$PROJECT" -x 240 -y 55

tmux set-option -t "$SESSION" status-style "bg=colour236,fg=colour246"
tmux set-option -t "$SESSION" status-left "#[fg=colour214,bold] GL-ROUTING-PLAN #[fg=colour246]| "
tmux set-option -t "$SESSION" status-right "#[fg=colour246]%H:%M | #[fg=colour214]AGENT TEAM"
tmux set-option -t "$SESSION" pane-active-border-style "fg=colour214"
tmux set-option -t "$SESSION" mouse on

echo "[4/5] Launching Claude Code (opus)..."
tmux send-keys -t "$SESSION" "cd '$PROJECT' && claude --dangerously-skip-permissions" Enter

echo "Waiting 12s for Claude to initialize..."
sleep 12

echo "[5/5] Sending routing plan orchestration prompt..."

PROMPT="You are the routing-plan-lead agent (see .claude/agents/routing-plan-lead.md). Your mission is to produce docs/ROUTING_DB_PLAN.md — a research report + atomic task plan for migrating GoldLedger's routing layer and DB connections from SQLite proxies to Neon DB with industry best practices. NO CODE CHANGES — research, audit, and plan only.

Step 1: Query hive memory (mcp__cognee-agent-teams__search) for 'routing database SQLite Neon migration' and 'zValidator middleware anti-patterns'.

Step 2: Get current state — run: find server/src/routes -name '*.ts' | wc -l && grep -rn 'better-sqlite\|sqliteTable\|sqlite3' server/src/ --include='*.ts' -l && ls server/src/db/

Step 3: Use TeamCreate to create team 'goldledger-routing-plan', then use Task tool to spawn these 4 agents simultaneously:
- best-practices-researcher: research Neon DB + Hono routing best practices using Context7 (mcp__plugin_context7_context7__*) and WebSearch
- routing-auditor: audit all 51+ route files for zValidator coverage, auth middleware, error handling, patterns
- db-connection-auditor: map all SQLite usage, all DB connection files, Neon connection config, use mcp__neon__* to inspect live DB
- plan-writer: wait for the other 3 reports, then synthesize into atomic task plan and write docs/ROUTING_DB_PLAN.md

Step 4: Wait for all 3 research/audit agents to send findings via SendMessage, then forward all findings to plan-writer and unblock them.

Step 5: Once plan-writer is done, store key findings to mcp__cognee-agent-teams__cognify in dataset hive_agent_decisions.

Step 6: Present me with the executive summary of docs/ROUTING_DB_PLAN.md."

tmux send-keys -t "$SESSION" "$PROMPT" Enter

echo ""
echo "DONE — session ready: $SESSION"
tmux ls | grep "$SESSION"
