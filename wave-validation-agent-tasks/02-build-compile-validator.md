# Agent 02: Build & Compile Validator

## Role
Run actual compilation and build commands to find real errors. Document every failure with file, line number, and error message.

## Phase: 2 (After Agent 01 completes — read `wave-validation-reports/01-dependency-audit.md` first)

## Prerequisites
Wait for `.agent-done-WV-01`

## Tasks

### 1. Server TypeScript Compilation
- [ ] Run `cd server && npx tsc --noEmit 2>&1` — capture ALL errors
- [ ] For each error: note file path, line number, error code, message
- [ ] Categorize: type errors vs missing imports vs missing modules
- [ ] Count total errors

### 2. Client TypeScript Compilation
- [ ] Run `cd client && npx tsc --noEmit 2>&1` — capture ALL errors
- [ ] Same categorization as server
- [ ] Count total errors

### 3. Client Build
- [ ] Run `cd client && npm run build 2>&1` — capture output
- [ ] Note if build succeeds or fails
- [ ] If fails: capture the specific error(s)

### 4. ESLint Check (if configured)
- [ ] Run `cd server && npx eslint src/ --max-warnings=0 2>&1 | head -100`
- [ ] Run `cd client && npx eslint src/ --max-warnings=0 2>&1 | head -100`
- [ ] Note critical lint errors (not style warnings)

### 5. Migration SQL Validation
- [ ] Check each migration file in `docker/migrations/` for SQL syntax
- [ ] Verify CREATE TABLE IF NOT EXISTS pattern is used
- [ ] Check for references to tables that should exist from prior migrations

### 6. Cross-Reference with Agent 01
- [ ] Compare compilation errors with Agent 01's dependency audit
- [ ] Identify which errors are caused by missing Wave 1-10 code
- [ ] Identify which errors are self-contained bugs in Waves 11-23

## Output
Write findings to `wave-validation-reports/02-build-validation.md` with:
1. **Server Errors** — full list with file:line:error
2. **Client Errors** — full list
3. **Build Status** — PASS/FAIL for each build command
4. **Root Cause Analysis** — which errors trace back to missing Wave 1-10 code

## Completion
- [ ] Create marker: `.agent-done-WV-02`

