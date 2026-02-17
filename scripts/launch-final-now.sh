#!/bin/bash
set -e

PROJECT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
PROMPT_FILE="$PROJECT/scripts/refactor-agent-teams/prompts/phase-final-cleanup.txt"
SESSION="goldledger-final"

cd "$PROJECT"

# Kill old session if exists
tmux kill-session -t "$SESSION" 2>/dev/null || true

echo ""
echo "============================================================"
echo "  GOLDLEDGER PHASE FINAL: Zero-Any + Commit + Verify"
echo "  3 Agents: any-killer-client, docker-verifier, git-committer"
echo "============================================================"
echo ""

# Start Claude in a new tmux session
echo "Starting Claude in tmux session: $SESSION"
tmux new-session -d -s "$SESSION" \
  "cd '$PROJECT' && export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 && claude --dangerously-skip-permissions --model claude-opus-4-6 --teammate-mode tmux"

echo "Waiting 10s for Claude to initialize..."
sleep 10

# Check if session is alive
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "ERROR: tmux session died. Trying without teammate-mode..."
  tmux new-session -d -s "$SESSION" \
    "cd '$PROJECT' && claude --dangerously-skip-permissions --model claude-opus-4-6"
  sleep 8
fi

# Inject the prompt
echo "Injecting prompt from: $PROMPT_FILE"
tmux load-buffer "$PROMPT_FILE"
tmux paste-buffer -t "$SESSION"
sleep 1
tmux send-keys -t "$SESSION" Enter

echo ""
echo "Prompt injected! Attaching..."
echo "  Ctrl+B D to detach"
echo "  tmux attach -t $SESSION to reattach"
echo ""
sleep 1

exec tmux attach -t "$SESSION"
