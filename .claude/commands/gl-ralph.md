---
description: Start a Ralph Loop for iterative self-improving fixes on a specific problem
argument-hint: problem to solve iteratively (e.g. "fix all tsc errors")
allowed-tools: ["Read", "Bash", "Edit", "Write", "TodoWrite"]
---

# GoldLedger Ralph Loop

Problem: $ARGUMENTS

This starts an iterative loop where Claude will:
1. Attempt to fix the problem
2. Run verification (tsc, tests)
3. See its own previous work
4. Improve until done

Invoke the ralph-loop plugin command:
/ralph-loop "$ARGUMENTS — run cd server && npx tsc --noEmit after each change. Stop when 0 errors." --max-iterations 10 --completion-promise "0 errors"
