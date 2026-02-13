#!/bin/bash
# ─── GoldLedger Wave 8: Recurring Invoices & Payment Processing ─────────────
# Launch 10 Claude Code agents in tmux panes
# Prerequisite: Wave 7 must be complete (.agent-done-W07-{01..10})
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

WAVE="8"
SESSION="wave${WAVE}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TASK_DIR="${PROJECT_DIR}/wave${WAVE}-agent-tasks"
ORCH_PROMPT="${PROJECT_DIR}/wave${WAVE}-orchestration-prompt.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
GOLD='\033[0;33m'
NC='\033[0m'

echo -e "${GOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GOLD}║  GoldLedger Wave ${WAVE}: Recurring Invoices & Payment Processing  ║${NC}"
echo -e "${GOLD}╚══════════════════════════════════════════════════════════════╝${NC}"

# ─── Prerequisite checks ────────────────────────────────────────────────────

# Check tmux
if ! command -v tmux &>/dev/null; then
  echo -e "${RED}ERROR: tmux is not installed. Install with: sudo apt install tmux${NC}"
  exit 1
fi

# Check Claude Code
if ! command -v claude &>/dev/null; then
  echo -e "${RED}ERROR: Claude Code CLI not found. Install from https://claude.com/claude-code${NC}"
  exit 1
fi

# Check Docker (optional)
if command -v docker &>/dev/null; then
  if docker compose ps --format '{{.Service}}' 2>/dev/null | grep -q postgres; then
    echo -e "${GREEN}✓ Docker services running${NC}"
  else
    echo -e "${GOLD}⚠ Docker services not running — agents can still generate code${NC}"
  fi
fi

# Check Wave 7 completion
W07_COUNT=0
for i in $(seq -w 1 10); do
  if [ -f "${PROJECT_DIR}/.agent-done-W07-$i" ]; then
    W07_COUNT=$((W07_COUNT + 1))
  fi
done
if [ "$W07_COUNT" -lt 10 ]; then
  echo -e "${RED}ERROR: Wave 7 is not complete ($W07_COUNT/10 markers found).${NC}"
  echo -e "${RED}Wave 8 depends on Wave 7 (customers + invoices tables).${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Wave 7 complete ($W07_COUNT/10 markers)${NC}"

# Check orchestration prompt
if [ ! -f "$ORCH_PROMPT" ]; then
  echo -e "${RED}ERROR: Orchestration prompt not found: ${ORCH_PROMPT}${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Orchestration prompt found${NC}"

# Check task files
TASK_COUNT=$(ls -1 "${TASK_DIR}"/*.md 2>/dev/null | wc -l)
if [ "$TASK_COUNT" -lt 10 ]; then
  echo -e "${RED}ERROR: Expected 10 task files in ${TASK_DIR}, found ${TASK_COUNT}${NC}"
  exit 1
fi
echo -e "${GREEN}✓ ${TASK_COUNT} agent task files found${NC}"

# ─── Kill existing session ──────────────────────────────────────────────────

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo -e "${GOLD}Killing existing tmux session: ${SESSION}${NC}"
  tmux kill-session -t "$SESSION"
fi

# ─── Create tmux session ────────────────────────────────────────────────────

echo -e "${GOLD}Creating tmux session: ${SESSION}${NC}"
tmux new-session -d -s "$SESSION" -x 220 -y 55

# Tmux styling
tmux set-option -t "$SESSION" status-style "bg=#1a1b26,fg=#FFCC00"
tmux set-option -t "$SESSION" status-left "#[fg=#1a1b26,bg=#FFCC00,bold] W${WAVE} "
tmux set-option -t "$SESSION" status-right "#[fg=#FFCC00] Recurring & Payments #[fg=#666666]| %H:%M "
tmux set-option -t "$SESSION" pane-border-style "fg=#333333"
tmux set-option -t "$SESSION" pane-active-border-style "fg=#FFCC00"

# ─── Launch agents ──────────────────────────────────────────────────────────

launch_agent() {
  local agent_num=$1
  local task_file=$2
  local agent_name=$3

  local padded=$(printf "%02d" "$agent_num")
  local marker=".agent-done-W08-${padded}"
  local pane_title="A${padded}:${agent_name}"

  if [ "$agent_num" -eq 1 ]; then
    tmux rename-window -t "${SESSION}:0" "$pane_title"
  else
    tmux split-window -t "$SESSION" -h 2>/dev/null || tmux split-window -t "$SESSION" -v
  fi

  tmux select-layout -t "$SESSION" tiled

  local cmd="cd '${PROJECT_DIR}' && claude --dangerously-skip-permissions -p \"\$(cat '${ORCH_PROMPT}') \n\n--- AGENT TASK ---\n\n\$(cat '${task_file}')\" | tee /tmp/wave8-agent-${padded}.log; touch '${PROJECT_DIR}/${marker}'; echo 'DONE: ${marker}'"

  tmux send-keys -t "$SESSION" "$cmd" C-m

  echo -e "  ${GREEN}✓ Agent ${padded}: ${agent_name}${NC}"
}

echo -e "${GOLD}Launching 10 agents...${NC}"
echo ""

launch_agent  1 "${TASK_DIR}/01-recurring-schema-builder.md"        "Schema"
launch_agent  2 "${TASK_DIR}/02-recurring-service-builder.md"       "RecurringService"
launch_agent  3 "${TASK_DIR}/03-payment-gateway-builder.md"         "PaymentGateway"
launch_agent  4 "${TASK_DIR}/04-dunning-service-builder.md"         "DunningService"
launch_agent  5 "${TASK_DIR}/05-subscription-service-builder.md"    "SubscriptionSvc"
launch_agent  6 "${TASK_DIR}/06-cognee-payments-builder.md"         "CogneePayments"
launch_agent  7 "${TASK_DIR}/07-api-routes-builder.md"              "APIRoutes"
launch_agent  8 "${TASK_DIR}/08-ui-recurring-builder.md"            "UIRecurring"
launch_agent  9 "${TASK_DIR}/09-ui-payment-dunning-builder.md"      "UIPayments"
launch_agent 10 "${TASK_DIR}/10-testing-validation-agent.md"        "Testing"

echo ""
echo -e "${GOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GOLD}║  All 10 agents launched! Attach with: tmux attach -t ${SESSION}   ║${NC}"
echo -e "${GOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Monitor: tmux attach -t ${SESSION}${NC}"
echo -e "  ${GREEN}Logs:    /tmp/wave8-agent-*.log${NC}"
echo -e "  ${GREEN}Status:  ls -la ${PROJECT_DIR}/.agent-done-W08-*${NC}"
