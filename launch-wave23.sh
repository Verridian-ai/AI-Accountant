#!/bin/bash
# ============================================================
# GoldLedger — Wave 23: Multi-Tenant & Access Control
# ============================================================
# Spawns Claude Code with Agent Teams in a tmux session.
# Run from WSL: bash launch-wave23.sh
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
TMUX_SESSION="goldledger-wave23"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  GoldLedger — Wave 23 Agent Team Launcher${NC}"
echo -e "${CYAN}  Multi-Tenant & Access Control${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# Step 1: Prerequisites
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}  tmux not found. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y tmux
fi
echo -e "${GREEN}  ✓ tmux: $(tmux -V)${NC}"

if ! command -v claude &> /dev/null; then
    echo -e "${RED}  ✗ Claude Code CLI not found!${NC}"
    echo -e "${YELLOW}  Install: npm install -g @anthropic-ai/claude-code${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Claude Code CLI available${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}  ✗ Node.js not found!${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v)${NC}"

# Step 2: Verify Docker stack
echo -e "${YELLOW}[2/5] Checking Docker services...${NC}"
if command -v docker &> /dev/null; then
    RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -c 'cba-' || true)
    echo -e "${GREEN}  ✓ $RUNNING CBA Docker containers running${NC}"
else
    echo -e "${YELLOW}  ⚠ Docker not available — agents will work but can't test live${NC}"
fi

# Step 3: Verify Wave 20 completion
echo -e "${YELLOW}[3/5] Checking Wave 20 prerequisites...${NC}"
if [ -f "$PROJECT_DIR/.agent-done-wave20" ]; then
    echo -e "${GREEN}  ✓ Wave 20 completed${NC}"
else
    echo -e "${YELLOW}  ⚠ Wave 20 marker not found — proceeding anyway${NC}"
fi

# Step 4: Kill existing session and create new
echo -e "${YELLOW}[4/5] Setting up tmux session '$TMUX_SESSION'...${NC}"
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux kill-session -t "$TMUX_SESSION"
    echo -e "${GREEN}  ✓ Old session killed${NC}"
fi

tmux new-session -d -s "$TMUX_SESSION" -x 250 -y 60
tmux send-keys -t "$TMUX_SESSION" "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" C-m
tmux send-keys -t "$TMUX_SESSION" "cd '$PROJECT_DIR'" C-m

# Tmux styling
tmux set-option -t "$TMUX_SESSION" -g status-style "bg=#1a1b26,fg=#a9b1d6"
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#f7768e,bold] Wave 23: Multi-Tenant & Access Control "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M:%S "

echo -e "${GREEN}  ✓ tmux session created${NC}"

# Step 5: Launch Claude Code
echo -e "${YELLOW}[5/5] Launching Claude Code Agent Team...${NC}"

PROMPT="Read wave23-orchestration-prompt.md and execute the full agent team plan. Read each agent's task file from wave23-agent-tasks/ for detailed atomic tasks with file paths and specs. Spawn all 10 teammates according to the sub-wave execution order. Reference docs/wave0-master-plan.md for overall context."
tmux send-keys -t "$TMUX_SESSION" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions \"$PROMPT\"" C-m

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  ✅ Wave 23 Agent Team Launched!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${BLUE}  Monitor:${NC}  tmux attach -t $TMUX_SESSION"
echo -e "${BLUE}  Detach:${NC}   Ctrl+B then D"
echo -e "${BLUE}  Kill:${NC}     tmux kill-session -t $TMUX_SESSION"
echo ""
echo -e "${YELLOW}  Attaching to tmux session...${NC}"
echo ""

tmux attach -t "$TMUX_SESSION"
