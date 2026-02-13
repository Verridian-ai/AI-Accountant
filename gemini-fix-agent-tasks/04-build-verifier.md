# Agent 04: Build Verifier & Docker Fix

## Mission
1. Verify `npx tsc -b --noEmit` passes with ZERO errors in client/
2. Verify `npx tsc --noEmit` passes with ZERO errors in server/
3. Update `docker-compose.yml` to load ALL migration files (0009-0036)
4. Run `docker compose build` and fix any remaining build errors
5. Ensure the app can start with `docker compose up`

## CRITICAL RULES
1. Wait for Agents 01-03 to complete (check for `.agent-done-GF-01`, `.agent-done-GF-02`, `.agent-done-GF-03`)
2. Fix ANY remaining TypeScript errors — you are the last line of defense
3. Do NOT delete features or components — fix them
4. If a component is truly unfixable, wrap the problematic code in `// @ts-expect-error` as last resort

## Phase 1: Client TypeScript Verification
```bash
cd client && npx tsc -b --noEmit 2>&1 | grep "error TS" | wc -l
```
- If 0 errors → proceed to Phase 2
- If errors remain → fix them using the same patterns as Agents 01-03

## Phase 2: Server TypeScript Verification
```bash
cd server && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```
- Should already be 0 (was fixed previously)
- If errors → fix them

## Phase 3: Update docker-compose.yml Migrations
The postgres service in `docker-compose.yml` currently only loads migrations up to 0009.
Add volume mounts for ALL migration files in `docker/migrations/` directory.

Current volumes (lines ~33-38):
```yaml
volumes:
  - ./server/drizzle/0006_postgres_migration.sql:/docker-entrypoint-initdb.d/01-cba-schema.sql:ro
  - ./docker/init-cognee-db.sql:/docker-entrypoint-initdb.d/02-extensions.sql:ro
  - ./docker/init-cognee-db.sh:/docker-entrypoint-initdb.d/03-cognee-db.sh:ro
  - ./server/drizzle/0007_missing_tables.sql:/docker-entrypoint-initdb.d/04-missing-tables.sql:ro
  - ./server/drizzle/0008_account_ownership.sql:/docker-entrypoint-initdb.d/05-account-ownership.sql:ro
  - ./docker/migrations/0009_complete_schema.sql:/docker-entrypoint-initdb.d/06-complete-schema.sql:ro
```

Add these (check which files exist in `docker/migrations/` first with `ls docker/migrations/`):
```yaml
  - ./docker/migrations/0010_*.sql:/docker-entrypoint-initdb.d/07-migration-0010.sql:ro
  - ./docker/migrations/0011_*.sql:/docker-entrypoint-initdb.d/08-migration-0011.sql:ro
  ... (continue for all files through 0036)
```

IMPORTANT: Use the EXACT filenames from `ls docker/migrations/`. The numbering in docker-entrypoint-initdb.d/ must be sequential (07, 08, 09, ...) to ensure correct execution order.

## Phase 4: Docker Build
```bash
docker compose build 2>&1
```
- If build succeeds → proceed to Phase 5
- If client build fails → fix TypeScript errors
- If server build fails → fix server issues
- If cognee build fails → check Dockerfile

## Phase 5: Docker Up (Quick Smoke Test)
```bash
docker compose up -d 2>&1
docker compose ps
docker compose logs --tail=20 server
docker compose logs --tail=20 client
```
- Verify all 5 services are running (postgres, cognee, redis, server, client)
- Check for startup errors in logs

## Phase 6: Create Missing Migration Files (if needed)
If migrations 0017, 0018, 0020, 0021 don't exist in `docker/migrations/`:
- 0017: Pay runs & leave tables (Wave 5)
- 0018: STP & payslips tables (Wave 6)
- 0020: Recurring invoices & payments tables (Wave 8)
- 0021: AR aging & multi-currency tables (Wave 9)

Check the wave orchestration prompt files for table schemas:
- `wave5-orchestration-prompt.md`
- `wave6-orchestration-prompt.md`
- `wave8-orchestration-prompt.md`
- `wave9-orchestration-prompt.md`

## Completion
When done, create marker file: `touch .agent-done-GF-04`
Report final status:
- Client tsc errors: X
- Server tsc errors: X
- Docker build: PASS/FAIL
- Docker up: PASS/FAIL
- Services running: X/5

