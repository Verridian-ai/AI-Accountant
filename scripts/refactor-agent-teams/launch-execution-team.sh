#!/usr/bin/env bash
#
# Launch Phase 2: GoldLedger Refactoring EXECUTION Agent Team
# Run AFTER Phase 1 planning is complete and improved plan exists.
# Run from WSL2: wsl -e bash -c "./scripts/refactor-agent-teams/launch-execution-team.sh"
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompts/phase2-execution.txt"

# Enable agent teams
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
export CLAUDE_CODE_TEAMMATE_MODE=tmux 2>/dev/null || true

cd "$PROJECT_ROOT"

# Ensure tmux is installed
"$SCRIPT_DIR/ensure-tmux.sh"

# Check for refined plan from Phase 1
REFINED_PLAN="${REFINED_PLAN:-$PROJECT_ROOT/docs/REFACTORING_PLAN_REFINED.md}"
if [ ! -f "$REFINED_PLAN" ]; then
  echo "NOTE: Refined plan not found at $REFINED_PLAN"
  echo "      Phase 2 will use the original docs/REFACTORING_PLAN.md"
  echo "      Run Phase 1 first to generate an improved plan."
  echo ""
fi

echo "=============================================="
echo "  Phase 2: EXECUTION Agent Team"
echo "  Project: $PROJECT_ROOT"
echo "=============================================="
echo ""
echo "Copy the prompt from: $PROMPT_FILE"
echo ""
echo "Once Claude starts:"
echo "  1. Paste the Phase 2 execution prompt"
echo "  2. Claude will create a team with implementation teammates"
echo "  3. Use Shift+Tab for delegate mode"
echo "  4. Require plan approval for each task before implementation"
echo ""

if [ -f "$PROMPT_FILE" ]; then
  echo "--- PROMPT (copy below) ---"
  cat "$PROMPT_FILE"
  echo ""
  echo "--- END PROMPT ---"
fi

if [ -z "$TMUX" ] && [ -t 0 ]; then
  SESSION_NAME="goldledger-execution-$(date +%s)"
  echo "Starting tmux session: $SESSION_NAME"
  exec tmux new-session -s "$SESSION_NAME" "cd '$PROJECT_ROOT' && export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude --teammate-mode tmux"
else
  echo "No TTY detected - using in-process mode (Shift+Up/Down to switch teammates)"
  exec claude --teammate-mode in-process
fi
