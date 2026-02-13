# Agent 04: Fixer & Committer

## Role
Read all 3 validation reports, fix compilation/build errors, and commit everything to git. **DO NOT modify user data or database contents.**

## Phase: 4 (After ALL other agents complete)

## Prerequisites
Wait for `.agent-done-WV-01`, `.agent-done-WV-02`, `.agent-done-WV-03`
Read ALL reports from `wave-validation-reports/`

## Tasks

### 1. Prioritize Fixes
- [ ] Read `01-dependency-audit.md` — list of broken references
- [ ] Read `02-build-validation.md` — list of compilation errors
- [ ] Read `03-docker-data-integrity.md` — Docker and data status
- [ ] Create fix priority list: CRITICAL first, then WARNING, skip INFO

### 2. Fix Compilation Errors (Server)
- [ ] Fix missing imports — add stubs or remove dead imports
- [ ] Fix type errors — add proper types or `as unknown as X` for temporary fixes
- [ ] Fix missing module references — create stub files if needed
- [ ] After each batch of fixes: run `cd server && npx tsc --noEmit` to verify progress
- [ ] **Goal**: `tsc --noEmit` passes with 0 errors

### 3. Fix Compilation Errors (Client)
- [ ] Fix missing component imports — remove or stub
- [ ] Fix type errors in components
- [ ] Fix missing API function references
- [ ] After each batch: run `cd client && npx tsc --noEmit`
- [ ] Then: run `cd client && npm run build` — must succeed
- [ ] **Goal**: `npm run build` succeeds

### 4. Fix Migration Issues (if any)
- [ ] Fix SQL syntax errors in migration files
- [ ] Fix migration ordering gaps
- [ ] **DO NOT** drop or alter existing tables with data
- [ ] Only add missing CREATE TABLE IF NOT EXISTS statements

### 5. Verify Data Integrity Post-Fix
- [ ] Re-run the same queries from Agent 03's report
- [ ] Compare counts: transactions, accounts, users, statements
- [ ] **ALL counts must match pre-fix numbers exactly**
- [ ] If any count differs: REVERT changes and report

### 6. Git Commit
- [ ] `git add -A`
- [ ] `git commit -m "Wave V: Pre-execution validation — fix compilation errors for Waves 11-23"`
- [ ] Document what was fixed in the commit message body
- [ ] **DO NOT push** — let user review first

### 7. Final Verification Report
Write to `wave-validation-reports/04-fix-summary.md`:
- Total errors found vs fixed
- Remaining issues that need manual attention
- Data integrity: VERIFIED / COMPROMISED
- Build status: server tsc ✅/❌, client build ✅/❌
- List of Wave 1-10 features that MUST be implemented before those features work

## SAFETY RULES
1. **NEVER** run DROP TABLE, DELETE FROM, or TRUNCATE
2. **NEVER** modify sqlite.db directly — only modify .ts/.tsx/.sql/.css/.json files
3. **NEVER** modify docker-compose.yml in ways that could lose volumes
4. If unsure about a fix: document it and skip, let the user decide

## Completion
- [ ] `tsc --noEmit` passes for both server and client
- [ ] `npm run build` succeeds for client
- [ ] Data integrity verified (counts match)
- [ ] Git commit created (not pushed)
- [ ] Create marker: `.agent-done-WV-04`

