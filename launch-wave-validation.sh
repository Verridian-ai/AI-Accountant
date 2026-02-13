#!/bin/bash
# ============================================================
# GoldLedger — Wave V: Pre-Execution Validation
# 4 Agents: Audit → Build → Docker/Data → Fix & Commit
# ============================================================
# Validates Waves 11-23 work correctly despite missing
# Wave 1-10 dependencies. Fixes compilation errors and
# verifies user data integrity.
# Run from WSL: bash launch-wave-validation.sh
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
TMUX_SESSION="goldledger-validation"

echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  GoldLedger — Wave V: Pre-Execution Validation${NC}"
echo -e "${MAGENTA}  4 Agents | Sequential | Waves 11-23 Check${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""
echo -e "${CYAN}  Agent 01: Dependency Audit (scan for broken refs)${NC}"
echo -e "${CYAN}  Agent 02: Build & Compile (tsc, npm run build)${NC}"
echo -e "${CYAN}  Agent 03: Docker & Data Integrity (health + data check)${NC}"
echo -e "${CYAN}  Agent 04: Fix & Commit (repair + git commit)${NC}"
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

# Step 2: Verify required files
echo -e "${YELLOW}[2/5] Verifying validation wave files...${NC}"

MISSING=0
for f in "wave-validation-orchestration-prompt.md" \
         "wave-validation-agent-tasks/01-dependency-auditor.md" \
         "wave-validation-agent-tasks/02-build-compile-validator.md" \
         "wave-validation-agent-tasks/03-docker-data-integrity.md" \
         "wave-validation-agent-tasks/04-fixer-committer.md"; do
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
echo -e "${GREEN}  ✓ All 5 validation wave files verified${NC}"

# Step 3: Create output directory
echo -e "${YELLOW}[3/5] Creating output directory...${NC}"
mkdir -p "$PROJECT_DIR/wave-validation-reports"
echo -e "${GREEN}  ✓ wave-validation-reports/ created${NC}"

# Step 4: Kill existing session
echo -e "${YELLOW}[4/5] Cleaning up existing sessions...${NC}"
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux kill-session -t "$TMUX_SESSION"
    echo -e "${GREEN}  ✓ Old session killed${NC}"
else
    echo -e "${GREEN}  ✓ No existing session${NC}"
fi

# Step 5: Create tmux session and launch
echo -e "${YELLOW}[5/5] Launching validation agent team...${NC}"
tmux new-session -d -s "$TMUX_SESSION" -x 250 -y 60

tmux send-keys -t "$TMUX_SESSION" "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" C-m
tmux send-keys -t "$TMUX_SESSION" "cd '$PROJECT_DIR'" C-m

tmux set-option -t "$TMUX_SESSION" -g status-style "bg=#1a1b26,fg=#a9b1d6"
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#f7768e,bold] Wave V: Validation "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M:%S "

PROMPT="Read wave-validation-orchestration-prompt.md and execute the validation wave. Read each agent task file from wave-validation-agent-tasks/ for detailed instructions. Run all 4 agents sequentially: 01 dependency audit, 02 build/compile check, 03 Docker and data integrity, 04 fix issues and git commit. Write reports to wave-validation-reports/. CRITICAL: do NOT modify any user data — only fix code files."
tmux send-keys -t "$TMUX_SESSION" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions \"$PROMPT\"" C-m

echo ""
echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  ✅ Validation Wave Launched!${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""
echo -e "${BLUE}  Monitor:${NC}  tmux attach -t $TMUX_SESSION"
echo -e "${BLUE}  Detach:${NC}   Ctrl+B then D"
echo -e "${BLUE}  Kill:${NC}     tmux kill-session -t $TMUX_SESSION"
echo ""
echo -e "${YELLOW}  Expected: ~20-40 min (4 sequential agents)${NC}"
echo -e "${YELLOW}  Markers:  .agent-done-WV-01 through .agent-done-WV-04${NC}"
echo ""
echo -e "${YELLOW}  Attaching to tmux session...${NC}"
echo ""

tmux attach -t "$TMUX_SESSION"

