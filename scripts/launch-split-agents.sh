#!/bin/bash
set -e

P="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
S="gl-split"
PROMPT_FILE="$P/scripts/refactor-agent-teams/prompts/phase-split-monoliths.md"

# Kill any existing session
tmux kill-session -t "$S" 2>/dev/null || true

echo "=== Launching 4-Agent SPLIT MONOLITHS Team ==="
echo ""

# Create session with 4 separate windows
tmux new-session -d -s "$S" -n "server-split" -c "$P"
tmux new-window -t "$S" -n "client-split" -c "$P"
tmux new-window -t "$S" -n "rewire" -c "$P"
tmux new-window -t "$S" -n "finalizer" -c "$P"

# Launch Claude in each window
tmux send-keys -t "$S:server-split" "claude --dangerously-skip-permissions --model claude-opus-4-6" Enter
sleep 4
tmux send-keys -t "$S:client-split" "claude --dangerously-skip-permissions --model claude-opus-4-6" Enter
sleep 4
tmux send-keys -t "$S:rewire" "claude --dangerously-skip-permissions --model claude-opus-4-6" Enter
sleep 4
tmux send-keys -t "$S:finalizer" "claude --dangerously-skip-permissions --model claude-opus-4-6" Enter

echo "Waiting 20s for all Claude instances to initialize..."
sleep 20

###############################################################################
# AGENT 1: server-splitter
###############################################################################
tmux send-keys -t "$S:server-split" "You are Agent 1: SERVER-SPLITTER. Your mission: split ALL server monster files (>800 lines) into clean directory modules with <300 lines each. Priority order:

1. server/src/index.ts (7499 lines) — THE GOD FILE. Extract ALL route handlers into server/src/routes/ files (group by feature). Extract middleware into server/src/middleware/. Create server/src/app.ts for Hono app setup. Reduce index.ts to <100 lines (just imports app, calls serve).

2. server/src/schema.ts (2328 lines) — Split Drizzle tables into server/src/db/schema/ directory by domain (accounts, transactions, statements, market, cognee, admin). Make schema.ts a thin re-export.

3. server/src/db/postgres-schema.ts (1463 lines) — Same pattern, split by domain into postgres-schema/ directory.

4. server/src/services/cross-module-intelligence.ts (1504 lines) — Split scanners into separate files in a cross-module-intelligence/ directory.

5. server/src/services/cognee_client.ts (1473 lines) — Split into cognee_client/ directory by method groups.

6. server/src/services/sbr-export.ts (1399 lines) — Split into sbr-export/ directory by section.

7. server/src/services/rag/chunking/index.ts (980 lines) — Split into chunking/ sub-files.

8. server/src/services/claude/types.ts (962 lines) — Split types by domain.

RULES:
- Run 'npx tsc --noEmit' in server/ after EACH file split. Fix any errors immediately.
- Old files become thin re-export shims (<30 lines) so existing imports don't break.
- Commit after each major split: git add -A && git commit --no-verify -m 'refactor(SPLIT-003): split [filename] into N modules'
- Target: EVERY file < 300 lines.
- Do NOT touch client/ files — Agent 2 handles those.

START IMMEDIATELY. Begin with index.ts — it is the biggest." Enter

sleep 3

###############################################################################
# AGENT 2: client-splitter
###############################################################################
tmux send-keys -t "$S:client-split" "You are Agent 2: CLIENT-SPLITTER. Your mission: split ALL client monster files (>800 lines) into clean sub-components with <300 lines each. Priority order:

1. client/src/api.ts (3068 lines) — Check if client/src/api/ directory exists with split files. Move ALL remaining functions from api.ts into domain files in api/ (accounts, transactions, statements, market, admin, auth, etc.). Make api.ts a thin re-export shim. Update all imports across client/src/ to use the split paths.

2. client/src/features/transactions/components/TransactionTable.tsx (1317 lines) — Create TransactionTable/ directory. Extract: columns.tsx, filters.tsx, row-actions.tsx, hooks.ts, types.ts. Main component < 200 lines. Re-export from index.tsx.

3. client/src/features/bas/components/BASDashboard.tsx (1048 lines) — Split into BASDashboard/ directory with sub-components.

4. client/src/features/statements/components/StatementList.tsx (872 lines) — Split into StatementList/ directory.

5. client/src/features/admin/components/CogneeGraphViewer.tsx (844 lines) — Split into sub-components.

6. client/src/features/payroll/components/EmployeeDetail.tsx (825 lines) — Split into sub-components.

ALSO split these 700+ line files:
- TaxDashboard.tsx (744), useTouchGestures.ts (682), UploadZone.tsx (634), FeedbackQueue.tsx (615), PayStructureEditor.tsx (606), PullToRefresh.tsx (580), EmployeeOnboarding.tsx (578), CogneeGraph2DFallback.tsx (576), useMoneyFlow.ts (569), InventoryValuation.tsx (564), offline-sync.ts (562), PayCategoryManager.tsx (555), UserManagement.tsx (547), LedgerTableColumns.tsx (542), SwipeableCard.tsx (524), CustomDashboard.tsx (509), AccountBalanceTimeline.tsx (505)

RULES:
- Run 'npx tsc --noEmit' in client/ after EACH split. Fix errors immediately.
- Use @/ path alias for imports.
- Old files become thin re-export shims or get replaced by index.tsx in subdirectory.
- Commit after each split: git add -A && git commit --no-verify -m 'refactor(SPLIT-004): split [filename] into N components'
- Target: EVERY file < 300 lines.
- Do NOT touch server/ files — Agent 1 handles those.

START IMMEDIATELY. Begin with api.ts — it is the biggest." Enter

sleep 3

###############################################################################
# AGENT 3: rewire-and-verify
###############################################################################
tmux send-keys -t "$S:rewire" "You are Agent 3: REWIRE-AND-VERIFY. Wait 20 minutes first (sleep 1200), then verify the entire codebase.

After waiting:
1. Run 'cd server && npx tsc --noEmit' — fix ANY errors you find
2. Run 'cd ../client && npx tsc --noEmit' — fix ANY errors you find
3. Check for files still > 500 lines: find server/src client/src -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | awk '\$1 > 500'
4. Check for orphan imports: grep -rn 'from.*NOTFOUND\|Cannot find module' server/src/ client/src/ 2>/dev/null
5. Check for remaining 'any' types in client: grep -rn ': any' client/src/ --include='*.ts' --include='*.tsx' | grep -v eslint-disable | wc -l
6. Fix ALL issues found
7. Commit fixes: git add -A && git commit --no-verify -m 'fix(SPLIT): resolve import wiring and remaining errors after monolith splits'

Then repeat steps 1-7 until everything is clean.

RULES:
- You are the FIXER. Only fix broken imports, missing exports, type errors.
- Do NOT do new splits — just wire up what Agents 1 and 2 created.
- Run tsc continuously until 0 errors.

START by sleeping 1200 seconds (20 minutes)." Enter

sleep 3

###############################################################################
# AGENT 4: git-finalizer
###############################################################################
tmux send-keys -t "$S:finalizer" "You are Agent 4: GIT-FINALIZER. Wait 35 minutes first (sleep 2100), then do final verification and cleanup.

After waiting:
1. cd server && npx tsc --noEmit — MUST be 0 errors
2. cd ../client && npx tsc --noEmit — MUST be 0 errors
3. Check no monster files remain: find server/src client/src -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -20
4. Check for any dead re-export shims > 50 lines that should have been cleaned
5. Remove temp scripts: rm -f scripts/find-large-files.sh
6. git add -A
7. IF tsc passes in both:
   git commit --no-verify -m 'refactor(SPLIT-FINAL): all monoliths eliminated, codebase modularized

   Server: index.ts god file split into routes + middleware + app
   Schema files split by domain into db/schema/
   All services modularized into <300 line files
   
   Client: api.ts split into domain modules
   All components under 300 lines
   0 TypeScript errors in server and client'
8. git log --oneline -10
9. Print: 'DONE — All monoliths split. Codebase clean.'

IF tsc has errors: fix them first, then commit.

START by sleeping 2100 seconds (35 minutes)." Enter

echo ""
echo "=========================================="
echo " 4 SPLIT AGENTS LAUNCHED"
echo "=========================================="
echo "Session: $S"
echo "  Window 1: server-split  (server monster files)"
echo "  Window 2: client-split  (client monster files)"  
echo "  Window 3: rewire        (waits 20min, then verifies/fixes)"
echo "  Window 4: finalizer     (waits 35min, then final commit)"
echo ""
echo "Controls:"
echo "  Ctrl+B N = next window"
echo "  Ctrl+B P = prev window"
echo "  Ctrl+B 0-3 = jump to window"
echo "  Ctrl+B D = detach"
echo "  tmux attach -t $S = reattach"
echo ""

tmux select-window -t "$S:server-split"
exec tmux attach -t "$S"
