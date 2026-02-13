#!/bin/bash
# Wave 19 RESUME — agents 01,03,04 already done, resume remaining
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
TMUX_SESSION="goldledger-wave19"

echo -e "${CYAN}  Wave 19 RESUME — Market Intelligence${NC}"
echo -e "${GREEN}  ✓ Already done: agents 01, 03, 04${NC}"
echo -e "${YELLOW}  → Resuming: agents 02, 05, 06, 07, 08, 09, 10${NC}"

if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux kill-session -t "$TMUX_SESSION"
fi
tmux new-session -d -s "$TMUX_SESSION" -x 250 -y 60
tmux send-keys -t "$TMUX_SESSION" "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" C-m
tmux send-keys -t "$TMUX_SESSION" "cd '$PROJECT_DIR'" C-m

PROMPT="You are RESUMING Wave 19 (Market Intelligence). Some agents already completed before an API limit hit. DO NOT redo completed work. Check for .agent-done-W19-XX marker files. Already completed: agents 01 (W19-01), 03 (W19-03), 04 (W19-04). You must complete the REMAINING agents: 02, 05, 06, 07, 08, 09, 10. Read wave19-orchestration-prompt.md for full context. Read each remaining agent task file from wave19-agent-tasks/ (02-*.md, 05-*.md through 10-*.md). Spawn sub-agents for the remaining tasks in parallel where possible. Create .agent-done-W19-XX markers for each completed agent."
tmux send-keys -t "$TMUX_SESSION" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions \"$PROMPT\"" C-m

echo -e "${GREEN}  ✅ Wave 19 Resume Launched!${NC}"
echo ""

