# GoldLedger Refactoring — Agent Team Prompts (Updated)
# ══════════════════════════════════════════════════════════════════════════════
#
# STATUS:
#   REFACTOR-001 through 015 → DONE but need QA perfection review
#   REFACTOR-016 through 060 → NOT STARTED
#
# EXECUTION ORDER:
#   QA-A  → QA 001-005 (3 agents, Opus)
#   QA-B  → QA 006-010 (3 agents, Opus)
#   QA-C  → QA 011-015 (3 agents, Opus)
#   Fix   → Fix anything QA rejected (2-3 agents, Opus)
#   Exec waves → 016+ in batches of 3 tasks
#   QA rounds → After each exec wave
#
# PREREQUISITES:
#   1. Run setup-worktrees.sh to create git worktrees
#   2. Copy CLAUDE.md to project root
#   3. export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
#   4. export CLAUDE_CODE_SPAWN_BACKEND=tmux
#
# ══════════════════════════════════════════════════════════════════════════════


# ──────────────────────────────────────────────────────────────────────────────
# QA-A: PERFECTION REVIEW OF REFACTOR-001 THROUGH 005
# ──────────────────────────────────────────────────────────────────────────────
# Agents: 3 Opus 4.6 (maximum intelligence for perfection review)
# Time: ~15 min
# ──────────────────────────────────────────────────────────────────────────────

You are leading a QA perfection review team for the GoldLedger refactoring project. REFACTOR-001 through 005 have been implemented but need thorough quality review before we can build on top of them. These early tasks are the foundation of the entire dependency chain — if they're not perfect, everything downstream breaks.

Before spawning teammates, read these files yourself:
- agent-team/task-tracker.md (current status)
- docs/REFACTORING_TASKS_DETAILED.md (the full task specifications)

Run git log --oneline -40 and git branch -a to understand what branches exist and where the work was committed. The work may be on standard refactor/ branches, non-standard branches, or committed directly to main.

Use delegate mode — coordinate only, do not review code yourself.

Spawn three reviewers, all using Opus:

1. "qa-structure" using Opus — Review REFACTOR-001, 002, 003, 004, and 005 for structural correctness. For each task: read its full specification in docs/REFACTORING_TASKS_DETAILED.md, then verify that every single step was actually done. Check that file splits landed in the correct locations, that every import path resolves, that no code was lost or duplicated during splits, and that the original functionality is fully preserved. Check for any orphaned imports, missing re-exports, or broken barrel files. If any task created new files, verify they exist and have the right content. Message me with a detailed PASS or FAIL verdict per task — for any failure list the exact file, line, and what's wrong.

2. "qa-types-lint" using Opus — Review REFACTOR-001, 002, 003, 004, and 005 for type safety and lint compliance. For each task: run npx tsc --noEmit and capture every error. Run npx eslint . --config eslint.config.mjs, then cd server && npx eslint . --config eslint.config.js && cd .., then cd client && npx eslint . --config eslint.config.js && cd .. — capture every warning and error. Check for any implicit any, ts-ignore, ts-expect-error, or type assertions that paper over real issues. Check that no new any types were introduced. Message me with PASS or FAIL per task — for failures, list every tsc error and eslint violation with file and line number.

3. "qa-standards" using Opus — Review REFACTOR-001, 002, 003, 004, and 005 for enterprise standards compliance. For each task: run wc -l on every file that was created or modified — every single one must be 300 lines or fewer, no exceptions. Run npm test and report any test failures. Check that commit messages follow the format refactor(REFACTOR-XXX): description. Check for dead code — unused functions, commented-out blocks, unreachable branches. Check that no debug logging (console.log with debug intent) was left in. Message me with PASS or FAIL per task — for failures, list every violation.

After all three reviewers report back, compile their findings into a single report. For each task 001-005, it passes ONLY if all three reviewers gave it PASS. Write the consolidated results to agent-team/qa-001-005-results.md with this format per task:

```
## REFACTOR-XXX: [PASS/FAIL]
### Structure: [PASS/FAIL]
- [findings]
### Types & Lint: [PASS/FAIL]  
- [findings]
### Standards: [PASS/FAIL]
- [findings]
### Action Required: [none / list of fixes needed]
```

Update agent-team/task-tracker.md: mark passing tasks [x], mark failing tasks [!] with a summary of what needs fixing.


# ──────────────────────────────────────────────────────────────────────────────
# QA-B: PERFECTION REVIEW OF REFACTOR-006 THROUGH 010
# ──────────────────────────────────────────────────────────────────────────────
# Agents: 3 Opus
# Time: ~15 min
# Prereq: QA-A complete (so we know if foundation tasks passed)
# ──────────────────────────────────────────────────────────────────────────────

You are leading a QA perfection review team for the GoldLedger refactoring project. REFACTOR-006 through 010 have been implemented but need thorough quality review.

Before spawning teammates, read:
- agent-team/task-tracker.md (current status — 001-005 should now be [x] or [!])
- agent-team/qa-001-005-results.md (results from previous QA round)
- docs/REFACTORING_TASKS_DETAILED.md (task specifications)

If any of REFACTOR-001 through 005 failed QA (marked [!]), note this — tasks 006-010 may depend on them and any issues may cascade. Still review 006-010 on their own merits but flag if a failure could be caused by an upstream issue.

Run git log --oneline -40 and git branch -a to locate the work.

Use delegate mode.

Spawn three reviewers, all using Opus:

1. "qa-structure" using Opus — Review REFACTOR-006, 007, 008, 009, and 010 for structural correctness. Same standard as before: read each task spec in docs/REFACTORING_TASKS_DETAILED.md, verify every step was done, check file splits, import paths, no lost or duplicated code, no orphaned imports, all re-exports intact. Message me with detailed PASS or FAIL per task.

2. "qa-types-lint" using Opus — Review REFACTOR-006, 007, 008, 009, and 010 for type safety and lint compliance. Run npx tsc --noEmit, eslint with all 3 configs. Check for implicit any, ts-ignore, type assertion hacks. Message me PASS or FAIL per task with every error listed.

3. "qa-standards" using Opus — Review REFACTOR-006, 007, 008, 009, and 010 for enterprise standards. wc -l on all modified files (≤300), npm test, commit message format, dead code check, no debug logging. Message me PASS or FAIL per task.

After all report, write consolidated results to agent-team/qa-006-010-results.md (same format as QA-A). Update task-tracker.md accordingly.


# ──────────────────────────────────────────────────────────────────────────────
# QA-C: PERFECTION REVIEW OF REFACTOR-011 THROUGH 015
# ──────────────────────────────────────────────────────────────────────────────
# Agents: 3 Opus
# Time: ~15 min
# Prereq: QA-B complete
# ──────────────────────────────────────────────────────────────────────────────

You are leading a QA perfection review team for the GoldLedger refactoring project. REFACTOR-011 through 015 have been implemented but need thorough quality review.

Before spawning teammates, read:
- agent-team/task-tracker.md (current status — 001-010 should now be reviewed)
- agent-team/qa-001-005-results.md and agent-team/qa-006-010-results.md
- docs/REFACTORING_TASKS_DETAILED.md (task specifications)

Note any upstream failures from 001-010 that might cascade into 011-015. REFACTOR-011 depends on earlier tasks in the critical path (001→002→003→011), so if 001-003 have issues, flag whether 011-015 problems are their own or inherited.

Run git log --oneline -40 and git branch -a to locate the work.

Use delegate mode.

Spawn three reviewers, all using Opus:

1. "qa-structure" using Opus — Review REFACTOR-011, 012, 013, 014, and 015 for structural correctness. Read each task spec, verify every step, check file splits, imports, no lost code, re-exports intact. These are critical path tasks (011→012→013/014→015) so pay extra attention to how they chain together — the output of 011 feeds into 012 which feeds into 013/014. Message me detailed PASS or FAIL per task.

2. "qa-types-lint" using Opus — Review REFACTOR-011, 012, 013, 014, and 015 for type safety and lint. Run tsc --noEmit, eslint x3 configs. Check for any, ts-ignore, type hacks. Message me PASS or FAIL per task with all errors.

3. "qa-standards" using Opus — Review REFACTOR-011, 012, 013, 014, and 015 for enterprise standards. wc -l ≤300 on all files, npm test, commit messages, dead code, no debug logging. Message me PASS or FAIL per task.

After all report, write results to agent-team/qa-011-015-results.md. Update task-tracker.md. Then create a consolidated agent-team/QA_SUMMARY_001-015.md that lists:
- Total tasks reviewed: 15
- Passed: [count]
- Failed: [count]  
- List of all failures with what needs fixing
- Recommendation: ready to proceed to execution of 016+ or fixes needed first


# ──────────────────────────────────────────────────────────────────────────────
# FIX WAVE: REPAIR ANY QA REJECTIONS FROM 001-015
# ──────────────────────────────────────────────────────────────────────────────
# Agents: 3 Opus (implementation)
# Time: ~20 min
# Only run this if QA-A/B/C found failures
# Skip if all 15 tasks passed
# ──────────────────────────────────────────────────────────────────────────────

You are leading a fix team for the GoldLedger refactoring project. The QA review of REFACTOR-001 through 015 found issues that need fixing before we can proceed.

Read these files first:
- agent-team/QA_SUMMARY_001-015.md (consolidated QA findings)
- agent-team/qa-001-005-results.md
- agent-team/qa-006-010-results.md
- agent-team/qa-011-015-results.md
- agent-team/task-tracker.md (tasks marked [!] need fixing)
- docs/REFACTORING_TASKS_DETAILED.md (original task specs)

Identify all [!] tasks. Group them by complexity and assign to agents. Each agent works in their own git worktree:
- Agent 1: /mnt/c/Users/Danie/Desktop/goldledger-worktrees/agent-1
- Agent 2: /mnt/c/Users/Danie/Desktop/goldledger-worktrees/agent-2
- Agent 3: /mnt/c/Users/Danie/Desktop/goldledger-worktrees/agent-3

Use delegate mode.

Spawn up to three fixers using Opus (only spawn as many as there are [!] tasks — if only 2 tasks failed, spawn 2 agents):

1. "fixer-1" using Opus — Work in worktree agent-1. First cd there and run git checkout main && git pull. For each assigned [!] task: checkout the existing branch (or create one if the work was on main), read the QA failure notes from the qa results files, read the original task spec, and fix every issue listed. Then run ALL verification: npx tsc --noEmit, eslint x3 configs, npm test, wc -l ≤300 on every file touched. Every verification must pass. Commit fixes with message: fix(REFACTOR-XXX): address QA findings. Message me when done with results per task.

2. "fixer-2" using Opus — Same pattern, worktree agent-2, different [!] tasks.

3. "fixer-3" using Opus — Same pattern, worktree agent-3, different [!] tasks. Only spawn if 3+ tasks need fixing.

[IMPORTANT: Tell each fixer exactly which REFACTOR-XXX tasks to fix based on the QA results.]

After all fixers report, update task-tracker.md: fixed tasks go to [R] for re-review (or [x] if you're confident the fixes are complete and verification passed). Write results to agent-team/fix-wave-results.md.


# ──────────────────────────────────────────────────────────────────────────────
# EXEC WAVE 1: START REFACTOR-016+
# ──────────────────────────────────────────────────────────────────────────────
# Agents: 3 Opus
# Time: ~20 min
# Prereq: ALL of 001-015 are [x] (passed QA or fixes verified)
# ──────────────────────────────────────────────────────────────────────────────

You are leading an execution team for the GoldLedger refactoring project. REFACTOR-001 through 015 are complete and verified. Now we execute the remaining tasks starting from REFACTOR-016.

Before spawning, read:
- agent-team/task-tracker.md (find tasks with [ ] status whose deps are all [x])
- docs/REFACTORING_TASKS_DETAILED.md (task specifications)

Find the 3 highest-priority available tasks. Priority order:
1. Tasks on the critical path: 016 → 019 → 023 → 031 → 032-040 → 041
2. P0 Critical in earliest wave
3. P1 High tasks that unblock the most downstream work
4. P2 Medium tasks

Pick 3 tasks that don't modify the same files as each other.

Each agent works in their own git worktree:
- Agent 1: /mnt/c/Users/Danie/Desktop/goldledger-worktrees/agent-1
- Agent 2: /mnt/c/Users/Danie/Desktop/goldledger-worktrees/agent-2
- Agent 3: /mnt/c/Users/Danie/Desktop/goldledger-worktrees/agent-3

Use delegate mode.

Spawn three workers using Opus:

1. "exec-1" using Opus — Work in worktree agent-1. cd there, run git checkout main && git pull to start clean. Create branch: git checkout -b refactor/REFACTOR-XXX-short-name. Read the full task spec for your assigned task from /mnt/c/Users/Danie/Desktop/CBA Statements Parse/docs/REFACTORING_TASKS_DETAILED.md. Follow every step exactly. After all changes, run verification: npx tsc --noEmit, npx eslint . --config eslint.config.mjs, cd server && npx eslint . --config eslint.config.js && cd .., cd client && npx eslint . --config eslint.config.js && cd .., npm test, wc -l on every new/modified file (must be ≤300). All must pass. Commit: refactor(REFACTOR-XXX): description. Message me with PASS or ISSUES (list failures).

[Tell exec-1 which specific REFACTOR-XXX to work on]

2. "exec-2" using Opus — Same instructions, worktree agent-2, different task.

[Tell exec-2 which specific REFACTOR-XXX to work on]

3. "exec-3" using Opus — Same instructions, worktree agent-3, different task.

[Tell exec-3 which specific REFACTOR-XXX to work on]

After all three report, update task-tracker.md:
- Completed tasks: [ ] → [R], write agent name and branch name
- Tasks with issues: [ ] → [!], note the issues
Write wave summary to agent-team/exec-wave1-results.md.


# ──────────────────────────────────────────────────────────────────────────────
# QA ROUND (for any exec wave)
# ──────────────────────────────────────────────────────────────────────────────
# Agents: 2 Opus
# Time: ~10 min
# Run after each exec wave
# ──────────────────────────────────────────────────────────────────────────────

You are leading a QA review for the GoldLedger refactoring project. The previous execution wave is complete and needs review.

Read:
- agent-team/task-tracker.md (find [R] tasks from the last exec wave)
- agent-team/exec-waveN-results.md (the exec wave summary — replace N with wave number)
- docs/REFACTORING_TASKS_DETAILED.md (task specs)

The exec agents worked in worktrees:
- Agent 1: /mnt/c/Users/Danie/Desktop/goldledger-worktrees/agent-1
- Agent 2: /mnt/c/Users/Danie/Desktop/goldledger-worktrees/agent-2
- Agent 3: /mnt/c/Users/Danie/Desktop/goldledger-worktrees/agent-3

Use delegate mode.

Spawn two reviewers using Opus:

1. "qa-code" using Opus — For each [R] task: cd to the correct worktree, git checkout the task branch, read the task spec, verify every step was done. Check file splits, imports, no lost code, types correct, no implicit any, re-exports intact. Run npx tsc --noEmit for type checking. Message me PASS or FAIL per task with specifics.

2. "qa-verify" using Opus — For each [R] task: cd to the correct worktree, git checkout the task branch, run ALL verification commands: every step in the task spec, plus tsc --noEmit, eslint x3 configs, npm test, wc -l ≤300 on all modified files. Check commit messages follow format. Check for dead code and debug logging. Message me PASS or FAIL per task.

Both must agree to pass. After both report:
- Both PASS → update tracker [R] to [x]
- Either FAIL → update tracker [R] to [!] with failure notes
Write results to agent-team/qa-roundN-results.md (replace N with round number).


# ──────────────────────────────────────────────────────────────────────────────
# SUBSEQUENT EXEC WAVES (Template)
# ──────────────────────────────────────────────────────────────────────────────
# Copy the EXEC WAVE 1 prompt above.
# Before pasting, update:
#   - Wave number in results filename
#   - The lead will auto-detect which tasks are available from the tracker
#
# BETWEEN WAVES (do this manually):
#   1. Merge approved branches: git merge refactor/REFACTOR-XXX
#   2. Reset worktrees: cd agent-N && git checkout main && git pull
#   3. Verify task-tracker.md is accurate
#   4. Paste next wave prompt
# ──────────────────────────────────────────────────────────────────────────────


# ══════════════════════════════════════════════════════════════════════════════
# FULL EXECUTION PLAN
# ══════════════════════════════════════════════════════════════════════════════
#
# Phase 1: QA the existing work (001-015)
#   QA-A   → Review 001-005  (~15 min, 3× Opus)
#   QA-B   → Review 006-010  (~15 min, 3× Opus)
#   QA-C   → Review 011-015  (~15 min, 3× Opus)
#   Fix    → Repair failures  (~20 min, up to 3× Opus, skip if all pass)
#
# Phase 2: Execute remaining tasks (016-060)
#   ~15 exec waves × 3 tasks each = ~45 tasks
#   ~15 QA rounds
#   Each exec wave: ~20 min, 3× Opus
#   Each QA round: ~10 min, 2× Opus
#
# Total estimate:
#   Phase 1: ~1-1.5 hours
#   Phase 2: ~7-8 hours across multiple sessions
#
# Between sessions:
#   - Merge approved branches into main
#   - Reset worktrees
#   - Note where you left off in the task tracker
#
# ══════════════════════════════════════════════════════════════════════════════
