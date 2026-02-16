#!/bin/bash
# ============================================================
# GoldLedger — Multi-Agent Refactoring Team Launcher
# 4 Execution Agents + 2 QA Agents via tmux + Claude CLI
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
TMUX_SESSION="goldledger-refactor"
MODEL="claude-opus-4-20250514"

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  GoldLedger — Refactoring Agent Team Launcher${NC}"
echo -e "${CYAN}  6 Agents: 4 Execution + 2 QA Pair Reviewers${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# ── Step 1: Prerequisites ──────────────────────────────────
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}  tmux not found. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y tmux
fi
echo -e "${GREEN}  ✓ tmux $(tmux -V)${NC}"

if ! command -v claude &> /dev/null; then
    echo -e "${RED}  ✗ Claude CLI not found${NC}"
    echo -e "${YELLOW}  Install: npm install -g @anthropic-ai/claude-code${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Claude CLI available${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}  ✗ git not found${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ git available${NC}"

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}  ✗ Project directory not found: $PROJECT_DIR${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Project directory exists${NC}"

if [ ! -f "$PROJECT_DIR/agent-team/task-tracker.md" ]; then
    echo -e "${RED}  ✗ task-tracker.md not found in agent-team/${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Task tracker found${NC}"

# ── Step 2: Kill existing session ──────────────────────────
echo -e "${YELLOW}[2/5] Cleaning up...${NC}"
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux kill-session -t "$TMUX_SESSION"
    echo -e "${GREEN}  ✓ Killed existing session${NC}"
else
    echo -e "${GREEN}  ✓ No existing session${NC}"
fi

# ── Step 3: Create tmux session with 6 panes ──────────────
echo -e "${YELLOW}[3/5] Creating tmux session with 6 panes...${NC}"

# Create session with first pane (Exec-1)
tmux new-session -d -s "$TMUX_SESSION" -x 280 -y 70
tmux rename-window -t "$TMUX_SESSION" "refactor-team"

# Split into 2x3 grid:
# Exec-1 | Exec-2 | Exec-3
# Exec-4 | QA-5   | QA-6
tmux split-window -t "$TMUX_SESSION" -h       # Exec-1 | right
tmux split-window -t "$TMUX_SESSION" -h       # Exec-1 | middle | right
tmux select-pane -t "$TMUX_SESSION:0.0"
tmux split-window -t "$TMUX_SESSION" -v       # Split Exec-1 vertically → Exec-4 below
tmux select-pane -t "$TMUX_SESSION:0.2"
tmux split-window -t "$TMUX_SESSION" -v       # Split middle vertically → QA-5 below
tmux select-pane -t "$TMUX_SESSION:0.4"
tmux split-window -t "$TMUX_SESSION" -v       # Split right vertically → QA-6 below

echo -e "${GREEN}  ✓ 6 panes created (2×3 grid)${NC}"

# ── Step 4: Style tmux ────────────────────────────────────
echo -e "${YELLOW}[4/5] Styling tmux session...${NC}"

tmux set-option -t "$TMUX_SESSION" -g status-style "bg=#1a1b26,fg=#a9b1d6"
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#7aa2f7,bold] 🔧 GoldLedger Refactor Team "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M "
tmux set-option -t "$TMUX_SESSION" -g pane-border-style "fg=#3b4261"
tmux set-option -t "$TMUX_SESSION" -g pane-active-border-style "fg=#7aa2f7"
tmux set-option -t "$TMUX_SESSION" pane-border-format " #{pane_index}: #{pane_title} "
tmux set-option -t "$TMUX_SESSION" pane-border-status top

echo -e "${GREEN}  ✓ Styled${NC}"

# ── Step 5: Launch agents ─────────────────────────────────
echo -e "${YELLOW}[5/5] Launching 6 agents...${NC}"

# ── Agent prompt templates ─────────────────────────────────

EXEC_PROMPT_BASE="You are AGENT_NAME, an execution agent on the GoldLedger refactoring team.

FIRST: Read agent-team/refactoring-orchestration-prompt.md for the full protocol.

Your workflow:
1. Read agent-team/task-tracker.md — find tasks with [ ] status
2. Verify ALL dependencies are [x] before claiming
3. Claim: edit tracker, change [ ] to [/], put AGENT_NAME in Agent column
4. Read full task instructions from docs/REFACTORING_TASKS_DETAILED.md
5. Create branch: git checkout -b refactor/REFACTOR-XXX-short-name
6. Execute every step in the task precisely
7. Run ALL verification steps (tsc --noEmit, eslint, tests, wc -l ≤300)
8. Mark done: edit tracker, change [/] to [R]
9. Pick next task — repeat

Priority: [!] rejections first, then P0 critical path, then P1, then P2.
Focus on earliest available wave to unblock downstream work.
Start NOW — read the orchestration prompt and claim your first task."

QA_PROMPT_BASE="You are AGENT_NAME, a QA reviewer on the GoldLedger refactoring team.

FIRST: Read agent-team/refactoring-orchestration-prompt.md for the full protocol.

Your focus: QA_FOCUS

PRIORITY: First review REFACTOR-001 through REFACTOR-007 (completed by Gemini agent) before monitoring for new [R] tasks. These 7 tasks were done by a different AI agent and have NOT been verified. They may not follow branch naming conventions, may lack verification, and may not respect the 300-line limit. Be extra thorough — check git log and git branch -a to find the work. These tasks block the entire dependency chain.

Your workflow:
1. Monitor agent-team/task-tracker.md for tasks with [R] status
2. Checkout the branch listed in the tracker (for Gemini tasks, check git log/branch -a first)
3. Open docs/REFACTORING_TASKS_DETAILED.md, find the task, verify every step was done
4. Run all verification steps from the task
5. Check 300-line limit on all new/modified files (wc -l)
6. APPROVE: change [R] to [x] | REJECT: change [R] to [!] with reason
7. Both QA agents must agree — coordinate via tracker notes

If no [R] tasks available, audit previously completed tasks or review codebase health.
Start NOW — read the orchestration prompt, then immediately begin reviewing REFACTOR-001 through REFACTOR-007."

# ── Launch each agent in its pane ──────────────────────────

# Pane layout after splits:
# Pane 0: top-left (Exec-1)     Pane 1: bottom-left (Exec-4)
# Pane 2: top-middle (Exec-2)   Pane 3: bottom-middle (QA-5)
# Pane 4: top-right (Exec-3)    Pane 5: bottom-right (QA-6)

launch_agent() {
    local pane=$1
    local name=$2
    local prompt=$3

    # Set pane title
    tmux select-pane -t "$TMUX_SESSION:0.$pane" -T "$name"
    # cd to project
    tmux send-keys -t "$TMUX_SESSION:0.$pane" "cd '$PROJECT_DIR'" C-m
    sleep 0.3
    # Launch claude
    tmux send-keys -t "$TMUX_SESSION:0.$pane" "claude --model $MODEL --dangerously-skip-permissions -p \"$prompt\"" C-m
    echo -e "${GREEN}  ✓ $name launched (pane $pane)${NC}"
}

# Build per-agent prompts
EXEC1_PROMPT="${EXEC_PROMPT_BASE//AGENT_NAME/Exec-1}"
EXEC2_PROMPT="${EXEC_PROMPT_BASE//AGENT_NAME/Exec-2}"
EXEC3_PROMPT="${EXEC_PROMPT_BASE//AGENT_NAME/Exec-3}"
EXEC4_PROMPT="${EXEC_PROMPT_BASE//AGENT_NAME/Exec-4}"

QA5_PROMPT="${QA_PROMPT_BASE//AGENT_NAME/QA-5}"
QA5_PROMPT="${QA5_PROMPT//QA_FOCUS/Code quality — correct file splits, import paths, no regressions, type safety, lint compliance}"

QA6_PROMPT="${QA_PROMPT_BASE//AGENT_NAME/QA-6}"
QA6_PROMPT="${QA6_PROMPT//QA_FOCUS/Verification — all checks pass, tests work, no dead code, 300-line limit respected}"

# Launch all 6 agents with staggered starts to avoid file contention
launch_agent 0 "Exec-1" "$EXEC1_PROMPT"
sleep 2
launch_agent 2 "Exec-2" "$EXEC2_PROMPT"
sleep 2
launch_agent 4 "Exec-3" "$EXEC3_PROMPT"
sleep 2
launch_agent 1 "Exec-4" "$EXEC4_PROMPT"
sleep 2
launch_agent 3 "QA-5" "$QA5_PROMPT"
sleep 2
launch_agent 5 "QA-6" "$QA6_PROMPT"

# ── Done ───────────────────────────────────────────────────

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  ✅ All 6 agents launched!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${BLUE}  Monitor:${NC}    ${CYAN}tmux attach -t $TMUX_SESSION${NC}"
echo -e "${BLUE}  Detach:${NC}     ${CYAN}Ctrl+B then D${NC}"
echo -e "${BLUE}  Switch pane:${NC} ${CYAN}Ctrl+B then arrow keys${NC}"
echo -e "${BLUE}  Kill:${NC}       ${CYAN}tmux kill-session -t $TMUX_SESSION${NC}"
echo ""
echo -e "${BLUE}  Pane layout:${NC}"
echo -e "${CYAN}    ┌──────────┬──────────┬──────────┐${NC}"
echo -e "${CYAN}    │  Exec-1  │  Exec-2  │  Exec-3  │${NC}"
echo -e "${CYAN}    ├──────────┼──────────┼──────────┤${NC}"
echo -e "${CYAN}    │  Exec-4  │  QA-5    │  QA-6    │${NC}"
echo -e "${CYAN}    └──────────┴──────────┴──────────┘${NC}"
echo ""
echo -e "${PURPLE}  Attaching to session...${NC}"
echo ""

tmux attach -t "$TMUX_SESSION"

