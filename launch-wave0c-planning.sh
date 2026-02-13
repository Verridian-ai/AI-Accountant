#!/bin/bash
# ============================================================
# GoldLedger — Wave 0C: Meta-Planning Agent Team Launcher
# 7 Agents: 3 Researchers + 1 Writer + 2 Debaters
# ============================================================
# Plans Waves 25–30 (theming, code quality, UI/UX, native apps).
# Waves 1–24 are complete or in progress; Wave 0C extends the
# roadmap with 6 new waves.
# Run from WSL: bash launch-wave0c-planning.sh
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
TMUX_SESSION="wave0c-planning"

echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  GoldLedger — Wave 0C: Meta-Planning Agent Team${NC}"
echo -e "${MAGENTA}  7 Agents | 4 Phases | Planning Waves 25–30${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""
echo -e "${CYAN}  Phase A: 3 Researchers (parallel)${NC}"
echo -e "${CYAN}  Phase B: 1 Writer (synthesis — 72 files)${NC}"
echo -e "${CYAN}  Phase C: 2 Debaters (parallel review)${NC}"
echo -e "${CYAN}  Phase D: Writer revision (final pass)${NC}"
echo ""

# Step 1: Prerequisites
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

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

# Step 2: Verify required files exist
echo -e "${YELLOW}[2/6] Verifying Wave 0C files...${NC}"

MISSING=0
for f in "wave0c-orchestration-prompt.md" \
         "wave0c-agent-tasks/R01-platform-theming-researcher.md" \
         "wave0c-agent-tasks/R02-codebase-quality-researcher.md" \
         "wave0c-agent-tasks/R03-native-crossplatform-researcher.md" \
         "wave0c-agent-tasks/W01-plan-synthesizer-writer.md" \
         "wave0c-agent-tasks/D01-architecture-integration-reviewer.md" \
         "wave0c-agent-tasks/D02-quality-completeness-reviewer.md"; do
    if [ -f "$PROJECT_DIR/$f" ]; then
        echo -e "${GREEN}  ✓ $f${NC}"
    else
        echo -e "${RED}  ✗ MISSING: $f${NC}"
        MISSING=$((MISSING + 1))
    fi
done

if [ "$MISSING" -gt 0 ]; then
    echo -e "${RED}  ✗ $MISSING required files missing! Aborting.${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ All 7 Wave 0C files verified${NC}"

# Step 3: Create output directories
echo -e "${YELLOW}[3/6] Creating output directories...${NC}"
mkdir -p "$PROJECT_DIR/wave0c-research"
mkdir -p "$PROJECT_DIR/wave0c-reviews"
echo -e "${GREEN}  ✓ wave0c-research/ created${NC}"
echo -e "${GREEN}  ✓ wave0c-reviews/ created${NC}"

# Step 4: Kill existing session
echo -e "${YELLOW}[4/6] Cleaning up existing sessions...${NC}"
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux kill-session -t "$TMUX_SESSION"
    echo -e "${GREEN}  ✓ Old session killed${NC}"
else
    echo -e "${GREEN}  ✓ No existing session${NC}"
fi

# Step 5: Create tmux session
echo -e "${YELLOW}[5/6] Creating tmux session '$TMUX_SESSION'...${NC}"
tmux new-session -d -s "$TMUX_SESSION" -x 250 -y 60

# Set environment
tmux send-keys -t "$TMUX_SESSION" "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" C-m
tmux send-keys -t "$TMUX_SESSION" "cd '$PROJECT_DIR'" C-m

# Tmux styling
tmux set-option -t "$TMUX_SESSION" -g status-style "bg=#1a1b26,fg=#a9b1d6"
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#f7768e,bold] Wave 0C Planning (Waves 25-30) "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M:%S "

echo -e "${GREEN}  ✓ tmux session created${NC}"

# Step 6: Launch Claude Code with Wave 0C orchestration prompt
echo -e "${YELLOW}[6/6] Launching Claude Code Agent Team (7 agents)...${NC}"

PROMPT="Read wave0c-orchestration-prompt.md and execute the full meta-planning agent team for Waves 25-30. Also reference wave0c-agent-tasks/ for each agent's detailed task file. Spawn all 7 teammates and begin coordinating their work according to the phase execution order: Phase A (3 researchers in parallel), then Phase B (writer creates 72 files for Waves 25-30), then Phase C (2 debaters in parallel), then Phase D (writer revision). Output wave plans to waveN-orchestration-prompt.md, waveN-agent-tasks/, and launch-waveN.sh for N=25..30."
tmux send-keys -t "$TMUX_SESSION" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions \"$PROMPT\"" C-m

echo ""
echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  ✅ Wave 0C Meta-Planning Team Launched!${NC}"
echo -e "${MAGENTA}============================================================${NC}"
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
echo -e "${YELLOW}  Expected Phases:${NC}"
echo -e "    Phase A: ~10-15 min  (3 researchers gathering context)"
echo -e "    Phase B: ~20-30 min  (writer synthesizing 6 wave plans = 72 files)"
echo -e "    Phase C: ~10-15 min  (2 debaters reviewing plans)"
echo -e "    Phase D: ~10-15 min  (writer incorporating feedback)"
echo -e "    Total:   ~50-75 min estimated"
echo ""
echo -e "${YELLOW}  Attaching to tmux session...${NC}"
echo ""

tmux attach -t "$TMUX_SESSION"

