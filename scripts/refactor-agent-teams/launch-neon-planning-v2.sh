#!/usr/bin/env bash
#
# Launch Neon + Cognee + Data Masking Planning Team (v2)
# Uses tmux send-keys to auto-paste prompt after Claude starts
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompts/neon-cognee-planning.txt"

export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

cd "$PROJECT_ROOT"

echo ""
echo "============================================================"
echo "  NEON + COGNEE + DATA MASKING PLANNING TEAM"
echo "  3x Opus 4.6 — Auto-prompt injection"
echo "============================================================"
echo ""

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  exit 1
fi

SESSION_NAME="neon-plan-$(date +%s)"

# Start tmux session with Claude in background
tmux new-session -d -s "$SESSION_NAME" \
  "cd '$PROJECT_ROOT' && export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude --dangerously-skip-permissions --model claude-opus-4-6 --teammate-mode tmux"

echo "Waiting for Claude to initialize..."
sleep 8

# Load the prompt and paste it, then send Enter
tmux load-buffer "$PROMPT_FILE"
tmux paste-buffer -t "$SESSION_NAME"
sleep 1
tmux send-keys -t "$SESSION_NAME" Enter

echo ""
echo "Session: $SESSION_NAME"
echo "Prompt sent. Attaching to tmux..."
echo "(Ctrl+B D to detach)"
echo ""
sleep 1

# Attach so user can see it
exec tmux attach -t "$SESSION_NAME"
