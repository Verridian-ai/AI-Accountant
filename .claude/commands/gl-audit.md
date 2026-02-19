---
description: Run a targeted audit sweep on a specific area of the GoldLedger codebase
argument-hint: area to audit (routes|schema|services|client|security|all)
allowed-tools: ["Read", "Bash", "Grep", "Write", "TodoWrite"]
---

# GoldLedger Targeted Audit

Run a deep audit sweep on: $ARGUMENTS

## Audit Checklist

### If routes (or all):
- `grep -rn "c\.req\.json()" server/src/routes/ --include="*.ts" | grep -v "zValidator"` — unvalidated inputs
- `grep -rn "c\.get('jwtPayload')" server/src/routes/ --include="*.ts"` — check null guards
- `grep -rn "req\.query.*\!" server/src/routes/ --include="*.ts"` — non-null assertions
- `grep -rn "parseInt(" server/src/routes/ --include="*.ts" | grep -v ", 10"` — missing radix

### If schema (or all):
- `grep -rn "real(" server/src/schema/ --include="*.ts"` — float money columns
- `grep -rn "\.default('CURRENT_TIMESTAMP')" server/src/schema/ --include="*.ts" | grep -v "notNull"` — nullable timestamps
- `grep -rn "userId.*default.*default" server/src/schema/ --include="*.ts"` — hardcoded userId

### If services (or all):
- `grep -rn "console\.log(" server/src/services/ --include="*.ts"` — debug logs
- `grep -rn "TODO\|FIXME\|HACK" server/src/services/ --include="*.ts"` — unresolved todos
- Check for circular imports in rbac/

### If client (or all):
- `grep -rn "localhost:3000\|localhost:8080" client/src/ --include="*.ts" --include="*.tsx"` — hardcoded URLs
- `grep -rn "\.map(" client/src/ --include="*.tsx" | grep -v "?\.map\|\|\| \[\]"` — unsafe maps
- `cd client && npx tsc --noEmit 2>&1 | head -30` — tsc errors

### If security (or all):
- `grep -rn "publicPaths" server/src/index.ts -A 20` — check public endpoints
- `grep -rn "dangerously\|unsafe\|UNSAFE" server/src/ --include="*.ts"` — dangerous patterns

## Output
Write findings to a timestamped file: `audit-results/$(date +%Y%m%d-%H%M)-$ARGUMENTS.md`
Format: severity | file:line | description | recommended fix
