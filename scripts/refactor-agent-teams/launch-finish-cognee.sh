#!/usr/bin/env bash
#
# Finish Cognee team work — solo agent, no team needed
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompts/phase1c-finish-cognee.txt"

export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

cd "$PROJECT_ROOT"

"$SCRIPT_DIR/ensure-tmux.sh"

echo ""
echo "=============================================="
echo "  Finishing Cognee Plan — Solo Agent"
echo "  Updating PHASE2 + Verifying Completeness"
echo "  Project: $PROJECT_ROOT"
echo "=============================================="
echo ""

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  exit 1
fi

echo "Launching Claude Code (--dangerously-skip-permissions)..."
echo ""

if [ -z "$TMUX" ] && [ -t 0 ]; then
  SESSION_NAME="cognee-finish-$(date +%s)"
  echo "Starting tmux session: $SESSION_NAME"
  echo "(Ctrl+B D to detach, tmux attach -t $SESSION_NAME to reattach)"
  echo ""
  sleep 1
  exec tmux new-session -s "$SESSION_NAME" \
    "cd '$PROJECT_ROOT' && export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude --dangerously-skip-permissions"
else
  exec claude --dangerously-skip-permissions
fi
