#!/usr/bin/env bash
#
# Launch Phase 2 EXECUTION Agent Team
# Cost-optimized: Haiku (bulk) + Sonnet (heavy lifting) + Opus 4.6 (quality gate)
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompts/phase2-execution.txt"

export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

cd "$PROJECT_ROOT"

echo ""
echo "============================================================"
echo "  PHASE 2: EXECUTION AGENT TEAM"
echo "  Cost-Optimized: Haiku + Sonnet + Opus 4.6 Quality Gate"
echo "============================================================"
echo "  Project: $PROJECT_ROOT"
echo ""
echo "  Model Strategy:"
echo "    Haiku  (cheap)  -> Zod schemas, tests, cleanup"
echo "    Sonnet (mid)    -> Type safety, security, Cognee, schema"
echo "    Opus 4.6 (gate) -> Review only, no code writing"
echo ""
echo "============================================================"
echo ""

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  exit 1
fi

# Verify required docs exist
REQUIRED_DOCS=(
  "docs/PHASE2_AGENT_TEAM_DEFINITION.md"
  "docs/REFACTORING_PLAN_REFINED.md"
  "docs/COGNEE_INTEGRATION_PLAN.md"
  "docs/DOCKER_ROLLBACK_PLAN.md"
)

echo "Checking required documents..."
for doc in "${REQUIRED_DOCS[@]}"; do
  if [ -f "$PROJECT_ROOT/$doc" ]; then
    echo "  [OK] $doc"
  else
    echo "  [MISSING] $doc"
    echo "  ERROR: Required document missing. Run Phase 1 first."
    exit 1
  fi
done
echo ""

echo "Launching Claude Code lead agent (--dangerously-skip-permissions)..."
echo "The lead will spawn teammates with these models:"
echo "  - Haiku agents:  --model haiku"
echo "  - Sonnet agents: --model sonnet"
echo "  - Opus agent:    --model claude-opus-4-6"
echo ""

CLAUDE_FLAGS="--dangerously-skip-permissions --teammate-mode tmux"

if [ -z "$TMUX" ] && [ -t 0 ]; then
  SESSION_NAME="phase2-exec-$(date +%s)"
  echo "Starting tmux session: $SESSION_NAME"
  echo "(Ctrl+B D to detach, tmux attach -t $SESSION_NAME to reattach)"
  echo ""
  sleep 1

  # Load the prompt into tmux buffer for pasting after session starts
  PROMPT_CONTENT=$(cat "$PROMPT_FILE")

  exec tmux new-session -s "$SESSION_NAME" \
    "cd '$PROJECT_ROOT' && export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude $CLAUDE_FLAGS"

elif [ -n "$TMUX" ]; then
  exec claude $CLAUDE_FLAGS
else
  echo "No TTY detected - falling back to in-process mode"
  exec claude --dangerously-skip-permissions --teammate-mode in-process
fi
