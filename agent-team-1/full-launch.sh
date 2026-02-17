#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# GoldLedger Agent Teams — Full Launch Script
# ══════════════════════════════════════════════════════════════════════════════
# This does everything: installs tmux config, creates worktrees, copies
# CLAUDE.md, sets env vars, and launches the tmux observability layout.
#
# USAGE:
#   chmod +x full-launch.sh
#   ./full-launch.sh
#
# ══════════════════════════════════════════════════════════════════════════════

set -e

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
WORKTREE_BASE="/mnt/c/Users/Danie/Desktop/goldledger-worktrees"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_NAME="goldledger-refactor"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  GoldLedger Agent Teams — Full Launch${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""

# ── Step 1: Preflight Checks ─────────────────────────────────────────────────
echo -e "${BOLD}[1/7] Preflight checks...${NC}"

# WSL check
if ! grep -qi microsoft /proc/version 2>/dev/null; then
    echo -e "${YELLOW}  WARNING: Not running in WSL2. Proceeding anyway...${NC}"
else
    echo -e "${GREEN}  ✓ WSL2 detected${NC}"
fi

# tmux
if ! command -v tmux &>/dev/null; then
    echo -e "${YELLOW}  Installing tmux...${NC}"
    sudo apt update -qq && sudo apt install -y tmux
fi
echo -e "${GREEN}  ✓ tmux $(tmux -V)${NC}"

# Node
if ! command -v node &>/dev/null; then
    echo -e "${RED}  ✗ Node.js not found. Install with: nvm install --lts${NC}"
    exit 1
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
    echo -e "${RED}  ✗ Node.js $NODE_VER found, need 20+. Run: nvm install --lts${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v)${NC}"

# Claude Code CLI
if ! command -v claude &>/dev/null; then
    echo -e "${RED}  ✗ Claude Code CLI not found. Install: npm install -g @anthropic-ai/claude-code${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Claude Code CLI found${NC}"

# Project directory
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}  ✗ Project not found: $PROJECT_DIR${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Project directory exists${NC}"

# Git
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo -e "${RED}  ✗ No .git directory in project${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Git repo detected${NC}"

echo ""

# ── Step 2: Install tmux config ──────────────────────────────────────────────
echo -e "${BOLD}[2/7] Installing tmux config...${NC}"

TMUX_CONF_SRC="$SCRIPT_DIR/.tmux.agent-teams.conf"
TMUX_CONF_DST="$HOME/.tmux.agent-teams.conf"

if [ -f "$TMUX_CONF_SRC" ]; then
    cp "$TMUX_CONF_SRC" "$TMUX_CONF_DST"
    echo -e "${GREEN}  ✓ Copied tmux config to $TMUX_CONF_DST${NC}"
else
    echo -e "${YELLOW}  ⚠ tmux config not found at $TMUX_CONF_SRC, using defaults${NC}"
fi

echo ""

# ── Step 3: Set environment variables ────────────────────────────────────────
echo -e "${BOLD}[3/7] Setting environment variables...${NC}"

export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
export CLAUDE_CODE_SPAWN_BACKEND=tmux

# Persist to .bashrc if not already there
if ! grep -q "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS" "$HOME/.bashrc" 2>/dev/null; then
    echo "" >> "$HOME/.bashrc"
    echo "# Claude Code Agent Teams" >> "$HOME/.bashrc"
    echo "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" >> "$HOME/.bashrc"
    echo "export CLAUDE_CODE_SPAWN_BACKEND=tmux" >> "$HOME/.bashrc"
    echo -e "${GREEN}  ✓ Added env vars to .bashrc${NC}"
else
    echo -e "${GREEN}  ✓ Env vars already in .bashrc${NC}"
fi

echo -e "${GREEN}  ✓ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1${NC}"
echo -e "${GREEN}  ✓ CLAUDE_CODE_SPAWN_BACKEND=tmux${NC}"

echo ""

# ── Step 4: Create git worktrees ─────────────────────────────────────────────
echo -e "${BOLD}[4/7] Creating git worktrees...${NC}"

cd "$PROJECT_DIR"

mkdir -p "$WORKTREE_BASE"

for i in 1 2 3; do
    WORKTREE_PATH="$WORKTREE_BASE/agent-$i"
    if [ -d "$WORKTREE_PATH" ]; then
        echo -e "${YELLOW}  Removing existing worktree agent-$i...${NC}"
        git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || rm -rf "$WORKTREE_PATH"
    fi
    git worktree add "$WORKTREE_PATH" main 2>/dev/null
    echo -e "${GREEN}  ✓ Worktree agent-$i → $WORKTREE_PATH${NC}"
done

echo ""

# ── Step 5: Copy CLAUDE.md to project root ───────────────────────────────────
echo -e "${BOLD}[5/7] Copying CLAUDE.md to project root...${NC}"

CLAUDE_MD_SRC="$SCRIPT_DIR/CLAUDE.md"

if [ -f "$CLAUDE_MD_SRC" ]; then
    cp "$CLAUDE_MD_SRC" "$PROJECT_DIR/CLAUDE.md"
    echo -e "${GREEN}  ✓ CLAUDE.md copied to project root${NC}"
else
    echo -e "${YELLOW}  ⚠ CLAUDE.md not found at $CLAUDE_MD_SRC${NC}"
    echo -e "${YELLOW}    Teammates won't auto-load project context${NC}"
fi

echo ""

# ── Step 6: Show current status ──────────────────────────────────────────────
echo -e "${BOLD}[6/7] Current project status...${NC}"

cd "$PROJECT_DIR"

echo -e "  ${CYAN}Branches:${NC}"
git branch -a 2>/dev/null | head -15 | while read line; do
    echo "    $line"
done

echo ""

if [ -f "$PROJECT_DIR/agent-team/task-tracker.md" ]; then
    TOTAL=$(grep -c 'REFACTOR-' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')
    NOT_STARTED=$(grep -c '\[ \]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')
    IN_PROGRESS=$(grep -c '\[/\]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')
    REVIEW=$(grep -c '\[R\]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')
    APPROVED=$(grep -c '\[x\]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')
    REJECTED=$(grep -c '\[!\]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')

    echo -e "  ${CYAN}Task Tracker:${NC}"
    echo -e "    Total tasks:      $TOTAL"
    echo -e "    Not started [ ]:  $NOT_STARTED"
    echo -e "    In progress [/]:  $IN_PROGRESS"
    echo -e "    Review [R]:       $REVIEW"
    echo -e "    Approved [x]:     $APPROVED"
    echo -e "    Rejected [!]:     $REJECTED"
else
    echo -e "  ${YELLOW}Task tracker not found at agent-team/task-tracker.md${NC}"
fi

echo ""

# ── Step 7: Kill existing sessions and launch tmux ───────────────────────────
echo -e "${BOLD}[7/7] Launching tmux session...${NC}"

# Kill existing session if present
tmux kill-session -t "$SESSION_NAME" 2>/dev/null && \
    echo -e "${YELLOW}  Killed existing session '$SESSION_NAME'${NC}"

# Also kill any orphaned claude-swarm sessions
tmux kill-session -t claude-swarm 2>/dev/null && \
    echo -e "${YELLOW}  Killed orphaned claude-swarm session${NC}"

echo ""

# Create tmux session with custom config
if [ -f "$TMUX_CONF_DST" ]; then
    TMUX_FLAGS="-f $TMUX_CONF_DST"
else
    TMUX_FLAGS=""
fi

# ── Build the layout ─────────────────────────────────────────────────────────
# ┌─────────────────────────────┬────────────────────┐
# │  TEAM LEAD (Pane 0)        │  OBSERVER (Pane 1)  │
# │  Run 'claude' here         │  Agent monitoring    │
# │  Paste wave prompts        │                      │
# ├─────────────────────────────┴────────────────────┤
# │  STATUS BAR (Pane 2)                              │
# │  Git info, task tracker summary, quick commands    │
# └───────────────────────────────────────────────────┘

tmux $TMUX_FLAGS new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR" -x 220 -y 55

# Pane 0: Team Lead (main pane — this is where you run claude)
tmux send-keys -t "$SESSION_NAME:0.0" "cd '$PROJECT_DIR'" Enter
tmux send-keys -t "$SESSION_NAME:0.0" "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" Enter
tmux send-keys -t "$SESSION_NAME:0.0" "export CLAUDE_CODE_SPAWN_BACKEND=tmux" Enter
tmux send-keys -t "$SESSION_NAME:0.0" "clear" Enter

# Split right for Observer pane
tmux split-window -h -t "$SESSION_NAME:0.0" -c "$PROJECT_DIR" -p 35

# Pane 1: Observer — preload helper functions
tmux send-keys -t "$SESSION_NAME:0.1" "cd '$PROJECT_DIR'" Enter

# Define watch-agents helper in the observer pane
WATCH_AGENTS_FN='watch-agents() {
  echo "═══ AGENT TEAM MONITOR ═══"
  echo ""
  echo "--- Task Tracker ---"
  if [ -f "agent-team/task-tracker.md" ]; then
    echo "  [ ]: $(grep -c "\\[ \\]" agent-team/task-tracker.md 2>/dev/null || echo 0) not started"
    echo "  [/]: $(grep -c "\\[/\\]" agent-team/task-tracker.md 2>/dev/null || echo 0) in progress"
    echo "  [R]: $(grep -c "\\[R\\]" agent-team/task-tracker.md 2>/dev/null || echo 0) review"
    echo "  [x]: $(grep -c "\\[x\\]" agent-team/task-tracker.md 2>/dev/null || echo 0) approved"
    echo "  [!]: $(grep -c "\\[!\\]" agent-team/task-tracker.md 2>/dev/null || echo 0) rejected"
  fi
  echo ""
  echo "--- Git Branches ---"
  git branch --list "refactor/*" 2>/dev/null | tail -10
  echo ""
  echo "--- Worktrees ---"
  git worktree list 2>/dev/null
  echo ""
  echo "--- Recent Commits ---"
  git log --oneline -5 2>/dev/null
  echo ""
  echo "--- Agent Panes ---"
  tmux list-panes -t goldledger-refactor 2>/dev/null | while read line; do
    echo "  $line"
  done
}'

tmux send-keys -t "$SESSION_NAME:0.1" "$WATCH_AGENTS_FN" Enter

# Define watch-tasks helper
WATCH_TASKS_FN='watch-tasks() {
  echo "═══ TASK STATUS ═══"
  if [ -f "agent-team/task-tracker.md" ]; then
    grep "REFACTOR-" agent-team/task-tracker.md | head -30
  else
    echo "No task tracker found"
  fi
}'

tmux send-keys -t "$SESSION_NAME:0.1" "$WATCH_TASKS_FN" Enter

# Define live-monitor helper
LIVE_MONITOR_FN='live-monitor() {
  watch -n 5 "bash -c '\''
    echo \"═══ LIVE MONITOR (every 5s) ═══\"
    echo \"\"
    echo \"Task Tracker:\"
    if [ -f agent-team/task-tracker.md ]; then
      echo \"  [ ]: \$(grep -c \"\\[ \\]\" agent-team/task-tracker.md 2>/dev/null || echo 0)  [/]: \$(grep -c \"\\[/\\]\" agent-team/task-tracker.md 2>/dev/null || echo 0)  [R]: \$(grep -c \"\\[R\\]\" agent-team/task-tracker.md 2>/dev/null || echo 0)  [x]: \$(grep -c \"\\[x\\]\" agent-team/task-tracker.md 2>/dev/null || echo 0)  [!]: \$(grep -c \"\\[!\\]\" agent-team/task-tracker.md 2>/dev/null || echo 0)\"
    fi
    echo \"\"
    echo \"Recent git activity:\"
    git log --oneline -3 2>/dev/null
    echo \"\"
    echo \"Panes:\"
    tmux list-panes -t goldledger-refactor 2>/dev/null
  '\''"
}'

tmux send-keys -t "$SESSION_NAME:0.1" "$LIVE_MONITOR_FN" Enter
tmux send-keys -t "$SESSION_NAME:0.1" "clear" Enter
tmux send-keys -t "$SESSION_NAME:0.1" "echo '═══ OBSERVER PANE ═══'" Enter
tmux send-keys -t "$SESSION_NAME:0.1" "echo 'Commands: watch-agents | watch-tasks | live-monitor'" Enter
tmux send-keys -t "$SESSION_NAME:0.1" "echo 'Ctrl+a z = zoom pane | Ctrl+a T = rebalance'" Enter
tmux send-keys -t "$SESSION_NAME:0.1" "echo ''" Enter
tmux send-keys -t "$SESSION_NAME:0.1" "watch-agents" Enter

# Split bottom for status bar
tmux split-window -v -t "$SESSION_NAME:0.0" -c "$PROJECT_DIR" -p 15

# Pane 2: Status bar
tmux send-keys -t "$SESSION_NAME:0.2" "cd '$PROJECT_DIR'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "clear" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '═══════════════════════════════════════════════════════════════'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '  GOLDLEDGER REFACTORING — AGENT TEAMS SESSION'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '═══════════════════════════════════════════════════════════════'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo ''" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '  STATUS: 001-015 done (need QA) | 016-060 not started'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '  MODEL:  All agents using Opus 4.6'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo ''" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '  STEP 1: Type \"claude\" in the TEAM LEAD pane (top-left)'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '  STEP 2: Paste QA-A prompt from REFACTORING_AGENT_TEAMS_v3.md'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '  STEP 3: Ctrl+a T to rebalance after agents spawn'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo ''" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '  SHORTCUTS: Ctrl+a T=tile | Ctrl+a z=zoom | Alt+Arrow=switch'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '  CLEANUP:  Ctrl+a X=kill agents | Ctrl+a Q=kill session'" Enter
tmux send-keys -t "$SESSION_NAME:0.2" "echo '═══════════════════════════════════════════════════════════════'" Enter

# Focus on the Team Lead pane
tmux select-pane -t "$SESSION_NAME:0.0"

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Session '${SESSION_NAME}' is ready!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Attaching now...${NC}"
echo ""
echo -e "  Once inside:"
echo -e "    1. Type ${CYAN}claude${NC} in the TEAM LEAD pane (top-left)"
echo -e "    2. Paste the ${CYAN}QA-A${NC} prompt from REFACTORING_AGENT_TEAMS_v3.md"
echo -e "    3. Press ${CYAN}Ctrl+a T${NC} to rebalance after agents spawn"
echo ""
echo -e "  Worktrees at: ${CYAN}$WORKTREE_BASE/agent-{1,2,3}${NC}"
echo -e "  Prompts at:   ${CYAN}$SCRIPT_DIR/REFACTORING_AGENT_TEAMS_v3.md${NC}"
echo ""

# Attach to the session
tmux attach-session -t "$SESSION_NAME"
