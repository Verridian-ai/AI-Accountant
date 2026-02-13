# Agent R09: Docker & Infrastructure Researcher

## Role

Analyze the current Docker infrastructure, identify gaps, and design the infrastructure changes needed for Waves 11-24 (new services, networking, volumes, environment variables).

## Phase: A (Research — Start Immediately, Parallel with R01-R08, R10)

## Research Tasks

### 1. Current Docker Stack

- [ ] Read `docker-compose.yml` — document ALL 5 services in detail:
  - `postgres`: pgvector/pgvector:pg17, port 5432, volumes, env vars
  - `cognee`: Built from ./cognee-repo, port 8000, all env vars (LLM, embedding, graph, vector, auth)
  - `redis`: Redis 7 Alpine, port 6379
  - `server`: Hono API, port 3501, build context, env vars
  - `client`: React + nginx, port 8080, build context
- [ ] Document network configuration (default bridge? custom network?)
- [ ] Document volume mounts and data persistence
- [ ] Document health checks (if any)

### 2. Cognee Service Configuration Gaps

- [ ] Document DISABLED settings: `ENABLE_BACKEND_ACCESS_CONTROL=false`, `REQUIRE_AUTHENTICATION=false`
- [ ] Document MISSING Redis connection: `CACHING=true`, `CACHE_BACKEND=redis`, `CACHE_HOST=redis`, `CACHE_PORT=6379`
- [ ] Document what needs to change for multi-user isolation
- [ ] Assess: Does Cognee need a separate PostgreSQL database or can it share?

### 3. New Services Needed for Waves 11-24

- [ ] Assess if any new Docker services are needed:
  - CDR Harvester (Wave 20): Scheduled job — separate service or cron in server?
  - Market Data Fetcher (Wave 21): Scheduled job — separate service or cron?
  - OCR Service (Wave 14): Tesseract/OCR engine — separate service?
  - Admin Backend (Wave 18): Same server or separate admin API?
- [ ] Propose: Keep minimal (everything in server) vs microservices approach
- [ ] Recommend: Docker-local constraint means no cloud services except LLM APIs

### 4. Performance & Scaling Considerations

- [ ] Current resource allocation: Are there memory/CPU limits set?
- [ ] PostgreSQL: Is pgvector configured optimally? Shared buffers? Work mem?
- [ ] Cognee: Memory usage for graph operations? Kuzu performance?
- [ ] Redis: Is it being used for anything currently? (Session store? Cache?)
- [ ] Propose resource limits for production deployment

### 5. Development vs Production Configuration

- [ ] Document current setup: Is it dev-only or production-ready?
- [ ] Identify missing production concerns: SSL/TLS, secrets management, log aggregation, backup strategy
- [ ] Propose: docker-compose.prod.yml overlay for production settings
- [ ] Document: How to add new environment variables safely (secrets vs config)

### 6. Build & Deployment Pipeline

- [ ] Document current build process: `docker compose build`
- [ ] Assess build times and optimization opportunities (multi-stage builds, layer caching)
- [ ] Document: How are migrations run? (On server startup? Manual?)

## Output Format

Write findings to `wave0-research/R09-docker-infrastructure.md` with these sections:

1. **Current Stack** — All 5 services with full configuration detail
2. **Cognee Gaps** — Disabled features, missing config
3. **New Services Assessment** — What's needed for Waves 11-24
4. **Performance** — Resource allocation, optimization opportunities
5. **Production Readiness** — Missing concerns, proposed solutions
6. **Build Pipeline** — Current process, optimization opportunities
7. **Infrastructure Roadmap** — Phased infrastructure changes per wave

## Completion

- [ ] All sections populated with specific config values
- [ ] Create marker file: `.agent-done-R09`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Docker Compose Analysis** | Parse docker-compose.yml, understand service definitions, networking, volumes | Expert |
| **Service Networking** | Understand container networking, port mapping, inter-service communication | Expert |
| **Resource Planning** | Estimate CPU/memory needs, configure limits, optimize for local Docker | Advanced |
| **Production Readiness Assessment** | Identify gaps: SSL, secrets, logging, backups, health checks | Advanced |
| **Cognee Infrastructure** | Understand Cognee Docker config, env vars, graph/vector store backends | Advanced |
| **Build Optimization** | Multi-stage builds, layer caching, build time reduction | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel infrastructure analysis | Advanced |

## Sub-Agent Delegation Plan

```
R09 (Docker Infrastructure Researcher):
├── Sub-agent A: Current Docker Stack Audit
│   ├── Read docker-compose.yml (all 5 services in detail)
│   ├── Document: ports, volumes, env vars, health checks, networks
│   ├── Document: build contexts, Dockerfiles referenced
│   └── Output: wave0-research/.scratch-R09-current.md
│
├── Sub-agent B: New Service Requirements (Waves 11-24)
│   ├── Assess CDR Harvester: separate service vs cron in server?
│   ├── Assess Market Data Fetcher: separate service vs cron?
│   ├── Assess OCR Service: Tesseract container needed?
│   ├── Assess Admin API: same server or separate?
│   └── Output: wave0-research/.scratch-R09-new-services.md
│
├── Sub-agent C: Performance & Production Concerns
│   ├── Assess resource limits (memory, CPU) for each service
│   ├── Document missing production concerns (SSL, secrets, logs, backups)
│   ├── Propose docker-compose.prod.yml overlay
│   └── Output: wave0-research/.scratch-R09-production.md
│
└── R09 Parent: Merge and produce infrastructure roadmap
    ├── Read all .scratch-R09-*.md files
    ├── Produce phased infrastructure changes per wave
    ├── Write final wave0-research/R09-docker-infrastructure.md
    └── Delete scratch files
```

### Delegation Rules for R09

- Sub-agents write ONLY to `wave0-research/.scratch-R09-*.md` files
- Sub-agent A should include exact env var names and values
- Sub-agent B should justify each "separate service" vs "in-server" decision

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
