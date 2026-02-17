#!/bin/bash
# ============================================================
# Manual Step-by-Step Setup (for troubleshooting)
# Run each step individually if the auto-launcher has issues
# ============================================================

PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
WORKTREE_BASE="/mnt/c/Users/Danie/Desktop/goldledger-worktrees"

echo "=== Step 1: Source nvm ==="
echo "Run: export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\""
echo ""

echo "=== Step 2: Install tmux ==="
echo "Run: sudo apt-get update && sudo apt-get install -y tmux"
echo ""

echo "=== Step 3: Install Claude Code ==="
echo "Run: npm install -g @anthropic-ai/claude-code"
echo ""

echo "=== Step 4: Set environment variables ==="
echo "Run: export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1"
echo "Run: export CLAUDE_CODE_SPAWN_BACKEND=tmux"
echo ""

echo "=== Step 5: Create worktrees (if needed) ==="
echo "Run: cd '$PROJECT_DIR'"
echo "Run: git worktree prune"
echo "Run: git worktree add --detach '$WORKTREE_BASE/agent-1' master"
echo "Run: git worktree add --detach '$WORKTREE_BASE/agent-2' master"
echo "Run: git worktree add --detach '$WORKTREE_BASE/agent-3' master"
echo ""

echo "=== Step 6: Create tmux session ==="
echo "Run: tmux new-session -s goldledger-refactor"
echo ""

echo "=== Step 7: Navigate to project ==="
echo "Run: cd '$PROJECT_DIR'"
echo ""

echo "=== Step 8: Launch Claude Code ==="
echo "Run: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions"
echo ""

echo "=== Step 9: Paste the orchestration prompt ==="
echo "The prompt is in: agent-team/refactoring-orchestration-prompt.md"
echo "Copy and paste it into Claude Code to start the agent team."
echo ""

echo "=== Alternative: One-liner (inside WSL) ==="
echo "  export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && \\"
echo "  export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 CLAUDE_CODE_SPAWN_BACKEND=tmux && \\"
echo "  cd '$PROJECT_DIR' && tmux new-session -s goldledger-refactor"
echo ""
echo "Then type: claude --dangerously-skip-permissions"
echo "Then paste the contents of agent-team/refactoring-orchestration-prompt.md"

