#!/usr/bin/env bash
#
# Quality Gate Hook — runs when a task is marked complete
# Checks: tsc passes, tests pass, any count within budget
# Exit 0 = allow completion, Exit 2 = reject with feedback
#
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== QUALITY GATE: Verifying task completion ==="

ERRORS=""

# Check 1: TypeScript compilation
echo "[1/4] Running tsc --noEmit (server)..."
if ! cd server && npx tsc --noEmit 2>/dev/null; then
  ERRORS="${ERRORS}\n[FAIL] Server TypeScript compilation failed. Run: cd server && npx tsc --noEmit"
fi
cd "$PROJECT_ROOT"

# Check 2: TypeScript compilation (client)
echo "[2/4] Running tsc --noEmit (client)..."
if ! cd client && npx tsc --noEmit 2>/dev/null; then
  ERRORS="${ERRORS}\n[FAIL] Client TypeScript compilation failed. Run: cd client && npx tsc --noEmit"
fi
cd "$PROJECT_ROOT"

# Check 3: Tests pass
echo "[3/4] Running npm test (server)..."
if ! cd server && npm test 2>/dev/null; then
  ERRORS="${ERRORS}\n[FAIL] Server tests failed. Run: cd server && npm test"
fi
cd "$PROJECT_ROOT"

# Check 4: any count check
echo "[4/4] Checking any count..."
SERVER_ANY=$(grep -r ": any" server/src/ --include="*.ts" 2>/dev/null | wc -l)
if [ "$SERVER_ANY" -gt 1000 ]; then
  ERRORS="${ERRORS}\n[WARN] Server 'any' count: $SERVER_ANY (target: <100, current baseline: 917)"
fi

if [ -n "$ERRORS" ]; then
  echo ""
  echo "=== QUALITY GATE: ISSUES FOUND ==="
  echo -e "$ERRORS"
  echo ""
  echo "Fix these issues before marking the task complete."
  exit 2
fi

echo ""
echo "=== QUALITY GATE: ALL CHECKS PASSED ==="
exit 0
