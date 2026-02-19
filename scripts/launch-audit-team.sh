#!/bin/bash
# =============================================================================
# GoldLedger Full Audit Agent Team Launcher
# Usage: bash scripts/launch-audit-team.sh
#
# Starts a tmux session with Claude Code in agent-teams mode.
# Claude will spawn 6 specialist audit agents in split panes automatically.
# =============================================================================

set -e

SESSION="gl-audit"
PROJECT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
PROMPT_FILE="$PROJECT/scripts/AUDIT_TEAM_PROMPT.txt"

# Check dependencies
if ! command -v tmux &> /dev/null; then
  echo "ERROR: tmux not found. Install with: sudo apt install tmux"
  exit 1
fi

if ! command -v claude &> /dev/null; then
  echo "ERROR: claude not found. Install Claude Code first."
  exit 1
fi

# Kill any existing session
tmux kill-session -t "$SESSION" 2>/dev/null && echo "Killed existing session: $SESSION" || true

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     GoldLedger Full Audit — Agent Team Launch            ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Session: gl-audit                                       ║"
echo "║  Agents:  1 Lead + 6 Specialists                         ║"
echo "║  Mode:    tmux split panes                               ║"
echo "║  Cognee:  http://localhost:9021/mcp (hive memory)        ║"
echo "║  Cognee:  http://localhost:9010     (app knowledge)      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Verify Cognee is running
echo "Checking Cognee hive memory..."
if curl -s http://localhost:9021/health > /dev/null 2>&1; then
  echo "  ✓ agent-cognee MCP (9021) — online"
else
  echo "  ⚠ agent-cognee MCP offline — starting..."
  docker compose -p agent-cognee \
    -f /mnt/c/Users/Danie/Desktop/agent-cognee/docker-compose.yml up -d \
    2>/dev/null && sleep 5 || echo "  ✗ Could not start agent-cognee"
fi

echo ""
echo "Starting tmux session: $SESSION"

# Create tmux session (one main pane — Claude will split it automatically with tmux mode)
tmux new-session -d -s "$SESSION" -c "$PROJECT" \
  -x "$(tput cols 2>/dev/null || echo 220)" \
  -y "$(tput lines 2>/dev/null || echo 50)"

# Set tmux options for better agent team display
tmux set-option -t "$SESSION" status-style "bg=colour235,fg=colour246"
tmux set-option -t "$SESSION" status-left "#[fg=colour33,bold] GL-AUDIT #[fg=colour246]| "
tmux set-option -t "$SESSION" status-right "#[fg=colour246]%H:%M | #[fg=colour33]AGENT TEAM MODE"
tmux set-option -t "$SESSION" pane-border-style "fg=colour235"
tmux set-option -t "$SESSION" pane-active-border-style "fg=colour33"
tmux set-option -t "$SESSION" mouse on

# Write the audit prompt to a file so it's ready to paste
cat > "$PROMPT_FILE" << 'PROMPT'
Run a full GoldLedger codebase audit using the agent team. You are the audit-lead.

MISSION: Spawn 6 specialist agents in parallel (audit-typescript, audit-security, audit-routes, audit-schema, audit-services, audit-client) and coordinate a comprehensive audit of the entire GoldLedger codebase.

STEPS:
1. Query hive memory: mcp__cognee-agent-teams__search for "audit findings goldledger"
2. Create the team with TeamCreate tool (name: "goldledger-audit")
3. Spawn all 6 agents via Task tool with subagent_type matching their .md file names
4. Create tasks for each agent and assign them
5. Wait for all agents to report DONE via SendMessage
6. Compile findings into docs/AUDIT_REPORT_$(date +%Y%m%d).md
7. Store all findings: mcp__cognee-agent-teams__cognify to dataset "hive_audit_findings"
8. Send me (the user) the executive summary

Use model opus for the lead, sonnet for all 6 specialist agents.
PROMPT

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Launching Claude Code in tmux session...                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Launch Claude in the tmux session with dangerously-skip-permissions
# so agents can work autonomously without per-action prompts
tmux send-keys -t "$SESSION" \
  "cd '$PROJECT' && claude --dangerously-skip-permissions --model claude-opus-4-6" \
  Enter

echo "Claude starting... waiting 8 seconds for initialization"
sleep 8

# Send the audit prompt automatically
tmux send-keys -t "$SESSION" "$(cat "$PROMPT_FILE")" Enter

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✓ Audit team launched!                                  ║"
echo "║                                                          ║"
echo "║  Attaching to tmux session...                            ║"
echo "║  (Ctrl+B then D to detach and come back later)          ║"
echo "║  (Ctrl+B then arrow keys to switch panes)               ║"
echo "║  (Ctrl+B then Z to zoom current pane)                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
sleep 2

# Attach to the session so user can interact
tmux attach -t "$SESSION"
