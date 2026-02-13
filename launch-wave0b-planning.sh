#!/bin/bash
# ============================================================
# GoldLedger — Wave 0B: Meta-Planning Agent Team Launcher
# 16 Agents: 10 Researchers + 1 Writer + 5 Debaters
# ============================================================
# Plans Waves 1–10 (the foundational waves that were never
# turned into executable files). Wave 0 planned Waves 11–24;
# Wave 0B fills the gap for Waves 1–10.
# Run from WSL: bash launch-wave0b-planning.sh
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
TMUX_SESSION="wave0b-planning"

echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  GoldLedger — Wave 0B: Meta-Planning Agent Team${NC}"
echo -e "${MAGENTA}  16 Agents | 4 Phases | Planning Waves 1–10${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""
echo -e "${CYAN}  Phase A: 10 Haiku Researchers (parallel)${NC}"
echo -e "${CYAN}  Phase B: 1 Sonnet Writer (synthesis)${NC}"
echo -e "${CYAN}  Phase C: 5 Opus Debaters (parallel review)${NC}"
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
echo -e "${YELLOW}[2/6] Verifying Wave 0B files...${NC}"

MISSING=0
for f in "wave0b-orchestration-prompt.md" \
         "wave0b-agent-tasks/R01-codebase-current-state-researcher.md" \
         "wave0b-agent-tasks/R02-wave-specs-extractor.md" \
         "wave0b-agent-tasks/R03-compatibility-analyzer.md" \
         "wave0b-agent-tasks/R04-database-schema-gap-analyzer.md" \
         "wave0b-agent-tasks/R05-agent-architecture-analyzer.md" \
         "wave0b-agent-tasks/R06-api-endpoint-mapper.md" \
         "wave0b-agent-tasks/R07-frontend-component-planner.md" \
         "wave0b-agent-tasks/R08-cognee-integration-planner.md" \
         "wave0b-agent-tasks/R09-infrastructure-analyzer.md" \
         "wave0b-agent-tasks/R10-dependency-ordering-analyzer.md" \
         "wave0b-agent-tasks/W01-plan-synthesizer-writer.md" \
         "wave0b-agent-tasks/D01-architecture-devils-advocate.md" \
         "wave0b-agent-tasks/D02-security-compliance-reviewer.md" \
         "wave0b-agent-tasks/D03-scalability-performance-reviewer.md" \
         "wave0b-agent-tasks/D04-integration-dependencies-reviewer.md" \
         "wave0b-agent-tasks/D05-completeness-quality-reviewer.md"; do
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
echo -e "${GREEN}  ✓ All 17 Wave 0B files verified${NC}"

# Step 3: Create output directories
echo -e "${YELLOW}[3/6] Creating output directories...${NC}"
mkdir -p "$PROJECT_DIR/wave0b-research"
mkdir -p "$PROJECT_DIR/wave0b-reviews"
echo -e "${GREEN}  ✓ wave0b-research/ created${NC}"
echo -e "${GREEN}  ✓ wave0b-reviews/ created${NC}"

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
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#f7768e,bold] Wave 0B Planning (Waves 1-10) "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M:%S "

echo -e "${GREEN}  ✓ tmux session created${NC}"

# Step 6: Launch Claude Code with Wave 0B orchestration prompt
echo -e "${YELLOW}[6/6] Launching Claude Code Agent Team (16 agents)...${NC}"

PROMPT="Read wave0b-orchestration-prompt.md and execute the full meta-planning agent team for Waves 1-10. Also reference wave0b-agent-tasks/ for each agent's detailed task file. Spawn all 16 teammates and begin coordinating their work according to the phase execution order: Phase A (10 researchers in parallel), then Phase B (writer creates 120 files for Waves 1-10), then Phase C (5 debaters in parallel), then Phase D (writer revision). Output wave plans to waveN-orchestration-prompt.md, waveN-agent-tasks/, and launch-waveN.sh for N=1..10."
tmux send-keys -t "$TMUX_SESSION" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions \"$PROMPT\"" C-m

echo ""
echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  ✅ Wave 0B Meta-Planning Team Launched!${NC}"
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
echo -e "    Phase A: ~15-20 min  (10 researchers gathering context)"
echo -e "    Phase B: ~30-45 min  (writer synthesizing 10 wave plans = 120 files)"
echo -e "    Phase C: ~15-20 min  (5 debaters reviewing plans)"
echo -e "    Phase D: ~15-20 min  (writer incorporating feedback)"
echo -e "    Total:   ~75-105 min estimated"
echo ""
echo -e "${YELLOW}  Attaching to tmux session...${NC}"
echo ""

tmux attach -t "$TMUX_SESSION"

