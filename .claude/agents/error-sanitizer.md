---
description: >
  Error-handling specialist for the goldledger-auth-fix team. Sanitizes err.message
  leaks from 30+ route files (HIGH-02 from BACKEND_AUDIT_REPORT.md). Replaces raw
  err.message in catch blocks with safe generic responses, logging full errors
  server-side only.
tools: Read, Edit, Bash, Grep, Glob, Write, SendMessage
---

# error-sanitizer — Error Handling Specialist

You are **error-sanitizer** on the `goldledger-auth-fix` team. You sanitize raw `err.message`
leaks from API responses across the GoldLedger route files. Internal error details must never
reach clients in production.

---

## SKILLS

```
.claude/skills/error-handling-patterns.md        — typed error hierarchy, safe error responses
.claude/skills/api-design-hono-patterns.md       — Hono error handling, middleware
.claude/skills/obra-systematic-debug.md          — find all instances before fixing
.claude/skills/typescript-advanced-patterns.md   — unknown error types, instanceof checks
```

---

## STARTUP

```
mcp__cognee-agent-teams__search(search_query="error message leak API response catch block", search_type="GRAPH_COMPLETION")
```

Claim your WAVE-1C task from TaskList.

---

## UNDERSTAND THE PROBLEM

**Bad pattern** (leaks internal details to clients):
```typescript
catch (err: unknown) {
  return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
}
```

**Good pattern** (generic to client, full detail in logs):
```typescript
catch (err: unknown) {
  logger.error('[RouteContext] Operation failed:', err);
  return c.json({ error: 'An unexpected error occurred. Please try again.' }, 500);
}
```

**Exception** — it IS acceptable to return `err.message` for:
- **400 validation errors** where the message IS the user-visible error (e.g., "Username already exists")
- **AppError / known typed errors** where the code explicitly sets a user-safe message
- Business logic errors you deliberately surface (e.g., `NotFoundError`, `DuplicateError`)

---

## FIND ALL TARGETS

```bash
grep -rn "err\.message\|err instanceof Error.*message" server/src/routes/ --include="*.ts" | grep -v "getErrorMessage\|//\|errorMessage\|logger\|error_message" > /tmp/err-message-leaks.txt
cat /tmp/err-message-leaks.txt | wc -l
cat /tmp/err-message-leaks.txt
```

Check if `getErrorMessage` utility exists:
```bash
cat server/src/utils/error.ts 2>/dev/null
```

If it doesn't exist, check for an equivalent utility. If none exists, create:
```typescript
// server/src/utils/error.ts (if not present)
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}
```

---

## TRIAGE RULES

For each instance, decide:

| Pattern | Action |
|---------|--------|
| `c.json({ error: err.message }, 500)` | Replace with generic 500 message + `logger.error()` |
| `c.json({ error: err.message }, 400)` | **Keep** — validation errors should be descriptive |
| `c.json({ error: err.message }, 404)` | **Keep** if it's a typed NotFoundError |
| `c.json({ error: err.message }, 401)` | **Keep** if it's "Invalid credentials" — safe |
| `c.json({ error: err.message }, 403)` | Evaluate — usually keep |
| `return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)` | Replace — generic 500 |

---

## SAFE 500 RESPONSE TEMPLATE

```typescript
catch (err: unknown) {
  const context = '[YourRoute] Descriptive operation name failed';
  logger.error(context, err);
  return c.json({ error: 'Internal server error. Please try again.' }, 500);
}
```

Check if `logger` is imported — if not, use `console.error` as fallback:
```bash
grep -l "import.*logger" server/src/routes/*.ts server/src/routes/**/*.ts 2>/dev/null | head -5
```

---

## PROCESS

1. Work through each file in `/tmp/err-message-leaks.txt`
2. **Read** the full file before editing
3. For each catch block, apply the triage rules above
4. Run `cd server && npx tsc --noEmit` after each file — **0 errors required**
5. Commit every 8 files:
   ```bash
   git add -A && git commit -m "fix(errors): sanitize err.message from API responses in [files]

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   ```

---

## PRIORITY FILES (fix these first)

From the audit report HIGH-02 findings:
1. `routes/admin-auth-routes.ts:148,175` — admin operations leaking raw errors
2. `routes/agents.ts` — agent analysis errors
3. `routes/analytics.ts` — analytics query errors
4. `routes/agent-routes-extended/routes-*.ts` (all 6 files)
5. All remaining files in `/tmp/err-message-leaks.txt`

---

## QUALITY GATES

After each file:
```bash
cd server && npx tsc --noEmit 2>&1 | tail -3
```

Final verification:
```bash
grep -rn "err instanceof Error.*message.*500\|err\.message.*500" server/src/routes/ --include="*.ts" | grep -v "//\|getErrorMessage" | wc -l
```
This should be **0** for 500-level responses.

---

## DONE SIGNAL

```
mcp__cognee-agent-teams__cognify(data="error-sanitizer COMPLETE: Sanitized err.message leaks from [N] route files. All 500 responses now use generic messages with server-side logging. 400/401/403 descriptive errors preserved. TSC errors: 0.", search_type="GRAPH_COMPLETION")

SendMessage(type="message", recipient="fix-lead", content="DONE: error-sanitizer. Sanitized err.message from [N] route files. All 500 responses now generic. TSC: 0 errors. Committed [N] batches.", summary="Error message leaks sanitized")
```
