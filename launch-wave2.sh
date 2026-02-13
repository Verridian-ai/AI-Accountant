#!/bin/bash
# ============================================================
# GoldLedger Wave 2: Transaction Mutation & Streaming
# Launch Script — 10 Claude Code agents via tmux
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
GOLD='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
TMUX_SESSION="goldledger-wave2"

echo -e "${GOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GOLD}║  GoldLedger Wave 2: Transaction Mutation & Streaming    ║${NC}"
echo -e "${GOLD}║  10 Agent Launch Script                                 ║${NC}"
echo -e "${GOLD}╚══════════════════════════════════════════════════════════╝${NC}"

# ── Step 1: Prerequisites ──────────────────────────────────
echo -e "\n${BLUE}[Step 1/5]${NC} Checking prerequisites..."

if ! command -v claude &> /dev/null; then
    echo -e "${RED}ERROR: 'claude' CLI not found. Install Claude Code first.${NC}"
    exit 1
fi

if ! command -v tmux &> /dev/null; then
    echo -e "${RED}ERROR: 'tmux' not found. Install with: sudo apt install tmux${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"

# ── Step 2: Docker Services ────────────────────────────────
echo -e "\n${BLUE}[Step 2/5]${NC} Verifying Docker services..."

cd "$PROJECT_DIR"

if command -v docker &> /dev/null && docker compose ps --status running 2>/dev/null | grep -q "cba-postgres"; then
    echo -e "${GREEN}✓ Docker services running${NC}"
else
    echo -e "${GOLD}⚠ Docker not running. Starting services...${NC}"
    docker compose up -d
    echo -e "${GREEN}✓ Docker services started${NC}"
fi

# ── Step 3: Wave 1 Completion Check ───────────────────────
echo -e "\n${BLUE}[Step 3/5]${NC} Checking Wave 1 completion..."

WAVE1_MARKERS=0
for i in $(seq -w 1 10); do
    if [ -f "$PROJECT_DIR/.agent-done-W01-$i" ]; then
        WAVE1_MARKERS=$((WAVE1_MARKERS + 1))
    fi
done

if [ "$WAVE1_MARKERS" -lt 10 ]; then
    echo -e "${RED}ERROR: Wave 1 not complete ($WAVE1_MARKERS/10 markers found).${NC}"
    echo -e "${RED}Wave 2 requires Wave 1 completion. Run launch-wave1.sh first.${NC}"
    echo -e "${GOLD}Missing markers:${NC}"
    for i in $(seq -w 1 10); do
        if [ ! -f "$PROJECT_DIR/.agent-done-W01-$i" ]; then
            echo -e "  ${RED}✗ .agent-done-W01-$i${NC}"
        fi
    done
    exit 1
fi

echo -e "${GREEN}✓ Wave 1 complete (10/10 markers)${NC}"

# ── Step 4: tmux Session ──────────────────────────────────
echo -e "\n${BLUE}[Step 4/5]${NC} Creating tmux session: ${GOLD}$TMUX_SESSION${NC}"

if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    echo -e "${GOLD}⚠ Session exists. Killing old session...${NC}"
    tmux kill-session -t "$TMUX_SESSION"
fi

tmux new-session -d -s "$TMUX_SESSION" -n "agent-01"

for i in $(seq -w 2 10); do
    tmux new-window -t "$TMUX_SESSION" -n "agent-$i"
done

echo -e "${GREEN}✓ tmux session created with 10 windows${NC}"

# ── Step 5: Launch Agents ─────────────────────────────────
echo -e "\n${BLUE}[Step 5/5]${NC} Launching 10 Claude Code agents..."

AGENTS=(
    "01:Mutation Schema Builder"
    "02:Mutation Tools Service"
    "03:Mutation Auth Service"
    "04:Confirmation Flow Service"
    "05:SSE Streaming Service"
    "06:Audit Trail Service"
    "07:API Endpoints Builder"
    "08:Agent Integration"
    "09:UI Chat & Audit Components"
    "10:Testing & Validation"
)

for agent in "${AGENTS[@]}"; do
    NUM="${agent%%:*}"
    NAME="${agent##*:}"
    TASK_FILE="wave2-agent-tasks/${NUM}-*.md"
    TASK_PATH=$(ls $PROJECT_DIR/$TASK_FILE 2>/dev/null | head -1)

    if [ -z "$TASK_PATH" ]; then
        echo -e "${RED}✗ Task file not found for Agent $NUM${NC}"
        continue
    fi

    TASK_BASENAME=$(basename "$TASK_PATH")

    echo -e "  ${GOLD}Agent $NUM${NC}: $NAME → $TASK_BASENAME"

    tmux send-keys -t "$TMUX_SESSION:agent-$NUM" \
        "cd '$PROJECT_DIR' && claude --dangerously-skip-permissions -p \"You are Agent $NUM ($NAME) for GoldLedger Wave 2. Read your task file at 'wave2-agent-tasks/$TASK_BASENAME' and execute ALL instructions. Read the orchestration prompt at 'wave2-orchestration-prompt.md' for team context. Start immediately.\"" C-m
done

echo -e "\n${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  All 10 agents launched successfully!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "\n${GOLD}Monitor:${NC} tmux attach -t $TMUX_SESSION"
echo -e "${GOLD}Switch windows:${NC} Ctrl+B then 0-9"
echo -e "${GOLD}Check progress:${NC} ls -la .agent-done-W2-*"
echo -e "\n${BLUE}Sub-Wave execution order:${NC}"
echo -e "  Sub-Wave 1: Agents 1,2,3,5 (parallel — no deps)"
echo -e "  Sub-Wave 2: Agents 4,6 (after Sub-Wave 1)"
echo -e "  Sub-Wave 3: Agents 7,8 (after Sub-Wave 2)"
echo -e "  Sub-Wave 4: Agents 9,10 (after Sub-Wave 3)"
