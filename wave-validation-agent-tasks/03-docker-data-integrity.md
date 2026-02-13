# Agent 03: Docker Deployment & Data Integrity

## Role
Verify Docker stack starts, all services are healthy, and existing user financial data is intact and queryable. **DO NOT modify any data.**

## Phase: 3 (After Agent 02 completes)

## Prerequisites
Wait for `.agent-done-WV-02`

## Tasks

### 1. Docker Stack Health
- [ ] Run `docker compose ps` — list all 5 services and their status
- [ ] Check: postgres, redis, cognee, server, client — all running?
- [ ] If any service is down, capture `docker compose logs <service> --tail=50`
- [ ] Run `docker compose up -d` if not already running, capture output

### 2. Service Health Endpoints
- [ ] Test server: `curl -s http://localhost:3501/api/health` or similar
- [ ] Test client: `curl -s http://localhost:5173` or `http://localhost:8080` — returns HTML?
- [ ] Test postgres: `docker exec cba-postgres pg_isready`
- [ ] Test redis: `docker exec cba-redis redis-cli ping`

### 3. Data Integrity — CRITICAL
- [ ] **Backup first**: `cp server/sqlite.db server/sqlite.db.validation-backup`
- [ ] Query transaction count: `SELECT COUNT(*) FROM transactions`
- [ ] Query account count: `SELECT COUNT(*) FROM accounts`
- [ ] Query user count: `SELECT COUNT(*) FROM users`
- [ ] Query statement count: `SELECT COUNT(*) FROM statements`
- [ ] Verify balances: `SELECT id, name, balance FROM accounts LIMIT 10`
- [ ] Verify recent transactions: `SELECT id, description, amount, date FROM transactions ORDER BY date DESC LIMIT 10`
- [ ] Document ALL counts for post-fix comparison

### 4. Migration Execution Test
- [ ] Check which migrations have been applied to PostgreSQL
- [ ] List any migrations that fail to apply
- [ ] Note: do NOT force-apply migrations that could break data

### 5. API Smoke Test
- [ ] Test login endpoint (if auth exists)
- [ ] Test `GET /api/transactions` — returns data?
- [ ] Test `GET /api/accounts` — returns data?
- [ ] Test `GET /api/stats` — returns data?
- [ ] Note any 500 errors with their stack traces

## Output
Write findings to `wave-validation-reports/03-docker-data-integrity.md` with:
1. **Docker Status** — per-service health
2. **Data Counts** — baseline numbers for all key tables
3. **API Health** — per-endpoint status
4. **Migration Status** — applied vs pending
5. **Data Safety Verdict** — SAFE / AT RISK with explanation

## Completion
- [ ] Create marker: `.agent-done-WV-03`

