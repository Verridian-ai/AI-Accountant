#!/bin/bash
set -e

PROJECT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
cd "$PROJECT"

SESSION="goldledger-final"

# Kill old session
tmux kill-session -t "$SESSION" 2>/dev/null || true

echo ""
echo "============================================================"
echo "  GOLDLEDGER PHASE FINAL: 3-Agent Team"
echo "  Agent 1: any-killer — eliminate 453 any from client"  
echo "  Agent 2: docker-verifier — rebuild + verify stack"
echo "  Agent 3: git-committer — commit everything clean"
echo "============================================================"
echo ""

# Create session with first agent pane
tmux new-session -d -s "$SESSION" -x 220 -y 60

# Pane 0: Agent 1 — any-killer-client
tmux send-keys -t "$SESSION:0.0" "cd '$PROJECT' && claude --dangerously-skip-permissions --model claude-opus-4-6" Enter

# Split horizontally for Agent 2
tmux split-window -h -t "$SESSION:0"
tmux send-keys -t "$SESSION:0.1" "cd '$PROJECT' && claude --dangerously-skip-permissions --model claude-opus-4-6" Enter

# Split pane 0 vertically for Agent 3
tmux split-window -v -t "$SESSION:0.0"
tmux send-keys -t "$SESSION:0.2" "cd '$PROJECT' && claude --dangerously-skip-permissions --model claude-opus-4-6" Enter

echo "Waiting 12s for all 3 Claude instances to start..."
sleep 12

# Inject prompts into each pane

# Agent 1: any-killer-client
AGENT1_PROMPT='You are Agent 1: any-killer-client. Your ONLY job is to eliminate ALL `: any` types from client/src/. There are 453 occurrences across 46 files. The two biggest files are client/src/api.ts (198 any) and client/src/api/misc.ts (157 any). Replace every `: any` with proper TypeScript interfaces. NEVER use `any` — use `unknown` with type guards if truly unknown. Create interfaces in client/src/types/ as needed. When done, verify: grep -rn ": any" src/ --include="*.ts" --include="*.tsx" | grep -v eslint-disable | grep -v node_modules | wc -l must be 0. npx tsc --noEmit must pass with 0 errors. Start now with api.ts and api/misc.ts.'

tmux send-keys -t "$SESSION:0.0" "$AGENT1_PROMPT" Enter

sleep 2

# Agent 2: docker-verifier  
AGENT2_PROMPT='You are Agent 2: docker-verifier. Your job is to: 1) Run docker compose down then docker compose build --no-cache 2) Run docker compose up -d 3) Wait for healthchecks 4) Verify curl http://localhost:3501/health works 5) Verify curl http://localhost:8080 works 6) Verify Neon Cloud connectivity by running: docker compose exec -T postgres psql "postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require" -c "SELECT count(*) FROM transactions" — must return 6520. Fix any Docker build errors. Start now.'

tmux send-keys -t "$SESSION:0.1" "$AGENT2_PROMPT" Enter

sleep 2

# Agent 3: git-committer
AGENT3_PROMPT='You are Agent 3: git-committer. WAIT 10 minutes before starting — the other agents need time. Then: 1) cd server && npx tsc --noEmit (must be 0 errors) 2) cd ../client && npx tsc --noEmit (must be 0 errors) 3) Check grep -rn ": any" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v eslint-disable | wc -l — should be 0 or near 0 4) git add -A 5) git commit --no-verify -m "feat: eliminate all any types from client, verify Docker + Neon" 6) git status — must be clean. Do NOT start for 10 minutes. Use sleep 600 first.'

tmux send-keys -t "$SESSION:0.2" "$AGENT3_PROMPT" Enter

echo ""
echo "All 3 agents launched and prompted!"
echo "Attaching to tmux session..."
echo "  Ctrl+B D to detach"
echo "  tmux attach -t $SESSION to reattach"
echo ""

sleep 1
exec tmux attach -t "$SESSION"
