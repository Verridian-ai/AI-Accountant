#!/bin/bash
# ============================================================================
# CBA Statement Parser - Multi-Agent Team Launcher
# Verridian AI - Agent Orchestration System
# ============================================================================
# Usage: wsl bash /mnt/c/Users/Danie/Desktop/CBA\ Statements\ Parse/agents/launch-agents.sh
# Attach: wsl tmux attach -t cba-agents
# ============================================================================

set -euo pipefail

SESSION="cba-agents"
PROJECT_DIR="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
AGENTS_DIR="$PROJECT_DIR/agents"
OUTPUT_DIR="$AGENTS_DIR/output"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🤖 Verridian AI - CBA Statement Parser Agent Team         ║${NC}"
echo -e "${CYAN}║  Multi-Agent Orchestration System v1.0                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Kill existing session if present
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}[ORCHESTRATOR]${NC} Creating tmux session: ${YELLOW}$SESSION${NC}"
echo -e "${GREEN}[ORCHESTRATOR]${NC} Timestamp: $TIMESTAMP"
echo ""

# Create session with the orchestrator/dashboard window
tmux new-session -d -s "$SESSION" -n "dashboard" -x 220 -y 50

# Dashboard window - shows real-time agent status
tmux send-keys -t "$SESSION:dashboard" "clear && echo -e '${CYAN}═══════════════════════════════════════${NC}' && echo -e '${CYAN}  AGENT DASHBOARD - Real-time Monitor  ${NC}' && echo -e '${CYAN}═══════════════════════════════════════${NC}' && echo '' && watch -n 5 'echo \"=== Agent Output Files ===\"; ls -la \"$OUTPUT_DIR/\" 2>/dev/null; echo \"\"; echo \"=== Latest Findings ===\"; for f in \"$OUTPUT_DIR\"/*.json; do echo \"--- \$(basename \$f) ---\"; tail -3 \"\$f\" 2>/dev/null; echo; done'" Enter

# ============================================================================
# IDEATION TEAM - 8 Specialized Research Agents
# ============================================================================

echo -e "${MAGENTA}[TEAM: IDEATION]${NC} Deploying 8 research agents..."

# Agent 1: Competitor Scanner - Bank Statement Parsers
tmux new-window -t "$SESSION" -n "agent-1-competitors"
tmux send-keys -t "$SESSION:agent-1-competitors" "cd '$AGENTS_DIR' && bash ideation/agent-competitor-scanner.sh 2>&1 | tee '$OUTPUT_DIR/agent1_competitor_scanner_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 1: Competitor Scanner [bank statement parsers]"

# Agent 2: Fintech Feature Analyzer
tmux new-window -t "$SESSION" -n "agent-2-fintech"
tmux send-keys -t "$SESSION:agent-2-fintech" "cd '$AGENTS_DIR' && bash ideation/agent-fintech-analyzer.sh 2>&1 | tee '$OUTPUT_DIR/agent2_fintech_analyzer_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 2: Fintech Feature Analyzer [innovative features]"

# Agent 3: Accounting Software Researcher
tmux new-window -t "$SESSION" -n "agent-3-accounting"
tmux send-keys -t "$SESSION:agent-3-accounting" "cd '$AGENTS_DIR' && bash ideation/agent-accounting-researcher.sh 2>&1 | tee '$OUTPUT_DIR/agent3_accounting_researcher_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 3: Accounting Software Researcher [Xero/MYOB/QuickBooks]"

# Agent 4: AI/ML Innovation Scout
tmux new-window -t "$SESSION" -n "agent-4-aiml"
tmux send-keys -t "$SESSION:agent-4-aiml" "cd '$AGENTS_DIR' && bash ideation/agent-ai-innovation.sh 2>&1 | tee '$OUTPUT_DIR/agent4_ai_innovation_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 4: AI/ML Innovation Scout [cutting-edge AI features]"

# Agent 5: UX/UI Trend Researcher
tmux new-window -t "$SESSION" -n "agent-5-ux"
tmux send-keys -t "$SESSION:agent-5-ux" "cd '$AGENTS_DIR' && bash ideation/agent-ux-trends.sh 2>&1 | tee '$OUTPUT_DIR/agent5_ux_trends_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 5: UX/UI Trend Researcher [design patterns]"

# Agent 6: Australian Compliance Specialist
tmux new-window -t "$SESSION" -n "agent-6-compliance"
tmux send-keys -t "$SESSION:agent-6-compliance" "cd '$AGENTS_DIR' && bash ideation/agent-au-compliance.sh 2>&1 | tee '$OUTPUT_DIR/agent6_au_compliance_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 6: AU Compliance Specialist [ATO/GST/BAS]"

# Agent 7: Open Banking & API Researcher
tmux new-window -t "$SESSION" -n "agent-7-openbanking"
tmux send-keys -t "$SESSION:agent-7-openbanking" "cd '$AGENTS_DIR' && bash ideation/agent-open-banking.sh 2>&1 | tee '$OUTPUT_DIR/agent7_open_banking_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 7: Open Banking & API Researcher [CDR/APIs]"

# Agent 8: Feature Synthesizer & Prioritizer
tmux new-window -t "$SESSION" -n "agent-8-synthesizer"
tmux send-keys -t "$SESSION:agent-8-synthesizer" "cd '$AGENTS_DIR' && bash ideation/agent-synthesizer.sh 2>&1 | tee '$OUTPUT_DIR/agent8_synthesizer_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 8: Feature Synthesizer & Prioritizer [aggregation]"

# ============================================================================
# FEATURE BUILD AGENTS
# ============================================================================

echo ""
echo -e "${BLUE}[TEAM: BUILD]${NC} Deploying feature implementation agents..."

# Agent 9: Invoice System Builder
tmux new-window -t "$SESSION" -n "build-invoicing"
tmux send-keys -t "$SESSION:build-invoicing" "cd '$PROJECT_DIR' && echo -e '${GREEN}[AGENT-9: INVOICING]${NC} Building invoice system...' && node agents/builders/build-invoicing.mjs 2>&1 | tee '$OUTPUT_DIR/agent9_invoicing_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 9: Invoice System Builder"

# Agent 10: Gmail Integration Builder
tmux new-window -t "$SESSION" -n "build-gmail"
tmux send-keys -t "$SESSION:build-gmail" "cd '$PROJECT_DIR' && echo -e '${GREEN}[AGENT-10: GMAIL]${NC} Building Gmail integration...' && node agents/builders/build-gmail.mjs 2>&1 | tee '$OUTPUT_DIR/agent10_gmail_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 10: Gmail Integration Builder"

# Agent 11: Parsing Feedback Enhancement
tmux new-window -t "$SESSION" -n "build-feedback"
tmux send-keys -t "$SESSION:build-feedback" "cd '$PROJECT_DIR' && echo -e '${GREEN}[AGENT-11: FEEDBACK]${NC} Enhancing parsing feedback...' && node agents/builders/build-parsing-feedback.mjs 2>&1 | tee '$OUTPUT_DIR/agent11_feedback_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 11: Parsing Feedback Builder"

# Agent 12: PDF Viewer & Verification
tmux new-window -t "$SESSION" -n "build-pdfviewer"
tmux send-keys -t "$SESSION:build-pdfviewer" "cd '$PROJECT_DIR' && echo -e '${GREEN}[AGENT-12: PDF-VIEWER]${NC} Building PDF viewer...' && node agents/builders/build-pdf-viewer.mjs 2>&1 | tee '$OUTPUT_DIR/agent12_pdfviewer_$TIMESTAMP.log'" Enter
echo -e "  ${GREEN}✓${NC} Agent 12: PDF Viewer & Verification Builder"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ✅ All 12 agents deployed successfully!                    ║${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}║  📊 Monitor:  tmux attach -t cba-agents                     ║${NC}"
echo -e "${CYAN}║  🔄 Switch:   Ctrl+B then window number (0-12)              ║${NC}"
echo -e "${CYAN}║  📋 List:     Ctrl+B then W (window list)                   ║${NC}"
echo -e "${CYAN}║  🚪 Detach:   Ctrl+B then D                                 ║${NC}"
echo -e "${CYAN}║  💀 Kill:     tmux kill-session -t cba-agents               ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

# Attach to session
tmux attach -t "$SESSION"
