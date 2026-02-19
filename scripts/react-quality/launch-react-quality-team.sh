#!/bin/bash
# =============================================================================
# React Quality Agent Team — WSL tmux launcher
# Usage: bash scripts/react-quality/launch-react-quality-team.sh
#
# Requires: tmux, claude CLI available in PATH
# =============================================================================

export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"

SESSION="react-quality"
PROJECT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
PROMPT_FILE="$PROJECT/scripts/react-quality/orchestration-prompt.txt"

# Kill any stale session
tmux kill-session -t "$SESSION" 2>/dev/null \
  && echo "Killed old '$SESSION' session" \
  || echo "No old session to kill"

# Verify tmux is available
if ! command -v tmux &>/dev/null; then
  echo "ERROR: tmux not found. Install with: sudo apt-get install tmux"
  exit 1
fi

# Verify claude is available
if ! command -v claude &>/dev/null; then
  echo "ERROR: claude CLI not found. Make sure it is in your PATH."
  exit 1
fi

# Verify orchestration prompt exists
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  exit 1
fi

# Verify project directory
if [[ ! -d "$PROJECT" ]]; then
  echo "ERROR: Project directory not found: $PROJECT"
  exit 1
fi

echo ""
echo "==========================================="
echo "  React Quality Agent Team"
echo "  Session: $SESSION"
echo "  Project: $PROJECT"
echo "  Score baseline: 81/100 (712 warnings)"
echo "  Target: 95+/100"
echo "==========================================="
echo ""

# Create tmux session (wide enough for split panes)
tmux new-session -d -s "$SESSION" -c "$PROJECT" -x 240 -y 60

# Style the status bar
tmux set-option -t "$SESSION" status-style "bg=colour236,fg=colour246"
tmux set-option -t "$SESSION" status-left "#[fg=colour214,bold] REACT-QUALITY #[fg=colour246]| "
tmux set-option -t "$SESSION" status-right "#[fg=colour246]%H:%M | #[fg=colour214]6 WORKERS"
tmux set-option -t "$SESSION" pane-active-border-style "fg=colour214"
tmux set-option -t "$SESSION" pane-border-style "fg=colour236"
tmux set-option -t "$SESSION" mouse on

# Enable agent teams split-pane mode via env (auto-detects tmux)
tmux set-environment -t "$SESSION" CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS "1"

echo "Session '$SESSION' created."

# Start Claude with skip-permissions (project already has this configured)
echo "Starting Claude..."
tmux send-keys -t "$SESSION" \
  "cd '$PROJECT' && claude --dangerously-skip-permissions" \
  Enter

# Wait for Claude to initialize
echo "Waiting 12s for Claude to initialize..."
sleep 12

# Read and send the orchestration prompt
PROMPT=$(cat "$PROMPT_FILE")
echo "Sending orchestration prompt..."
tmux send-keys -t "$SESSION" "$PROMPT" Enter

echo ""
echo "=== REACT QUALITY TEAM LAUNCHED ==="
echo ""
echo "Controls:"
echo "  Shift+Down    — cycle through teammates"
echo "  Ctrl+B D      — detach (team keeps running)"
echo "  Ctrl+T        — toggle task list"
echo "  Ctrl+B [      — scroll mode (q to exit)"
echo ""
echo "To reattach later:"
echo "  tmux attach -t $SESSION"
echo ""
echo "Attaching now..."
sleep 2

tmux attach -t "$SESSION"
