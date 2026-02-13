#!/bin/bash
# ============================================================
# GoldLedger — Multi-Agent Team Launcher
# Tax Optimization, Loan Calculators, Financial Intelligence
# ============================================================
# Spawns Claude Code with Agent Teams enabled in a tmux session.
# Run from WSL: bash launch-goldledger-team.sh
# ============================================================

# Don't exit on non-critical errors (cp same-file, etc.)
# set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration — adjust PROJECT_DIR to your repo location
PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
TMUX_SESSION="goldledger-team"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  GoldLedger — Agent Team Launcher${NC}"
echo -e "${CYAN}  Tax Optimization + Loan Calculators + Smart Budgeting${NC}"
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

# Step 2: Verify Docker stack is running
echo -e "${YELLOW}[2/5] Checking Docker services...${NC}"
if command -v docker &> /dev/null; then
    RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -c 'cba-' || true)
    echo -e "${GREEN}  ✓ $RUNNING CBA Docker containers running${NC}"
else
    echo -e "${YELLOW}  ⚠ Docker not available — agents will work but can't test live${NC}"
fi

# Step 3: Kill existing session
echo -e "${YELLOW}[3/5] Cleaning up existing sessions...${NC}"
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux kill-session -t "$TMUX_SESSION"
    echo -e "${GREEN}  ✓ Old session killed${NC}"
else
    echo -e "${GREEN}  ✓ No existing session${NC}"
fi

# Step 4: Create tmux session
echo -e "${YELLOW}[4/5] Creating tmux session '$TMUX_SESSION'...${NC}"
tmux new-session -d -s "$TMUX_SESSION" -x 250 -y 60

# Set environment
tmux send-keys -t "$TMUX_SESSION" "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" C-m
tmux send-keys -t "$TMUX_SESSION" "cd '$PROJECT_DIR'" C-m

# Tmux styling
tmux set-option -t "$TMUX_SESSION" -g status-style "bg=#1a1b26,fg=#a9b1d6"
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#f7768e,bold] GoldLedger Team "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M:%S "

echo -e "${GREEN}  ✓ tmux session created${NC}"

# Step 5: Launch Claude Code with orchestration prompt
echo -e "${YELLOW}[5/5] Launching Claude Code Agent Team...${NC}"

# Copy orchestration prompt to project if launched from a different directory
if [ -f "$SCRIPT_DIR/orchestration-prompt.md" ] && [ "$SCRIPT_DIR" != "$PROJECT_DIR" ]; then
    cp "$SCRIPT_DIR/orchestration-prompt.md" "$PROJECT_DIR/orchestration-prompt.md"
    echo -e "${GREEN}  ✓ Orchestration prompt copied to project root${NC}"
else
    echo -e "${GREEN}  ✓ Orchestration prompt already in project root${NC}"
fi

# Launch Claude with agent teams — pass the prompt as a CLI argument
PROMPT="Read orchestration-prompt.md and execute the full agent team plan. Also reference the agent-tasks/ folder for each agent's detailed task file. Reference docs/COMPREHENSIVE_ARCHITECTURE.md sections 22-26 and docs/Curretn Claudecode plan.md for implementation details. Spawn all 10 teammates according to the wave execution order."
tmux send-keys -t "$TMUX_SESSION" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions \"$PROMPT\"" C-m

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  ✅ GoldLedger Agent Team Launched!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${BLUE}  Monitor:${NC}  tmux attach -t $TMUX_SESSION"
echo -e "${BLUE}  Detach:${NC}   Ctrl+B then D"
echo -e "${BLUE}  Kill:${NC}     tmux kill-session -t $TMUX_SESSION"
echo ""
echo -e "${CYAN}  Agent Controls (inside Claude Code):${NC}"
echo -e "    Shift+Up/Down  Navigate teammates"
echo -e "    Enter          View teammate session"
echo -e "    Escape         Interrupt teammate"
echo -e "    Ctrl+T         Toggle task list"
echo ""
echo -e "${YELLOW}  Attaching to tmux session...${NC}"
echo ""

tmux attach -t "$TMUX_SESSION"
