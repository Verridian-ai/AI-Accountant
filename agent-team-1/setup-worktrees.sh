#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# GoldLedger Refactoring — Agent Teams Environment Setup
# ══════════════════════════════════════════════════════════════════════════════
# Run this ONCE before launching any agent teams.
# Creates git worktrees so parallel agents don't corrupt each other's branches.
# ══════════════════════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
WORKTREE_BASE="/mnt/c/Users/Danie/Desktop/goldledger-worktrees"

echo "═══════════════════════════════════════════════════"
echo "  GoldLedger Agent Teams — Environment Setup"
echo "═══════════════════════════════════════════════════"

# Validate project directory
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "ERROR: No .git directory found at $PROJECT_DIR"
    echo "Make sure the project path is correct."
    exit 1
fi

cd "$PROJECT_DIR"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo "WARNING: Uncommitted changes detected in main project."
    echo "Recommendation: commit or stash before creating worktrees."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create worktree base directory
echo ""
echo "Creating worktree directory at: $WORKTREE_BASE"
mkdir -p "$WORKTREE_BASE"

# Create 3 agent worktrees (enough for any single wave)
for i in 1 2 3; do
    WORKTREE_PATH="$WORKTREE_BASE/agent-$i"
    if [ -d "$WORKTREE_PATH" ]; then
        echo "  Worktree agent-$i already exists, removing..."
        git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || rm -rf "$WORKTREE_PATH"
    fi
    echo "  Creating worktree: agent-$i"
    git worktree add "$WORKTREE_PATH" main
done

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Worktrees created:"
echo "═══════════════════════════════════════════════════"
git worktree list
echo ""

# Verify key files exist
echo "Verifying key files..."
MISSING=0

if [ ! -f "$PROJECT_DIR/docs/REFACTORING_TASKS_DETAILED.md" ]; then
    echo "  MISSING: docs/REFACTORING_TASKS_DETAILED.md"
    MISSING=1
fi

if [ ! -f "$PROJECT_DIR/agent-team/task-tracker.md" ]; then
    echo "  MISSING: agent-team/task-tracker.md"
    MISSING=1
fi

if [ $MISSING -eq 0 ]; then
    echo "  All key files present."
fi

# Show task tracker status
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Current Task Tracker Status"
echo "═══════════════════════════════════════════════════"
if [ -f "$PROJECT_DIR/agent-team/task-tracker.md" ]; then
    echo "  Total tasks:    $(grep -c 'REFACTOR-' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '?')"
    echo "  Not started [ ]: $(grep -c '\[ \]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')"
    echo "  In progress [/]: $(grep -c '\[/\]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')"
    echo "  Review [R]:      $(grep -c '\[R\]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')"
    echo "  Approved [x]:    $(grep -c '\[x\]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')"
    echo "  Rejected [!]:    $(grep -c '\[!\]' "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null || echo '0')"
else
    echo "  Task tracker not found."
fi

# Show Gemini pre-work status
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Gemini Pre-Work Status (REFACTOR-001 through 007)"
echo "═══════════════════════════════════════════════════"
if [ -f "$PROJECT_DIR/agent-team/task-tracker.md" ]; then
    for i in $(seq -w 1 7); do
        STATUS=$(grep "REFACTOR-00$i" "$PROJECT_DIR/agent-team/task-tracker.md" 2>/dev/null | head -1 || echo "  REFACTOR-00$i: not found")
        echo "  $STATUS"
    done
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup Complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Main project:  $PROJECT_DIR"
echo "  Agent worktrees:"
echo "    Agent 1:     $WORKTREE_BASE/agent-1"
echo "    Agent 2:     $WORKTREE_BASE/agent-2"
echo "    Agent 3:     $WORKTREE_BASE/agent-3"
echo ""
echo "  Next steps:"
echo "    1. Review the task tracker status above"
echo "    2. Open tmux: tmux new-session -s claude"
echo "    3. cd to project dir: cd '$PROJECT_DIR'"
echo "    4. Launch claude: claude"
echo "    5. Paste the appropriate wave prompt"
echo ""
echo "  Start with WAVE 0 (Gemini QA) if REFACTOR-001-007 are [R]"
echo "  Start with WAVE 1 (Independent tasks) if they're already [x]"
echo ""
