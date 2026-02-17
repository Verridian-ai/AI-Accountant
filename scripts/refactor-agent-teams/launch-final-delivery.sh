#!/usr/bin/env bash
#
# Launch FINAL DELIVERY Agent Team
# Phase A: Build Fix (4 Opus 4.6 agents)
# Phase B: Neon Cloud + v4 Masking (3 agents) — launched separately after Phase A
# Phase C: Integration Verification (1 agent) — launched separately after Phase B
#
# Uses tmux send-keys to auto-paste prompt after Claude starts
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

cd "$PROJECT_ROOT"

# Determine which phase to launch
PHASE="${1:-a}"

case "$PHASE" in
  a|A|phase-a)
    PHASE_NAME="Phase A: Build Fix (4 Opus 4.6)"
    PROMPT_FILE="$SCRIPT_DIR/prompts/phase-a-build-fix.txt"
    SESSION_PREFIX="final-a"
    AGENT_COUNT=4
    ;;
  b|B|phase-b)
    PHASE_NAME="Phase B: Neon Cloud + v4 Masking (3 Agents)"
    PROMPT_FILE="$SCRIPT_DIR/prompts/phase-b-neon-v4.txt"
    SESSION_PREFIX="final-b"
    AGENT_COUNT=3
    ;;
  c|C|phase-c)
    PHASE_NAME="Phase C: Integration Verification (1 Agent)"
    PROMPT_FILE="$SCRIPT_DIR/prompts/phase-c-verify.txt"
    SESSION_PREFIX="final-c"
    AGENT_COUNT=1
    ;;
  final|f|F|phase-final)
    PHASE_NAME="Phase FINAL: Zero-Any + Commit + Verify (3 Agents)"
    PROMPT_FILE="$SCRIPT_DIR/prompts/phase-final-cleanup.txt"
    SESSION_PREFIX="final-cleanup"
    AGENT_COUNT=3
    ;;
  *)
    echo "Usage: $0 [a|b|c|final]"
    echo "  a      Launch Phase A: Build Fix (default)"
    echo "  b      Launch Phase B: Neon Cloud + v4 Masking"
    echo "  c      Launch Phase C: Integration Verification"
    echo "  final  Launch Phase FINAL: Zero-Any + Commit + Verify"
    exit 1
    ;;
esac

echo ""
echo "============================================================"
echo "  GOLDLEDGER FINAL DELIVERY"
echo "  $PHASE_NAME"
echo "============================================================"
echo "  Project: $PROJECT_ROOT"
echo "  Prompt:  $PROMPT_FILE"
echo "============================================================"
echo ""

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  exit 1
fi

SESSION_NAME="${SESSION_PREFIX}-$(date +%s)"

# Start tmux session with Claude in background
echo "Starting Claude in tmux session: $SESSION_NAME"
tmux new-session -d -s "$SESSION_NAME" \
  "cd '$PROJECT_ROOT' && export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude --dangerously-skip-permissions --model claude-opus-4-6 --teammate-mode tmux"

echo "Waiting for Claude to initialize..."
sleep 8

# Load the prompt and paste it, then send Enter
echo "Injecting prompt..."
tmux load-buffer "$PROMPT_FILE"
tmux paste-buffer -t "$SESSION_NAME"
sleep 1
tmux send-keys -t "$SESSION_NAME" Enter

echo ""
echo "Session: $SESSION_NAME"
echo "Prompt sent. Attaching to tmux..."
echo ""
echo "  Agents: $AGENT_COUNT"
echo "  Ctrl+B D to detach without stopping agents"
echo "  tmux attach -t $SESSION_NAME to reattach"
echo ""
sleep 1

# Attach so user can see it
exec tmux attach -t "$SESSION_NAME"
