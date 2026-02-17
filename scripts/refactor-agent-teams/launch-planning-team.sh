#!/usr/bin/env bash
#
# Launch Phase 1: GoldLedger Refactoring PLANNING Agent Team
# All permissions skipped. Fully autonomous.
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompts/phase1-planning.txt"

export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

cd "$PROJECT_ROOT"

"$SCRIPT_DIR/ensure-tmux.sh"

echo ""
echo "=============================================="
echo "  Phase 1: PLANNING & DEBATE Agent Team"
echo "  FULLY AUTONOMOUS - NO APPROVAL REQUIRED"
echo "  Project: $PROJECT_ROOT"
echo "=============================================="
echo ""

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  exit 1
fi

echo "Launching Claude Code (--dangerously-skip-permissions)..."
echo ""

# Common claude flags
CLAUDE_FLAGS="--dangerously-skip-permissions --teammate-mode tmux"

if [ -z "$TMUX" ] && [ -t 0 ]; then
  SESSION_NAME="goldledger-planning-$(date +%s)"
  echo "Starting tmux session: $SESSION_NAME"
  echo "(Ctrl+B D to detach, tmux attach -t $SESSION_NAME to reattach)"
  echo ""
  sleep 1
  # Start tmux, inside it run claude interactively (not -p mode so teammates work)
  exec tmux new-session -s "$SESSION_NAME" \
    "cd '$PROJECT_ROOT' && export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude $CLAUDE_FLAGS"
elif [ -n "$TMUX" ]; then
  exec claude $CLAUDE_FLAGS
else
  echo "No TTY - falling back to in-process mode"
  exec claude --dangerously-skip-permissions --teammate-mode in-process
fi
