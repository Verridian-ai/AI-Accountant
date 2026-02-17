#!/bin/bash
# ============================================================
# GoldLedger Refactoring - Multi-Agent Team Launcher
# Agent Team Infrastructure for 60-task refactoring project
# ============================================================
# This script sets up and launches the Claude Code Agent Team
# in a tmux session via WSL with git worktrees for parallel work.
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
WORKTREE_BASE="/mnt/c/Users/Danie/Desktop/goldledger-worktrees"
TMUX_SESSION="goldledger-refactor"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/agent-team/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  GoldLedger Refactoring - Multi-Agent Team Launcher${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"

# Source nvm (required for node/claude in WSL)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Check tmux
if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}  tmux not found. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y tmux
fi
echo -e "${GREEN}  ✓ tmux available: $(tmux -V)${NC}"

# Check Claude Code
if ! command -v claude &> /dev/null; then
    echo -e "${RED}  ✗ Claude Code CLI not found!${NC}"
    echo -e "${YELLOW}  Install with: npm install -g @anthropic-ai/claude-code${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Claude Code CLI available${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ✗ Node.js not found!${NC}"
    echo -e "${YELLOW}  Install with: nvm install --lts${NC}"
    exit 1
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
    echo -e "${RED}  ✗ Node.js v$NODE_VER too old, need 20+${NC}"
    echo -e "${YELLOW}  Run: nvm install --lts${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v)${NC}"

# Check project directory
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo -e "${RED}  ✗ Project not found at $PROJECT_DIR${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Project directory${NC}"

# Check key files
if [ ! -f "$PROJECT_DIR/agent-team/task-tracker.md" ]; then
    echo -e "${RED}  ✗ task-tracker.md not found${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Task tracker found${NC}"

# Step 2: Set up environment
echo -e "${YELLOW}[2/7] Setting up environment...${NC}"

# Enable experimental agent teams
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
export CLAUDE_CODE_SPAWN_BACKEND=tmux
echo -e "${GREEN}  ✓ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1${NC}"
echo -e "${GREEN}  ✓ CLAUDE_CODE_SPAWN_BACKEND=tmux${NC}"

# Persist to .bashrc if not already there
if ! grep -q "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS" "$HOME/.bashrc" 2>/dev/null; then
    printf '\n# Claude Code Agent Teams\nexport CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1\nexport CLAUDE_CODE_SPAWN_BACKEND=tmux\n' >> "$HOME/.bashrc"
    echo -e "${GREEN}  ✓ Added to .bashrc${NC}"
fi

# Create log directory
mkdir -p "$LOG_DIR"
echo -e "${GREEN}  ✓ Log directory ready${NC}"

# Copy CLAUDE.md to project root if available
[ -f "$SCRIPT_DIR/CLAUDE.md" ] && cp "$SCRIPT_DIR/CLAUDE.md" "$PROJECT_DIR/CLAUDE.md"

# Step 3: Set up worktrees
echo -e "${YELLOW}[3/7] Setting up git worktrees...${NC}"
cd "$PROJECT_DIR"
git worktree prune 2>/dev/null

for i in 1 2 3; do
    WT="$WORKTREE_BASE/agent-$i"
    if [ ! -d "$WT/.git" ] && [ ! -f "$WT/.git" ]; then
        mkdir -p "$WORKTREE_BASE"
        git worktree remove "$WT" --force 2>/dev/null || true
        rm -rf "$WT" 2>/dev/null || true
        if git worktree add --detach "$WT" master 2>/dev/null; then
            echo -e "${GREEN}  ✓ Created worktree agent-$i${NC}"
        else
            echo -e "${RED}  ✗ Failed to create agent-$i worktree${NC}"
        fi
    else
        echo -e "${GREEN}  ✓ Worktree agent-$i exists${NC}"
    fi
done

# Step 4: Kill any existing session
echo -e "${YELLOW}[4/7] Cleaning up existing sessions...${NC}"
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    echo -e "${YELLOW}  Found existing session '$TMUX_SESSION'. Killing it...${NC}"
    tmux kill-session -t "$TMUX_SESSION"
    echo -e "${GREEN}  ✓ Old session killed${NC}"
else
    echo -e "${GREEN}  ✓ No existing session found${NC}"
fi
tmux kill-session -t claude-swarm 2>/dev/null || true

# Step 5: Create tmux session
echo -e "${YELLOW}[5/7] Creating tmux session '$TMUX_SESSION'...${NC}"
tmux new-session -d -s "$TMUX_SESSION" -x 250 -y 60
echo -e "${GREEN}  ✓ tmux session created${NC}"

# Set environment in the session
tmux send-keys -t "$TMUX_SESSION" "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 CLAUDE_CODE_SPAWN_BACKEND=tmux" C-m
tmux send-keys -t "$TMUX_SESSION" 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' C-m
tmux send-keys -t "$TMUX_SESSION" "cd '$PROJECT_DIR'" C-m

# Configure tmux appearance (Tokyo Night theme)
tmux set-option -t "$TMUX_SESSION" -g status-style "bg=#1a1b26,fg=#a9b1d6"
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#7aa2f7,bold] 🔧 GoldLedger Refactor Team "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M:%S "
tmux set-option -t "$TMUX_SESSION" -g pane-border-style "fg=#3b4261"
tmux set-option -t "$TMUX_SESSION" -g pane-active-border-style "fg=#7aa2f7"

echo -e "${GREEN}  ✓ tmux layout configured${NC}"

# Step 6: Write the orchestration prompt
echo -e "${YELLOW}[6/7] Preparing orchestration prompt...${NC}"

# Use existing orchestration prompt if available, otherwise use the QA-A prompt
if [ -f "$PROJECT_DIR/agent-team/refactoring-orchestration-prompt.md" ]; then
    PROMPT_FILE="$PROJECT_DIR/agent-team/refactoring-orchestration-prompt.md"
    echo -e "${GREEN}  ✓ Using refactoring-orchestration-prompt.md${NC}"
else
    echo -e "${YELLOW}  ⚠ No orchestration prompt found — you'll need to paste one manually${NC}"
    PROMPT_FILE=""
fi

# Step 7: Launch Claude Code in the tmux session
echo -e "${YELLOW}[7/7] Launching Claude Code Agent Team...${NC}"
echo ""

# Send the Claude Code launch command to the tmux session
tmux send-keys -t "$TMUX_SESSION" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions" C-m

# Wait a moment for Claude to initialize
sleep 3

# Send the first few lines of the orchestration prompt to kick things off
if [ -n "$PROMPT_FILE" ] && [ -f "$PROMPT_FILE" ]; then
    tmux send-keys -t "$TMUX_SESSION" "$(head -5 "$PROMPT_FILE")" C-m
    echo -e "${GREEN}  ✓ Orchestration prompt sent (first 5 lines)${NC}"
    echo -e "${YELLOW}  📋 Full prompt at: agent-team/refactoring-orchestration-prompt.md${NC}"
fi

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  ✅ Agent Team Infrastructure Ready!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${BLUE}  To monitor the agent team:${NC}"
echo -e "${CYAN}    tmux attach -t $TMUX_SESSION${NC}"
echo ""
echo -e "${BLUE}  To detach from tmux (keep running):${NC}"
echo -e "${CYAN}    Press Ctrl+B then D${NC}"
echo ""
echo -e "${BLUE}  To list all tmux sessions:${NC}"
echo -e "${CYAN}    tmux list-sessions${NC}"
echo ""
echo -e "${BLUE}  To kill the session:${NC}"
echo -e "${CYAN}    tmux kill-session -t $TMUX_SESSION${NC}"
echo ""
echo -e "${BLUE}  Agent Team Controls (inside Claude Code):${NC}"
echo -e "${CYAN}    Shift+Up/Down  - Navigate between teammates${NC}"
echo -e "${CYAN}    Enter          - View teammate session${NC}"
echo -e "${CYAN}    Escape         - Interrupt teammate${NC}"
echo -e "${CYAN}    Ctrl+T         - Toggle task list${NC}"
echo ""
echo -e "${BLUE}  Git Worktrees:${NC}"
echo -e "${CYAN}    Agent 1: $WORKTREE_BASE/agent-1${NC}"
echo -e "${CYAN}    Agent 2: $WORKTREE_BASE/agent-2${NC}"
echo -e "${CYAN}    Agent 3: $WORKTREE_BASE/agent-3${NC}"
echo ""
echo -e "${PURPLE}  Attaching to tmux session now...${NC}"
echo ""

# Attach to the tmux session
tmux attach -t "$TMUX_SESSION"

