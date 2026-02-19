#!/bin/bash
# Setup only — no tmux attach (used from non-interactive context)
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

SESSION="gl-audit"
PROJECT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"

echo "[1/5] Killing any stale gl-audit session..."
tmux kill-session -t "$SESSION" 2>/dev/null || true

echo "[2/5] Creating tmux session: $SESSION"
tmux new-session -d -s "$SESSION" -c "$PROJECT" -x 240 -y 55

tmux set-option -t "$SESSION" status-style "bg=colour235,fg=colour246"
tmux set-option -t "$SESSION" status-left "#[fg=colour33,bold] GL-AUDIT #[fg=colour246]| "
tmux set-option -t "$SESSION" status-right "#[fg=colour33]GOLDLEDGER AGENT AUDIT"
tmux set-option -t "$SESSION" pane-active-border-style "fg=colour33"
tmux set-option -t "$SESSION" mouse on

echo "[3/5] Launching Claude Code in session..."
tmux send-keys -t "$SESSION" "cd '$PROJECT' && claude --dangerously-skip-permissions" Enter

echo "[4/5] Waiting 12s for Claude to initialize..."
sleep 12

echo "[5/5] Sending audit orchestration prompt..."
PROMPT="Run a full GoldLedger codebase audit using the agent team. You are the audit-lead agent (see .claude/agents/audit-lead.md). Spawn 6 specialist agents in parallel using the Task tool: audit-typescript, audit-security, audit-routes, audit-schema, audit-services, audit-client. First use TeamCreate to create team 'goldledger-audit'. Then spawn all 6 via Task tool simultaneously. Each agent will report back via SendMessage. First query hive memory with mcp__cognee-agent-teams__search for prior audit findings. Compile all findings into docs/AUDIT_REPORT.md and store to Cognee dataset hive_audit_findings when done."

tmux send-keys -t "$SESSION" "$PROMPT" Enter

echo ""
echo "DONE — session ready: $SESSION"
tmux ls | grep "$SESSION"
