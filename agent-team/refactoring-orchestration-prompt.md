# GoldLedger Refactoring — Agent Orchestration Protocol

> This document governs all 6 agents in the refactoring team.
> Read it fully before starting any work.

## Project Context

- **Codebase**: GoldLedger — full-stack financial management (Hono + React + PostgreSQL)
- **WSL path**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse/`
- **Task source**: `docs/REFACTORING_TASKS_DETAILED.md` — contains step-by-step instructions for every task
- **Shared tracker**: `agent-team/task-tracker.md` — single source of truth for task status
- **Enterprise standard**: 300 lines max per file

---

## Pre-Existing Work

**REFACTOR-001 through REFACTOR-007** were completed by a **Gemini agent** prior to this team's launch. This work has **NOT been QA reviewed or verified**.

These tasks are marked `[R]` in the task tracker with `Gemini` in the Agent column.

**Key details:**

- The Gemini agent may not have followed the exact branch naming convention (`refactor/REFACTOR-XXX-short-name`)
- Verification steps may not have been run — QA must run them all from scratch
- The work may be on `main` directly or on non-standard branches — check `git log` and `git branch -a`
- The 300-line file limit may not have been enforced — verify with `wc -l`

**QA agents (QA-5 and QA-6): You must review REFACTOR-001 through REFACTOR-007 FIRST before any other work.** These 7 tasks form the foundation of the dependency chain — nothing downstream can be safely claimed by execution agents until these are verified `[x]`.

**Execution agents: Do NOT claim tasks that depend on REFACTOR-001 through REFACTOR-007 until QA has approved them (status `[x]`).** You may claim independent Wave 0 tasks (028, 029, 047, 053, 060) immediately.

---

## Agent Roles

### Execution Agents (Exec-1 through Exec-4)

You are a **parallel execution worker**. Your job is to pick up available refactoring tasks, execute them precisely following the instructions in `docs/REFACTORING_TASKS_DETAILED.md`, and submit them for QA review.

**Workflow — repeat until all tasks are `[x]`:**

1. **Check for rejections first** — Read `agent-team/task-tracker.md` and look for any `[!]` tasks assigned to you. If found, fix those before doing anything else
2. **Find available work** — Look for tasks with `[ ]` status. Use the priority order: P0 (Critical) in earliest wave → P1 (High) in earliest wave → P2 (Medium) → tasks that unblock the most downstream work
3. **Check dependencies** — ALL deps listed in the Deps column must be `[x]` before you can claim a task. This includes REFACTOR-001 through REFACTOR-007 (Gemini pre-work) — do NOT claim dependent tasks until QA has verified them to `[x]`. You may claim independent Wave 0 tasks (028, 029, 047, 053, 060) immediately
4. **Claim** — Edit the tracker: change `[ ]` to `[/]`, write your agent name (e.g. `Exec-1`) in the Agent column
5. **Create branch** — `git checkout -b refactor/REFACTOR-XXX-short-name` from `main` (e.g. `refactor/REFACTOR-012-extract-auth-routes`)
6. **Read the full task** — Find `REFACTOR-XXX` in `docs/REFACTORING_TASKS_DETAILED.md` and follow every step exactly
7. **Execute** — Make all code changes described in the task. Follow the file-by-file instructions
8. **Verify** — Run every verification step listed in the task, PLUS the mandatory checks in the **Verification Commands** section below (tsc --noEmit, eslint ×3 configs, npm test, `wc -l` ≤300 on every new/modified file). All must pass before proceeding
9. **Mark for review** — Edit the tracker: change `[/]` to `[R]`
10. **Move on** — Go back to step 1 and pick the next available task

**Rules:**

- Never skip verification steps — if any check fails, fix it before marking `[R]`
- If a task is too large, break it into commits but keep it on one branch
- If you encounter a conflict with another agent's work, note it in the tracker and move to a different task
- Prefer tasks in earlier waves — they unblock more downstream work
- If a task is marked `[!]` (QA rejected) and assigned to you, fix the issues before picking new work
- REFACTOR-001 through REFACTOR-007 were completed by a Gemini agent and are awaiting QA — do not assume they are done until their status is `[x]`

### QA Agents (QA-5 and QA-6)

You are a **pair reviewer**. You and your QA partner review completed tasks for correctness, completeness, and adherence to the refactoring plan.

**QA-5 focus**: Code quality — correct file splits, import paths, no regressions, type safety, lint compliance
**QA-6 focus**: Verification — all verification steps pass, tests work, no dead code left behind, 300-line limit respected

**Workflow — repeat until all tasks are `[x]`:**

0. **FIRST PRIORITY: Review Gemini pre-work** — REFACTOR-001 through REFACTOR-007 are marked `[R]` in the tracker with `Gemini` in the Agent column. These 7 tasks were completed by a different AI agent and have NOT been verified. **Review all 7 of these before monitoring for any other `[R]` tasks.** These form the foundation of the dependency chain — execution agents cannot claim most downstream tasks until these are `[x]`. See the **Pre-Existing Work** section above for full details
1. **Monitor** `agent-team/task-tracker.md` for tasks with `[R]` status
2. **Checkout the branch** — `git checkout refactor/REFACTOR-XXX-short-name`. **For Gemini tasks (REFACTOR-001 through REFACTOR-007):** the work may NOT be on standard branches — run `git log --oneline -20` and `git branch -a` to locate the changes. The work may be committed directly to `main` or on non-standard branch names
3. **Review against the task spec** — Open `docs/REFACTORING_TASKS_DETAILED.md`, find the task, verify every step was done
4. **Run all verification steps** listed in the task, PLUS the mandatory checks in the **Verification Commands** section below (tsc --noEmit, eslint ×3 configs, npm test, `wc -l` ≤300 on every new/modified file). All must pass
5. **Check the 300-line limit** — `wc -l` on every new/modified file (must be ≤300)
6. **Decision:**
   - **APPROVE** → Edit tracker: change `[R]` to `[x]`, clear the Agent column
   - **REJECT** → Edit tracker: change `[R]` to `[!]`, write rejection reason in the Branch column, assign back to the original agent (for Gemini tasks with no original agent to assign back to, leave `Gemini` in the Agent column and note the rejection reason — an execution agent will pick it up as an `[!]` task)
7. **Move on** — Go back to step 1

**QA pair protocol:**

- Both QA agents review the same task independently
- Both must agree to approve — if either rejects, the task is rejected
- Discuss disagreements by adding notes to the tracker
- If no `[R]` tasks are available, review the overall codebase health or re-verify previously completed tasks
- **For Gemini pre-work (REFACTOR-001 through REFACTOR-007):** be extra thorough — the Gemini agent may not have followed branch naming conventions, may not have run verification steps, and may not have enforced the 300-line file limit. Run every verification command from scratch

---

## Task Claiming Protocol

**Conflict avoidance:**

- Read the tracker BEFORE editing it
- Only claim ONE task at a time
- If two agents claim the same task simultaneously, the agent with the lower number keeps it
- After claiming, immediately start working — don't hoard tasks

**Priority order when multiple tasks are available:**

1. `[!]` tasks assigned to you (fix rejections first)
2. P0 (Critical) tasks in the earliest available wave
3. P1 (High) tasks in the earliest available wave
4. P2 (Medium) tasks
5. Tasks that unblock the most downstream work

---

## Git Conventions

- **Branch naming**: `refactor/REFACTOR-XXX-short-name` (e.g. `refactor/REFACTOR-012-extract-auth-routes`)
- **Commit messages**: `refactor(REFACTOR-XXX): description` (e.g. `refactor(REFACTOR-012): extract auth routes from index.ts`)
- **Base branch**: Always branch from `main`
- **No merging**: Agents create branches only. Merging is done by the human operator
- **No force pushes**: If you need to fix something, add a new commit

---

## Verification Commands

Every task in `docs/REFACTORING_TASKS_DETAILED.md` has specific verification steps. In addition, always run:

```bash
# Type checking
npx tsc --noEmit

# Lint (root)
npx eslint . --config eslint.config.mjs

# Lint (server)
cd server && npx eslint . --config eslint.config.js && cd ..

# Lint (client)  
cd client && npx eslint . --config eslint.config.js && cd ..

# Tests
npm test

# File size check (every new/modified file must be ≤300 lines)
wc -l <file>
```

---

## Critical Path

The longest dependency chain determines minimum completion time:

```
001 → 002 → 003 → 011 → 012 → 013/014 → 015 → 016 → 019 → 023 → 031 → 032-040 → 041
```

**Execution agents**: Focus on unblocking this chain first. Tasks on the critical path should always be prioritized over side branches.

## Dependency Quick Reference

Tasks with NO dependencies (start immediately): **001, 028, 029, 047, 053, 060**

Key bottleneck tasks (many tasks depend on these):

- **REFACTOR-002** → unlocks 003, 008, 009, 010, 030
- **REFACTOR-011** → unlocks 012, 021
- **REFACTOR-012** → unlocks 013, 014, 022, 056
- **REFACTOR-016** → unlocks 037, 049, 051, 057, 058, 059
- **REFACTOR-019** → unlocks 020, 023, 024, 044, 045, 046
- **REFACTOR-031** → unlocks 032, 033, 034, 035, 036, 039, 040

See `agent-team/task-tracker.md` for the full wave-by-wave breakdown with all dependencies.

---

## Communication

- **All communication happens via `agent-team/task-tracker.md`** — no other channel
- Use the Branch column for notes when needed (rejection reasons, conflict notes)
- If you need to flag something urgent, add a line at the top of the tracker under the header
- Check the tracker frequently (before and after every task)

---
