---
description: Generate and review Drizzle migration for schema changes
argument-hint: migration name (e.g. add-tenant-id-to-transactions)
allowed-tools: ["Bash", "Read", "Write", "TodoWrite"]
---

# GoldLedger Drizzle Migration

Migration name: $ARGUMENTS

## Step 1: Check current schema status
```bash
cd server && npx drizzle-kit status 2>&1
```

## Step 2: Generate migration
```bash
cd server && npx drizzle-kit generate --name="$ARGUMENTS" 2>&1
```

## Step 3: Review generated SQL
Read the generated migration file in `server/drizzle/` and display it.
Check for:
- Destructive operations (DROP, TRUNCATE) — flag these as DANGEROUS
- Missing indexes on FK columns
- Correct column types (integer for money, not real)

## Step 4: Present for approval
Show the SQL and ask user to confirm before pushing.
DO NOT run `drizzle-kit push` without explicit user confirmation.

## Step 5: Push (only after confirmation)
```bash
cd server && npx drizzle-kit push 2>&1
```
