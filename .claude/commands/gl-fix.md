---
description: Full GoldLedger fix workflow — diagnose, plan, fix, verify, commit
argument-hint: describe the bug or issue to fix
allowed-tools: ["Read", "Edit", "Bash", "Write", "Grep", "Task", "TodoWrite"]
---

# GoldLedger Fix Workflow

You are fixing an issue in the GoldLedger codebase. Follow this exact sequence:

## Phase 1: Diagnose
1. Read the relevant files identified in $ARGUMENTS
2. Run: `cd server && npx tsc --noEmit 2>&1 | head -30` — note any tsc errors
3. Search for the root cause: grep for the error pattern across the codebase
4. Identify the EXACT file and line causing the issue

## Phase 2: Plan
Create a TodoWrite list with specific fix steps.
Present the plan and wait for confirmation before making any changes.

## Phase 3: Fix
- Make the minimal change to fix the root cause
- NEVER use @ts-ignore or as any
- Run `cd server && npx tsc --noEmit` after every file change — must be 0 errors

## Phase 4: Verify
- Run tsc on both server and client: `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit`
- Confirm the original issue is resolved

## Phase 5: Commit
- `git add -A && git commit -m "fix: $ARGUMENTS"`

Issue to fix: $ARGUMENTS
