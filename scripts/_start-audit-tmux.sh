#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

SESSION="gl-audit"
PROJECT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"

# Kill stale session
tmux kill-session -t "$SESSION" 2>/dev/null && echo "Killed old session" || echo "No old session to kill"

# Check Cognee hive memory
echo "Checking agent-cognee MCP..."
curl -s http://localhost:9021/health > /dev/null 2>&1 && echo "  cognee-agent-teams (9021) UP" || echo "  WARNING: cognee offline"

# Create session
tmux new-session -d -s "$SESSION" -c "$PROJECT" -x 240 -y 55

# Style
tmux set-option -t "$SESSION" status-style "bg=colour235,fg=colour246"
tmux set-option -t "$SESSION" status-left "#[fg=colour33,bold] GL-AUDIT #[fg=colour246]| "
tmux set-option -t "$SESSION" status-right "#[fg=colour246]%H:%M | #[fg=colour33]AGENT TEAM"
tmux set-option -t "$SESSION" pane-active-border-style "fg=colour33"
tmux set-option -t "$SESSION" mouse on

echo "Session created."
tmux ls

# Start Claude
echo "Starting Claude (opus)..."
tmux send-keys -t "$SESSION" "cd '$PROJECT' && claude --dangerously-skip-permissions" Enter

# Wait for Claude to initialize
echo "Waiting 10s for Claude to initialize..."
sleep 10

# Send the audit prompt
PROMPT="Run a full GoldLedger codebase audit using the agent team. You are the audit-lead agent. Spawn 6 specialist agents in parallel: audit-typescript, audit-security, audit-routes, audit-schema, audit-services, audit-client. Use TeamCreate to create team 'goldledger-audit', then spawn all agents via Task tool. First query hive memory (mcp__cognee-agent-teams__search) for prior audit findings. Each agent should report back via SendMessage when done. Compile all findings into docs/AUDIT_REPORT.md and store to Cognee dataset 'hive_audit_findings'."

tmux send-keys -t "$SESSION" "$PROMPT" Enter

echo ""
echo "=== AUDIT TEAM LAUNCHED ==="
echo "Attaching to session (Ctrl+B D to detach)..."
sleep 2
tmux attach -t "$SESSION"
