#!/usr/bin/env bash
# =============================================================================
# GoldLedger QA Agent Team Launcher
# Runs in WSL2 — creates an external tmux session with Claude Code
# Usage: bash scripts/launch-qa-team.sh
# Attach later: wsl -e bash -c "tmux attach -t goldledger-qa"
# =============================================================================

set -e

PROJECT_ROOT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
SESSION="goldledger-qa"
PROMPT_FILE="$PROJECT_ROOT/scripts/QA_TEAM_PROMPT.txt"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GoldLedger QA Agent Team — 10 Agents (5 Audit + 5 Fix)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verify tmux is available
if ! command -v tmux &>/dev/null; then
  echo "❌ tmux not found. Install with: sudo apt-get install tmux"
  exit 1
fi

# Verify claude is available
if ! command -v claude &>/dev/null; then
  echo "❌ claude not found in PATH. Ensure Claude Code is installed."
  exit 1
fi

# Kill existing session if it exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "♻️  Killing existing session '$SESSION'..."
  tmux kill-session -t "$SESSION"
fi

# Create new session (wide terminal for split panes)
echo "🔧 Creating tmux session '$SESSION'..."
tmux new-session -d -s "$SESSION" -c "$PROJECT_ROOT" -x 240 -y 60

echo "✅ Session created."
echo ""

# Display the prompt so user can copy it
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MISSION PROMPT (copy from: scripts/QA_TEAM_PROMPT.txt)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start Claude in the session
tmux send-keys -t "$SESSION" "cd '$PROJECT_ROOT' && claude --dangerously-skip-permissions" Enter

echo ""
echo "Claude is starting in tmux session '$SESSION'."
echo ""
echo "📋 When Claude is ready, paste the mission prompt from:"
echo "   $PROMPT_FILE"
echo ""
echo "🖥  Controls:"
echo "   Shift+Down    — cycle through teammates"
echo "   Ctrl+B D      — detach (keeps team running)"
echo "   Ctrl+T        — toggle task list"
echo ""
echo "Re-attach anytime:"
echo "   wsl -e bash -c \"tmux attach -t $SESSION\""
echo ""
echo "Attaching now..."
echo ""
sleep 1

# Attach to the session (user will see Claude starting)
tmux attach-session -t "$SESSION"
