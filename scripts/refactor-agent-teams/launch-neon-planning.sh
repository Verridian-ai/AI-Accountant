#!/usr/bin/env bash
#
# Launch Neon + Cognee + Data Masking Planning Team
# 3x Opus 4.6 agents to architect the integration
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
echo "  3x Opus 4.6 Agents"
echo "============================================================"
echo "  Project: $PROJECT_ROOT"
echo ""
echo "  Agents:"
echo "    1. neon-architect        — Neon DB integration design"
echo "    2. masking-architect     — PII protection + redaction"
echo "    3. cognee-neon-integrator — Bridge plan for all systems"
echo ""
echo "  Deliverables:"
echo "    docs/NEON_INTEGRATION_PLAN.md"
echo "    docs/DATA_MASKING_PLAN.md"
echo "    docs/COGNEE_NEON_BRIDGE_PLAN.md"
echo ""
echo "============================================================"
echo ""

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  exit 1
fi

CLAUDE_FLAGS="--dangerously-skip-permissions --model claude-opus-4-6 --teammate-mode tmux"

if [ -z "$TMUX" ] && [ -t 0 ]; then
  SESSION_NAME="neon-planning-$(date +%s)"
  echo "Starting tmux session: $SESSION_NAME"
  echo "(Ctrl+B D to detach, tmux attach -t $SESSION_NAME to reattach)"
  echo ""
  sleep 1
  exec tmux new-session -s "$SESSION_NAME" \
    "cd '$PROJECT_ROOT' && export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude $CLAUDE_FLAGS"
elif [ -n "$TMUX" ]; then
  exec claude $CLAUDE_FLAGS
else
  echo "No TTY - falling back to in-process mode"
  exec claude --dangerously-skip-permissions --model claude-opus-4-6 --teammate-mode in-process
fi
