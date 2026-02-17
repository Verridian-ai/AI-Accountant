#!/bin/bash
# ============================================================
# Manual Step-by-Step Setup (for troubleshooting)
# Run each step individually if the auto-launcher has issues
# ============================================================

PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse/cba-statements"

echo "=== Step 1: Install tmux ==="
echo "Run: sudo apt-get update && sudo apt-get install -y tmux"
echo ""

echo "=== Step 2: Install Claude Code ==="
echo "Run: npm install -g @anthropic-ai/claude-code"
echo ""

echo "=== Step 3: Set environment variable ==="
echo "Run: export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1"
echo ""

echo "=== Step 4: Create tmux session ==="
echo "Run: tmux new-session -s cba-agent-team"
echo ""

echo "=== Step 5: Navigate to project ==="
echo "Run: cd '$PROJECT_DIR'"
echo ""

echo "=== Step 6: Launch Claude Code ==="
echo "Run: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions"
echo ""

echo "=== Step 7: Paste the orchestration prompt ==="
echo "The prompt is in: agent-team/orchestration-prompt.md"
echo "Copy and paste it into Claude Code to start the agent team."
echo ""

echo "=== Alternative: Direct tmux launch ==="
echo "If you prefer to run Claude Code directly in tmux:"
echo ""
echo "  tmux new-session -s cba-agent-team"
echo "  export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1"  
echo "  cd '$PROJECT_DIR'"
echo "  claude --dangerously-skip-permissions"
echo ""
echo "Then paste the contents of agent-team/orchestration-prompt.md"
