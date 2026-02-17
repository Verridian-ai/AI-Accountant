#!/bin/bash
set -e

P="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
S="gl-agents"

tmux kill-session -t "$S" 2>/dev/null || true

# Create session with 3 separate windows (not panes — more reliable)
tmux new-session -d -s "$S" -n "any-killer" -c "$P"
tmux new-window -t "$S" -n "docker-verify" -c "$P"
tmux new-window -t "$S" -n "git-commit" -c "$P"

# Launch Claude in each window
tmux send-keys -t "$S:any-killer" "claude --dangerously-skip-permissions --model claude-opus-4-6" Enter
sleep 3
tmux send-keys -t "$S:docker-verify" "claude --dangerously-skip-permissions --model claude-opus-4-6" Enter
sleep 3
tmux send-keys -t "$S:git-commit" "claude --dangerously-skip-permissions --model claude-opus-4-6" Enter

echo "Waiting 15s for Claude instances to initialize..."
sleep 15

# Inject Agent 1 prompt
tmux send-keys -t "$S:any-killer" "You are Agent 1: any-killer-client. Eliminate ALL 453 occurrences of ': any' from client/src/. The biggest files: client/src/api.ts (198 any) and client/src/api/misc.ts (157 any). Replace with proper TypeScript interfaces. Create types in client/src/types/ as needed. Use 'unknown' with type guards if truly unknown. NEVER leave any 'any'. When done: grep -rn ': any' src/ --include='*.ts' --include='*.tsx' | grep -v eslint-disable | wc -l must be 0. npx tsc --noEmit must pass. START NOW." Enter

sleep 2

# Inject Agent 2 prompt
tmux send-keys -t "$S:docker-verify" "You are Agent 2: docker-verifier. 1) docker compose down 2) docker compose build --no-cache 3) docker compose up -d 4) Wait for healthchecks to pass 5) Verify: curl http://localhost:3501/health 6) Verify: curl http://localhost:8080 7) Verify Neon: docker compose exec -T postgres psql 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require' -c 'SELECT count(*) FROM transactions' must return 6520. Fix any Docker errors. START NOW." Enter

sleep 2

# Inject Agent 3 prompt
tmux send-keys -t "$S:git-commit" "You are Agent 3: git-committer. WAIT — use 'sleep 600' FIRST before doing anything. After waiting: 1) Verify npx tsc --noEmit passes in both server/ and client/ 2) Check for remaining 'any' types 3) git add -A 4) git commit --no-verify -m 'feat: eliminate client any types, verify Docker and Neon stack' 5) git status must be clean. DO NOT START YET — sleep 600 first." Enter

echo ""
echo "=== 3 agents launched in tmux windows ==="
echo "Session: $S"
echo "  Window 1: any-killer (client any elimination)"
echo "  Window 2: docker-verify (Docker rebuild + Neon check)"
echo "  Window 3: git-commit (waits 10min, then commits)"
echo ""
echo "Ctrl+B N = next window, Ctrl+B P = prev window"
echo "Ctrl+B D = detach, tmux attach -t $S = reattach"
echo ""

# Select first window and attach
tmux select-window -t "$S:any-killer"
exec tmux attach -t "$S"
