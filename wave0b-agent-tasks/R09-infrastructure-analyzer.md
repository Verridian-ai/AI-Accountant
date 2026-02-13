# Agent R09: Docker & Infrastructure Analyzer

## Role

Analyze the current Docker/infrastructure setup and plan all changes needed by Waves 1-10. Focus on Docker Compose modifications, new environment variables, Redis configuration, and any new services.

## Phase: A (Research — Start Immediately, Parallel with R01-R08, R10)

## Research Tasks

### 1. Current Infrastructure State

- [ ] Read `docker-compose.yml` — document ALL 5 services, ports, volumes, env vars
- [ ] Read `.env` or `.env.example` — document all environment variables
- [ ] Read `server/Dockerfile` or build config — understand server build process
- [ ] Read `client/Dockerfile` or nginx config — understand frontend deployment
- [ ] Check if Waves 11-16 modified docker-compose.yml or added new services

### 2. Wave 1-10 Infrastructure Requirements

- [ ] **Wave 1**: No new services, but may need new env vars for intent routing config
- [ ] **Wave 2**: SSE streaming — verify Hono SSE support, nginx proxy_buffering off, Redis pub/sub for streaming
- [ ] **Wave 3**: Cognee multi-user — `ENABLE_BACKEND_ACCESS_CONTROL=true`, Redis-Cognee session bridge, new Cognee env vars (`COGNEE_DEFAULT_USER`, `COGNEE_SESSION_TTL`)
- [ ] **Wave 4-6**: Payroll — may need ATO STP API endpoint env var, TFN encryption key env var
- [ ] **Wave 7**: Invoice — PDF generation library (may need wkhtmltopdf or puppeteer service)
- [ ] **Wave 8**: Payment gateway — Stripe/payment API key env vars
- [ ] **Wave 9**: Multi-currency — exchange rate API key env var
- [ ] **Wave 10**: No new services expected

### 3. Redis Configuration

- [ ] Current Redis usage: basic caching
- [ ] Wave 2: Redis pub/sub for SSE streaming
- [ ] Wave 3: Redis for Cognee session state
- [ ] Document any Redis config changes needed (maxmemory, eviction policy)

### 4. Migration Infrastructure

- [ ] Read `docker/migrations/` — document existing migration files
- [ ] Verify migration runner (how are migrations applied? Automatic on startup?)
- [ ] Plan migration file locations for Waves 1-10 (0013-0022)

### 5. Development vs Production Considerations

- [ ] Document any dev-only services (e.g., hot reload)
- [ ] Note production concerns (SSL, scaling, connection pooling)
- [ ] Check if `server/tsconfig.json` or build config needs updates

## Output Format

Write findings to `wave0b-research/R09-infrastructure.md` with:

1. **Current Infrastructure** — Complete Docker Compose documentation
2. **Per-Wave Changes** — Environment variables, config changes per wave
3. **Redis Plan** — Pub/sub, session store, config changes
4. **Migration Runner** — How migrations are applied
5. **New Dependencies** — Any new npm packages or system-level tools needed
6. **Docker Compose Diff** — Proposed changes to docker-compose.yml

## Completion

- [ ] All infrastructure changes documented per wave
- [ ] Create marker file: `.agent-done-0B-R09`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Docker/Infrastructure | Container orchestration and config | Expert |
| DevOps | Build pipelines and deployment | Advanced |
| Redis Architecture | Caching, pub/sub, session stores | Advanced |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read docker-compose.yml, all Dockerfiles, env files
- **Sub-agent B**: Read migration files and runner config
- **Sub-agent C**: Extract infrastructure requirements from planning doc (all 10 waves)
- R09 merges into complete infrastructure analysis

