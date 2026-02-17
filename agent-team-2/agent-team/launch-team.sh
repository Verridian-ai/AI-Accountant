#!/bin/bash
# ============================================================
# CBA Statements Parse - Multi-Agent Team Launcher
# Verridian AI - Agent Team Infrastructure
# ============================================================
# This script sets up and launches the Claude Code Agent Team
# with 8 specialized sub-agents in a tmux session via WSL.
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse/cba-statements"
TMUX_SESSION="cba-agent-team"
LOG_DIR="$PROJECT_DIR/agent-team/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  CBA Statements Parse - Multi-Agent Team Launcher${NC}"
echo -e "${CYAN}  Verridian AI${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"

# Check tmux
if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}  tmux not found. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y tmux
fi
echo -e "${GREEN}  ✓ tmux available: $(tmux -V)${NC}"

# Check Claude Code
if ! command -v claude &> /dev/null; then
    echo -e "${RED}  ✗ Claude Code CLI not found!${NC}"
    echo -e "${YELLOW}  Install with: npm install -g @anthropic-ai/claude-code${NC}"
    echo -e "${YELLOW}  Or: npx @anthropic-ai/claude-code${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Claude Code CLI available${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ✗ Node.js not found!${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v)${NC}"

# Step 2: Set up environment
echo -e "${YELLOW}[2/7] Setting up environment...${NC}"

# Enable experimental agent teams
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
echo -e "${GREEN}  ✓ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1${NC}"

# Create log directory
mkdir -p "$LOG_DIR"
echo -e "${GREEN}  ✓ Log directory ready: $LOG_DIR${NC}"

# Step 3: Kill any existing session
echo -e "${YELLOW}[3/7] Cleaning up existing sessions...${NC}"
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    echo -e "${YELLOW}  Found existing session '$TMUX_SESSION'. Killing it...${NC}"
    tmux kill-session -t "$TMUX_SESSION"
    echo -e "${GREEN}  ✓ Old session killed${NC}"
else
    echo -e "${GREEN}  ✓ No existing session found${NC}"
fi

# Step 4: Create tmux session
echo -e "${YELLOW}[4/7] Creating tmux session '$TMUX_SESSION'...${NC}"
tmux new-session -d -s "$TMUX_SESSION" -x 250 -y 60
echo -e "${GREEN}  ✓ tmux session created${NC}"

# Step 5: Set up tmux layout
echo -e "${YELLOW}[5/7] Setting up tmux pane layout...${NC}"

# Set environment in the session
tmux send-keys -t "$TMUX_SESSION" "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" C-m
tmux send-keys -t "$TMUX_SESSION" "cd '$PROJECT_DIR'" C-m

# Configure tmux appearance
tmux set-option -t "$TMUX_SESSION" -g status-style "bg=#1a1b26,fg=#a9b1d6"
tmux set-option -t "$TMUX_SESSION" -g status-left "#[fg=#7aa2f7,bold] 🏦 CBA Agent Team "
tmux set-option -t "$TMUX_SESSION" -g status-right "#[fg=#9ece6a] %H:%M:%S "
tmux set-option -t "$TMUX_SESSION" -g pane-border-style "fg=#3b4261"
tmux set-option -t "$TMUX_SESSION" -g pane-active-border-style "fg=#7aa2f7"

echo -e "${GREEN}  ✓ tmux layout configured${NC}"

# Step 6: Write the orchestration prompt
echo -e "${YELLOW}[6/7] Preparing orchestration prompt...${NC}"

ORCHESTRATION_PROMPT=$(cat << 'PROMPT_END'
You are the Team Lead for the CBA Bank Statement Parser development team at Verridian AI. Your job is to orchestrate a team of 8 specialized agents to build the following features in parallel.

CRITICAL: Read CLAUDE.md first for project context and conventions.

## Team Structure - Spawn these 8 teammates:

### Agent 1: "ideation-researcher" (Research & Competitor Analysis)
Role: Research competitor products (Frollo, YNAB, PocketSmith, DocuClipper, Up Banking, Xero) and identify innovative features. Document findings in agent-team/research/ directory.
Tasks:
- Web search for latest features in Australian fintech apps
- Analyze competitor pricing, features, and user pain points
- Document feature gaps and opportunities
- Create a competitive matrix comparing all products
- Write findings to agent-team/research/competitor_matrix.md

### Agent 2: "ideation-brainstorm" (Feature Brainstorming)  
Role: Based on competitor research, brainstorm innovative features unique to CBA Statement Parser. Focus on Australian market needs.
Tasks:
- Generate 20+ feature ideas organized by category
- Score each idea on impact, effort, and uniqueness
- Create user stories for top 10 features
- Write to agent-team/research/feature_proposals.md
- Propose integration opportunities (Xero, MYOB, QuickBooks)

### Agent 3: "scaffolder" (Project Scaffolding)
Role: Set up the Next.js project foundation with all dependencies and base structure.
Tasks:
- Initialize Next.js 14 project with TypeScript, TailwindCSS, shadcn/ui
- Set up Prisma with SQLite schema (transactions, invoices, categories, statements, gmail_imports)
- Configure project structure per CLAUDE.md
- Install all required dependencies
- Set up base layout, navigation, and routing
- Create shared types in src/types/

### Agent 4: "invoice-builder" (Invoicing System)
Role: Build the complete invoicing system with Australian tax compliance.
Tasks:
- Create Prisma schema for invoices (draft, sent, paid, overdue statuses)
- Build invoice generation from transaction data
- Implement GST calculation (10%) and ABN validation
- Create PDF export using @react-pdf/renderer
- Build invoice management UI (list, create, edit, send, mark paid)
- Support line items, subtotals, GST breakdown, total
- Build API routes: POST/GET/PUT/DELETE /api/invoices

### Agent 5: "gmail-integrator" (Gmail Integration)
Role: Build Gmail API integration for automatic statement import.
Tasks:
- Set up NextAuth.js with Google OAuth (Gmail read scope)
- Build Gmail API client to search for bank statement emails
- Implement PDF attachment detection and download
- Create auto-import pipeline: detect → download → parse → categorize
- Build email label management (mark processed, move to folder)
- Create settings UI for Gmail connection and import preferences
- Build scheduled import (cron) and on-demand import button
- Support detection for: CBA, ANZ, Westpac, NAB, Macquarie, St George

### Agent 6: "parsing-feedback" (Enhanced Parsing Feedback)
Role: Build real-time parsing progress indicators and feedback system.
Tasks:
- Create Server-Sent Events (SSE) endpoint for live progress
- Build parsing pipeline stages: PDF extraction → bank detection → transaction parsing → categorization → validation
- Implement progress tracking: current stage, transaction count, confidence scores, warnings
- Create detailed progress UI component with animated stages
- Add estimated time remaining calculation
- Show per-transaction confidence scores
- Build error/warning display for parsing issues
- Create API: GET /api/parse/progress/:jobId (SSE)

### Agent 7: "pdf-viewer" (PDF Viewer & Verification)
Role: Build in-browser PDF viewer with side-by-side verification workflow.
Tasks:
- Implement PDF.js viewer component for original statements
- Create side-by-side layout: PDF on left, parsed transactions on right
- Build line-by-line verification checklist
- Highlight matched/unmatched transaction lines
- Add manual transaction entry for missing items
- Create "mark as verified" workflow with verification status
- Build visual diff showing coverage percentage
- Show extraction confidence per line
- Create API: POST/GET /api/statements/:id/verify

### Agent 8: "ideation-documenter" (Documentation & Architecture)
Role: Document all findings, create architecture diagrams, and write technical specs.
Tasks:
- Create system architecture documentation
- Write API documentation for all endpoints
- Document database schema and relationships
- Create user workflow diagrams
- Write deployment guide
- Document agent team findings and decisions
- Create README.md with setup instructions
- Write to agent-team/docs/ directory

## Coordination Rules:
1. Agent 3 (scaffolder) starts first - others wait for project structure
2. Agents 1 & 2 (ideation) work independently in parallel
3. Agents 4, 5, 6, 7 start after scaffolding is complete
4. Agent 8 documents as other agents work
5. All agents write to their designated directories to avoid conflicts
6. Use the shared task list to track progress
7. Message each other when you have dependencies or findings to share

## Priority Order:
1. Project scaffolding (Agent 3) - CRITICAL PATH
2. Parsing feedback (Agent 6) - Core experience
3. PDF viewer & verification (Agent 7) - Core experience
4. Invoicing system (Agent 4) - Revenue feature
5. Gmail integration (Agent 5) - Growth feature
6. Ideation research (Agents 1, 2) - Strategic planning
7. Documentation (Agent 8) - Ongoing

START THE TEAM NOW. Spawn all 8 teammates and begin coordinating their work.
PROMPT_END
)

echo "$ORCHESTRATION_PROMPT" > "$PROJECT_DIR/agent-team/orchestration-prompt.md"
echo -e "${GREEN}  ✓ Orchestration prompt saved${NC}"

# Step 7: Launch Claude Code in the tmux session
echo -e "${YELLOW}[7/7] Launching Claude Code Agent Team...${NC}"
echo ""

# Send the Claude Code launch command to the tmux session
tmux send-keys -t "$TMUX_SESSION" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions" C-m

# Wait a moment for Claude to initialize
sleep 3

# Send the orchestration prompt
tmux send-keys -t "$TMUX_SESSION" "$(cat "$PROJECT_DIR/agent-team/orchestration-prompt.md" | head -5)" C-m

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  ✅ Agent Team Infrastructure Ready!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${BLUE}  To monitor the agent team:${NC}"
echo -e "${CYAN}    tmux attach -t $TMUX_SESSION${NC}"
echo ""
echo -e "${BLUE}  To detach from tmux (keep running):${NC}"
echo -e "${CYAN}    Press Ctrl+B then D${NC}"
echo ""
echo -e "${BLUE}  To list all tmux sessions:${NC}"
echo -e "${CYAN}    tmux list-sessions${NC}"
echo ""
echo -e "${BLUE}  To kill the session:${NC}"
echo -e "${CYAN}    tmux kill-session -t $TMUX_SESSION${NC}"
echo ""
echo -e "${BLUE}  Agent Team Controls (inside Claude Code):${NC}"
echo -e "${CYAN}    Shift+Up/Down  - Navigate between teammates${NC}"
echo -e "${CYAN}    Enter          - View teammate session${NC}"
echo -e "${CYAN}    Escape         - Interrupt teammate${NC}"
echo -e "${CYAN}    Ctrl+T         - Toggle task list${NC}"
echo ""
echo -e "${YELLOW}  📋 Orchestration prompt saved to:${NC}"
echo -e "${CYAN}    agent-team/orchestration-prompt.md${NC}"
echo ""
echo -e "${PURPLE}  Attaching to tmux session now...${NC}"
echo ""

# Attach to the tmux session
tmux attach -t "$TMUX_SESSION"
