#!/usr/bin/env bash
#
# Launch Phase 3: Error Resolution Agent Team
# 4x Opus 4.6 agents to resolve ALL 119 TS errors + eliminate 560 any-types
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompts/phase3-error-resolution.txt"

export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

cd "$PROJECT_ROOT"

echo ""
echo "============================================================"
echo "  PHASE 3: ERROR RESOLUTION — 4x Opus 4.6 Agents"
echo "============================================================"
echo "  Project: $PROJECT_ROOT"
echo ""
echo "  Targets (from TS_ERROR_REPORT.md):"
echo "    119 TS errors → 0"
echo "    560 :any types → <50"
echo "    299 as-any casts → <30"
echo ""
echo "  Agents:"
echo "    1. module-fixer    — 49 missing module errors"
echo "    2. session-fixer   — 65 errors (sessionId + index.ts)"
echo "    3. any-killer-heavy — Top 18 files (~323 any)"
echo "    4. any-killer-sweep — Remaining 62 files + final verify"
echo ""
echo "============================================================"
echo ""

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/docs/TS_ERROR_REPORT.md" ]; then
  echo "ERROR: TS_ERROR_REPORT.md not found in docs/"
  exit 1
fi

echo "Launching Claude Code lead agent (Opus 4.6)..."
echo ""

CLAUDE_FLAGS="--dangerously-skip-permissions --model claude-opus-4-6 --teammate-mode tmux"

if [ -z "$TMUX" ] && [ -t 0 ]; then
  SESSION_NAME="phase3-errors-$(date +%s)"
  echo "Starting tmux session: $SESSION_NAME"
  echo "(Ctrl+B D to detach, tmux attach -t $SESSION_NAME to reattach)"
  echo ""
  sleep 1
  exec tmux new-session -s "$SESSION_NAME" \
    "cd '$PROJECT_ROOT' && export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude $CLAUDE_FLAGS"
elif [ -n "$TMUX" ]; then
  exec claude $CLAUDE_FLAGS
else
  echo "No TTY detected - falling back to in-process mode"
  exec claude --dangerously-skip-permissions --model claude-opus-4-6 --teammate-mode in-process
fi
