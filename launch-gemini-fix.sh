#!/bin/bash
# ============================================================
# GoldLedger — Gemini Fix Wave: Client TypeScript Error Resolution
# 4 Agents: API Stubs → Type Annotations → Type Compat → Build Verify
# ============================================================
# Fixes all 298 client TypeScript errors and gets Docker building.
# Uses Gemini CLI (--yolo mode) instead of Claude Code.
# Run from WSL: bash launch-gemini-fix.sh
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
TMUX_SESSION="goldledger-gemini-fix"

echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  GoldLedger — Gemini Fix Wave: TypeScript Error Resolution${NC}"
echo -e "${MAGENTA}  4 Agents | Sequential | Gemini CLI --yolo${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""
echo -e "${CYAN}  Agent 01: API Stubs & Missing Exports (~197 errors)${NC}"
echo -e "${CYAN}  Agent 02: Type Annotations (~76 errors)${NC}"
echo -e "${CYAN}  Agent 03: Type Compatibility (~25 errors)${NC}"
echo -e "${CYAN}  Agent 04: Build Verifier & Docker${NC}"
echo ""

# Step 1: Prerequisites
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}  tmux not found. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y tmux
fi
echo -e "${GREEN}  ✓ tmux: $(tmux -V)${NC}"

if ! command -v gemini &> /dev/null; then
    echo -e "${RED}  ✗ Gemini CLI not found!${NC}"
    echo -e "${YELLOW}  Install: npm install -g @anthropic-ai/gemini-cli${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Gemini CLI $(gemini --version)${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}  ✗ Node.js not found!${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v)${NC}"

# Step 2: Verify required files
echo -e "${YELLOW}[2/5] Verifying Gemini fix wave files...${NC}"

MISSING=0
for f in "gemini-fix-orchestration-prompt.md" \
         "gemini-fix-agent-tasks/01-api-stubs.md" \
         "gemini-fix-agent-tasks/02-type-annotations.md" \
         "gemini-fix-agent-tasks/03-type-compatibility.md" \
         "gemini-fix-agent-tasks/04-build-verifier.md"; do
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
echo -e "${GREEN}  ✓ All 5 Gemini fix wave files verified${NC}"

# Step 3: Clean old marker files
echo -e "${YELLOW}[3/5] Cleaning old marker files...${NC}"
rm -f "$PROJECT_DIR/.agent-done-GF-01" "$PROJECT_DIR/.agent-done-GF-02" \
      "$PROJECT_DIR/.agent-done-GF-03" "$PROJECT_DIR/.agent-done-GF-04"
echo -e "${GREEN}  ✓ Old markers cleaned${NC}"

# Step 4: Kill existing session
echo -e "${YELLOW}[4/5] Cleaning up existing sessions...${NC}"
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux kill-session -t "$TMUX_SESSION"
    echo -e "${GREEN}  ✓ Old session killed${NC}"
else
    echo -e "${GREEN}  ✓ No existing session${NC}"
fi

# Step 5: Create tmux session and launch all 4 agents sequentially
echo -e "${YELLOW}[5/5] Launching Gemini fix agent team...${NC}"
tmux new-session -d -s "$TMUX_SESSION" -x 250 -y 60

# Style the tmux session
tmux set-option -t "$TMUX_SESSION" -g status-style "bg=#1a1b26,fg=#a9b1d6"
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#FFCC00,bold] Gemini Fix Wave "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M:%S "

# Navigate to project directory
tmux send-keys -t "$TMUX_SESSION" "cd '$PROJECT_DIR'" C-m
sleep 1

# Build the sequential command chain — all 4 agents in one pane
# Agent 01: API Stubs (starts immediately)
tmux send-keys -t "$TMUX_SESSION" "echo '========================================'" C-m
tmux send-keys -t "$TMUX_SESSION" "echo '  AGENT 01: API Stubs & Missing Exports'" C-m
tmux send-keys -t "$TMUX_SESSION" "echo '========================================'" C-m
tmux send-keys -t "$TMUX_SESSION" "gemini --yolo -p 'You are Agent 01 in a 4-agent team fixing TypeScript errors in a project at the current directory. Read gemini-fix-orchestration-prompt.md for overview, then read gemini-fix-agent-tasks/01-api-stubs.md for your specific task. Add ALL missing exports to client/src/api.ts. Also add missing methods to existing API objects (analyticsApi, taxApi, transactionsApi). When done, run: touch .agent-done-GF-01'" C-m

# Agent 02: Type Annotations (chained after Agent 01)
tmux send-keys -t "$TMUX_SESSION" "echo '========================================'" C-m
tmux send-keys -t "$TMUX_SESSION" "echo '  AGENT 02: Type Annotations'" C-m
tmux send-keys -t "$TMUX_SESSION" "echo '========================================'" C-m
tmux send-keys -t "$TMUX_SESSION" "gemini --yolo -p 'You are Agent 02 in a 4-agent team fixing TypeScript errors in a project at the current directory. Read gemini-fix-orchestration-prompt.md for overview and gemini-fix-agent-tasks/02-type-annotations.md for your task. Fix all TS7006 implicit any types and TS18046 unknown type errors across all client component files. When done, run: touch .agent-done-GF-02'" C-m

# Agent 03: Type Compatibility (chained after Agent 02)
tmux send-keys -t "$TMUX_SESSION" "echo '========================================'" C-m
tmux send-keys -t "$TMUX_SESSION" "echo '  AGENT 03: Type Compatibility'" C-m
tmux send-keys -t "$TMUX_SESSION" "echo '========================================'" C-m
tmux send-keys -t "$TMUX_SESSION" "gemini --yolo -p 'You are Agent 03 in a 4-agent team fixing TypeScript errors in a project at the current directory. Read gemini-fix-orchestration-prompt.md for overview and gemini-fix-agent-tasks/03-type-compatibility.md for your task. Fix all remaining type compatibility errors (TS2322, TS2345, TS2769, TS2352, TS2304, TS2307). When done, run: touch .agent-done-GF-03'" C-m

# Agent 04: Build Verifier (chained after Agent 03)
tmux send-keys -t "$TMUX_SESSION" "echo '========================================'" C-m
tmux send-keys -t "$TMUX_SESSION" "echo '  AGENT 04: Build Verifier & Docker'" C-m
tmux send-keys -t "$TMUX_SESSION" "echo '========================================'" C-m
tmux send-keys -t "$TMUX_SESSION" "gemini --yolo -p 'You are Agent 04 in a 4-agent team fixing TypeScript errors in a project at the current directory. Read gemini-fix-orchestration-prompt.md for overview and gemini-fix-agent-tasks/04-build-verifier.md for your task. Verify tsc passes with zero errors, update docker-compose.yml to load all migrations, run docker compose build. When done, run: touch .agent-done-GF-04'" C-m

echo ""
echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  ✅ Gemini Fix Wave Launched!${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""
echo -e "${BLUE}  Monitor:${NC}  tmux attach -t $TMUX_SESSION"
echo -e "${BLUE}  Detach:${NC}   Ctrl+B then D"
echo -e "${BLUE}  Kill:${NC}     tmux kill-session -t $TMUX_SESSION"
echo ""
echo -e "${YELLOW}  Expected: ~45-90 min (4 sequential agents in one pane)${NC}"
echo -e "${YELLOW}  Markers:  .agent-done-GF-01 through .agent-done-GF-04${NC}"
echo ""
echo -e "${YELLOW}  To monitor: tmux attach -t $TMUX_SESSION${NC}"
echo ""

