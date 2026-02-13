#!/bin/bash
# ============================================================
# GoldLedger — Wave 0B RESUME: Phase D Only (Revision Pass)
# ============================================================
# Phases A-C completed before usage limit hit.
# This script resumes ONLY Phase D: W01 reads debate reviews
# and incorporates feedback into the 120 wave files.
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
TMUX_SESSION="wave0b-planning"

echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  GoldLedger — Wave 0B RESUME: Phase D (Revision Pass)${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""
echo -e "${GREEN}  ✓ Phase A: 10 Researchers — ALREADY COMPLETE${NC}"
echo -e "${GREEN}  ✓ Phase B: W01 Writer — ALREADY COMPLETE (120 files)${NC}"
echo -e "${GREEN}  ✓ Phase C: 5 Debaters — ALREADY COMPLETE${NC}"
echo -e "${YELLOW}  → Phase D: W01 Revision — RESUMING NOW${NC}"
echo ""

# Verify all prior work exists
echo -e "${YELLOW}[1/3] Verifying prior work...${NC}"

MISSING=0
# Check research files
for r in R01-codebase-current-state R02-wave-specs-extracted R03-compatibility-analysis R04-schema-gaps R05-agent-architecture R06-api-endpoints R07-frontend-components R08-cognee-integration R09-infrastructure R10-dependency-ordering; do
    if [ ! -f "$PROJECT_DIR/wave0b-research/$r.md" ]; then
        echo -e "${RED}  ✗ MISSING: wave0b-research/$r.md${NC}"
        MISSING=$((MISSING + 1))
    fi
done
echo -e "${GREEN}  ✓ 10 research files verified${NC}"

# Check debate reviews
for d in D01-architecture-review D02-security-review D03-scalability-review D04-integration-review D05-completeness-review; do
    if [ ! -f "$PROJECT_DIR/wave0b-reviews/$d.md" ]; then
        echo -e "${RED}  ✗ MISSING: wave0b-reviews/$d.md${NC}"
        MISSING=$((MISSING + 1))
    fi
done
echo -e "${GREEN}  ✓ 5 debate review files verified${NC}"

# Check wave files
for i in 1 2 3 4 5 6 7 8 9 10; do
    if [ ! -f "$PROJECT_DIR/wave${i}-orchestration-prompt.md" ]; then
        echo -e "${RED}  ✗ MISSING: wave${i}-orchestration-prompt.md${NC}"
        MISSING=$((MISSING + 1))
    fi
    if [ ! -d "$PROJECT_DIR/wave${i}-agent-tasks" ]; then
        echo -e "${RED}  ✗ MISSING: wave${i}-agent-tasks/${NC}"
        MISSING=$((MISSING + 1))
    fi
    if [ ! -f "$PROJECT_DIR/launch-wave${i}.sh" ]; then
        echo -e "${RED}  ✗ MISSING: launch-wave${i}.sh${NC}"
        MISSING=$((MISSING + 1))
    fi
done
echo -e "${GREEN}  ✓ 10 orchestration prompts, 10 task dirs, 10 launch scripts verified${NC}"

if [ "$MISSING" -gt 0 ]; then
    echo -e "${RED}  ✗ $MISSING files missing! Cannot resume.${NC}"
    exit 1
fi

# Kill old session if exists
echo -e "${YELLOW}[2/3] Setting up tmux session...${NC}"
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux kill-session -t "$TMUX_SESSION"
fi
tmux new-session -d -s "$TMUX_SESSION" -x 250 -y 60
tmux send-keys -t "$TMUX_SESSION" "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" C-m
tmux send-keys -t "$TMUX_SESSION" "cd '$PROJECT_DIR'" C-m
tmux set-option -t "$TMUX_SESSION" -g status-style "bg=#1a1b26,fg=#a9b1d6"
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#f7768e,bold] Wave 0B Phase D RESUME "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M:%S "
echo -e "${GREEN}  ✓ tmux session created${NC}"

# Launch with Phase D resume prompt
echo -e "${YELLOW}[3/3] Launching Phase D revision...${NC}"

PROMPT="You are resuming Wave 0B Phase D — the FINAL revision pass. Phases A through C are ALREADY COMPLETE. DO NOT re-run researchers or debaters. Your ONLY job is Phase D: Read the 5 debate review files in wave0b-reviews/ (D01-architecture-review.md, D02-security-review.md, D03-scalability-review.md, D04-integration-review.md, D05-completeness-review.md) and incorporate their feedback into the existing wave files (wave1 through wave10 orchestration prompts, agent task files, and launch scripts). For each HIGH or CRITICAL severity issue found by debaters, update the relevant wave files. Create wave0b-reviews/REVISION-LOG.md documenting all changes made. When done, create the marker file .agent-done-0B-W01. Spawn sub-agents to work on multiple waves in parallel for speed."
tmux send-keys -t "$TMUX_SESSION" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions \"$PROMPT\"" C-m

echo ""
echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  ✅ Wave 0B Phase D Revision Launched!${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""
echo -e "${CYAN}  Monitor:${NC}  tmux attach -t $TMUX_SESSION"
echo -e "${CYAN}  Detach:${NC}   Ctrl+B then D"
echo ""
echo -e "${YELLOW}  Expected time: ~15-20 min${NC}"
echo ""

tmux attach -t "$TMUX_SESSION"

