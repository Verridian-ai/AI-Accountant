# GoldLedger Docker Rollback & Checkpoint Plan

**Version**: 1.1
**Date**: 2026-02-17
**Author**: Docker & Rollback Engineer (Phase 1 Planning Team)
**Status**: Ready for Review
**Reviewed by**: Devil's Advocate (stress-tested rollback feasibility)

> **IMPORTANT**: This rollback strategy is designed for a **development/staging Docker environment**. It is NOT a production disaster-recovery plan. Production deployments would require blue-green deploys, database branching (e.g., Neon), or point-in-time recovery (PITR). The strategies here trade some data loss (back to last checkpoint) for fast, practical recovery during a code refactoring initiative.

---

## 1. Current Docker Architecture

### Service Topology (5 services, 1 bridge network)

```
┌─────────────────────────────────────────────────────────┐
│                   cba-network (bridge)                   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ postgres  │  │  redis   │  │  cognee   │              │
│  │ :5432     │  │  :6379   │  │  :8000    │              │
│  │ pg17+     │  │  7-alpine│  │  (built)  │              │
│  │ pgvector  │  │  AOF+LRU │  │  from repo│              │
│  └────┬──┬──┘  └────┬─────┘  └─────┬─────┘              │
│       │  │          │              │                     │
│       │  └──────────┼──────────────┘                     │
│       │             │                                    │
│  ┌────▼─────────────▼──┐   ┌─────────────┐              │
│  │      server          │   │   client    │              │
│  │      :3501           │   │   :8080     │              │
│  │  node:20-slim        │   │   nginx     │              │
│  │  + python3           │◄──│   (proxy)   │              │
│  └──────────────────────┘   └─────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Persistent Volumes

| Volume | Service | Mount Point | Data |
|--------|---------|-------------|------|
| `postgres-data` | postgres | `/var/lib/postgresql/data` | All SQL data (ai_accountant + cognee_db) |
| `cognee-data` | cognee | `/app/.cognee_system` | Kuzu graph DB, Cognee config files |
| `redis-data` | redis | `/data` | AOF append-only file (session cache, rate limits) |

### Build vs Pull Images

| Service | Image Source | Build Context |
|---------|-------------|---------------|
| postgres | **Pull**: `pgvector/pgvector:pg17` | N/A |
| redis | **Pull**: `redis:7-alpine` | N/A |
| cognee | **Build**: `./cognee-repo/Dockerfile` | `./cognee-repo` |
| server | **Build**: `./server/Dockerfile` | `./server` |
| client | **Build**: `./client/Dockerfile` | `./client` (+ nginx.conf) |

### Health Checks

| Service | Health Check | Interval | Start Period |
|---------|-------------|----------|--------------|
| postgres | `pg_isready -U app_user -d ai_accountant` | 5s | 30s |
| redis | `redis-cli ping` | 10s | 10s |
| cognee | `curl -f http://localhost:8000/api/v1/settings` | 30s | 60s |
| server | `curl -f http://localhost:3501/health` | 30s | 30s |
| client | `curl -f http://localhost:80` | 30s | — |

### Migration Strategy (CRITICAL)

**Current approach**: All 31 migration files (0006–0036) are bind-mounted into PostgreSQL's `/docker-entrypoint-initdb.d/` directory. These scripts **only run on first container start** when the data directory is empty.

**Key facts:**
- Migrations use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — idempotent by design
- There are **no down-migrations** — all migrations are forward-only
- The `docker-entrypoint-initdb.d/` pattern is one-shot: once the PG data directory exists, these scripts are never re-run
- Adding new migration files to a running system requires **manual execution** against the live database
- Seed data in migrations (e.g., `0035` inserts permissions + subscription plans) uses no `ON CONFLICT` clauses — re-running would fail on duplicates

### Dependency Chain

```
postgres (healthy) ──┐
                     ├──> cognee ──┐
redis (healthy) ─────┘             │
                                   │ (not explicit dep, but logical)
postgres (healthy) ──> server ─────┘
                                   │
server ────────────> client ───────┘
```

---

## 2. Backup Strategy: Two Tiers

Understanding the two tiers is critical before reading the scripts below.

| Tier | Method | Speed | Data Loss | When to Use |
|------|--------|-------|-----------|-------------|
| **Tier 1 (Primary)** | `pg_dumpall` logical dump | **Fast** (seconds, runs live, no downtime) | Restores to checkpoint state — **loses data created after checkpoint** | Per-phase checkpoints, routine rollbacks |
| **Tier 2 (Nuclear)** | Volume tar snapshots | **Slow** (minutes, requires service stop, WSL2 I/O penalty) | Same — restores entire volume to snapshot point | Pre-refactor safety net, database corruption, Cognee graph inconsistency |

**Per-phase checkpoints use Tier 1 only.** Tier 2 volume backups are taken once before refactoring as a last-resort safety net.

**Data loss caveat**: Any rollback restores to the last checkpoint. Work done between checkpoints (test data, Cognee indexing, etc.) is lost. This is acceptable for a dev/staging environment during refactoring. Checkpoint frequently to minimize the window.

---

## 3. Pre-Refactor Checklist

Run this **once** before starting any refactoring work.

### 2.1 Tag All Current Images

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# tag-pre-refactor.sh — Tag current images before refactoring
# Run from: project root (where docker-compose.yml lives)
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG="pre-refactor-${TIMESTAMP}"

echo "=== Tagging all images as '${TAG}' ==="

# Get the compose project name (default: directory name lowercased)
PROJECT=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')

# Tag built images
docker tag "${PROJECT}-server:latest"  "${PROJECT}-server:${TAG}"  2>/dev/null || \
docker tag "cba-statements-parse-server:latest" "cba-statements-parse-server:${TAG}" 2>/dev/null || \
echo "WARN: Could not tag server image — build it first with 'docker compose build server'"

docker tag "${PROJECT}-client:latest"  "${PROJECT}-client:${TAG}"  2>/dev/null || \
docker tag "cba-statements-parse-client:latest" "cba-statements-parse-client:${TAG}" 2>/dev/null || \
echo "WARN: Could not tag client image — build it first with 'docker compose build client'"

docker tag "${PROJECT}-cognee:latest"  "${PROJECT}-cognee:${TAG}"  2>/dev/null || \
docker tag "cba-statements-parse-cognee:latest" "cba-statements-parse-cognee:${TAG}" 2>/dev/null || \
echo "WARN: Could not tag cognee image — build it first with 'docker compose build cognee'"

# Pull images don't need tagging (version-pinned), but record them
echo ""
echo "=== Pulled images (version-pinned, no tagging needed) ==="
echo "  postgres: pgvector/pgvector:pg17"
echo "  redis:    redis:7-alpine"

echo ""
echo "=== Tagged images ==="
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep "${TAG}" || echo "(none found — ensure images are built)"

echo ""
echo "Pre-refactor tag: ${TAG}"
echo "Save this tag for rollback: echo '${TAG}' > .pre-refactor-tag"
echo "${TAG}" > .pre-refactor-tag
```

### 2.2 Backup PostgreSQL Volume

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# backup-postgres.sh — Backup postgres-data volume
# Run from: project root
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/postgres-${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

# Get the full volume name
VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep postgres-data | head -1)
if [ -z "${VOLUME_NAME}" ]; then
    echo "ERROR: postgres-data volume not found. Is Docker Compose up?"
    echo "Available volumes:"
    docker volume ls --format '{{.Name}}' | grep -i cba || echo "  (none matching 'cba')"
    exit 1
fi

echo "=== Backing up volume: ${VOLUME_NAME} ==="
echo "  Destination: ${BACKUP_FILE}"

# Stop postgres to ensure consistent backup
echo "  Stopping postgres for consistent backup..."
docker compose stop postgres

# Create backup from volume
docker run --rm \
    -v "${VOLUME_NAME}:/data:ro" \
    -v "$(pwd)/${BACKUP_DIR}:/backup" \
    alpine:3.19 \
    tar czf "/backup/postgres-${TIMESTAMP}.tar.gz" -C / data

# Restart postgres
echo "  Restarting postgres..."
docker compose start postgres

# Wait for healthy
echo "  Waiting for postgres to be healthy..."
timeout 60 bash -c 'until docker compose ps postgres | grep -q healthy; do sleep 2; done' || \
    echo "  WARN: Postgres may not be healthy yet — check with 'docker compose ps'"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo ""
echo "=== Backup complete ==="
echo "  File: ${BACKUP_FILE}"
echo "  Size: ${BACKUP_SIZE}"
echo "  Restore with: ./restore-postgres.sh ${BACKUP_FILE}"
```

### 2.3 Backup Cognee Data Volume

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# backup-cognee.sh — Backup cognee-data volume (Kuzu graph + config)
# Run from: project root
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/cognee-${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep cognee-data | head -1)
if [ -z "${VOLUME_NAME}" ]; then
    echo "ERROR: cognee-data volume not found."
    exit 1
fi

echo "=== Backing up Cognee data: ${VOLUME_NAME} ==="

docker compose stop cognee

docker run --rm \
    -v "${VOLUME_NAME}:/data:ro" \
    -v "$(pwd)/${BACKUP_DIR}:/backup" \
    alpine:3.19 \
    tar czf "/backup/cognee-${TIMESTAMP}.tar.gz" -C / data

docker compose start cognee

echo "=== Cognee backup complete: ${BACKUP_FILE} ==="
```

### 2.4 Backup Redis Data

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# backup-redis.sh — Backup redis-data volume (AOF + RDB)
# Run from: project root
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/redis-${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep redis-data | head -1)
if [ -z "${VOLUME_NAME}" ]; then
    echo "ERROR: redis-data volume not found."
    exit 1
fi

echo "=== Backing up Redis data: ${VOLUME_NAME} ==="

# Trigger BGSAVE for a consistent snapshot, then backup
docker compose exec redis redis-cli BGSAVE 2>/dev/null || true
sleep 2

docker run --rm \
    -v "${VOLUME_NAME}:/data:ro" \
    -v "$(pwd)/${BACKUP_DIR}:/backup" \
    alpine:3.19 \
    tar czf "/backup/redis-${TIMESTAMP}.tar.gz" -C / data

echo "=== Redis backup complete: ${BACKUP_FILE} ==="
```

### 2.5 Full Pre-Refactor Snapshot (All-in-One)

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# snapshot-all.sh — Complete pre-refactor snapshot
# Run from: project root
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   GoldLedger Pre-Refactor Snapshot: ${TIMESTAMP}     ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# 1. Tag images
echo "─── Step 1/5: Tagging images ───"
bash ./docker/scripts/tag-pre-refactor.sh

# 2. SQL dump (logical backup — more portable than volume tar)
echo ""
echo "─── Step 2/5: PostgreSQL logical dump ───"
mkdir -p ./backups
docker compose exec -T postgres pg_dumpall \
    -U "${POSTGRES_USER:-app_user}" \
    --clean --if-exists \
    > "./backups/pg-dump-${TIMESTAMP}.sql"
echo "  Saved: ./backups/pg-dump-${TIMESTAMP}.sql ($(du -h "./backups/pg-dump-${TIMESTAMP}.sql" | cut -f1))"

# 3. Volume backups
echo ""
echo "─── Step 3/5: Volume backups ───"
bash ./docker/scripts/backup-postgres.sh
bash ./docker/scripts/backup-cognee.sh
bash ./docker/scripts/backup-redis.sh

# 4. Record current image digests
echo ""
echo "─── Step 4/5: Recording image digests ───"
docker compose images --format json > "./backups/image-manifest-${TIMESTAMP}.json" 2>/dev/null || \
docker compose images > "./backups/image-manifest-${TIMESTAMP}.txt"
echo "  Saved image manifest"

# 5. Record docker compose config
echo ""
echo "─── Step 5/5: Saving compose config ───"
cp docker-compose.yml "./backups/docker-compose-${TIMESTAMP}.yml"
echo "  Saved docker-compose.yml copy"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Snapshot complete!                                  ║"
echo "║   Backups directory: ./backups/                       ║"
echo "║   Tag: $(cat .pre-refactor-tag 2>/dev/null || echo 'N/A')                          ║"
echo "╚═══════════════════════════════════════════════════════╝"

ls -lh ./backups/*${TIMESTAMP}* 2>/dev/null
```

---

## 4. Per-Phase Checkpoint Protocol

After completing each refactoring phase, run a checkpoint to create a restore point.

### 4.1 Checkpoint Script

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# checkpoint.sh — Create a checkpoint after a successful phase
# Usage: ./docker/scripts/checkpoint.sh <phase-number> [description]
# Example: ./docker/scripts/checkpoint.sh 1 "foundation-complete"
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

PHASE="${1:?Usage: checkpoint.sh <phase-number> [description]}"
DESC="${2:-phase-${PHASE}}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG="phase-${PHASE}-${DESC}-${TIMESTAMP}"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Phase ${PHASE} Checkpoint: ${TAG}                   "
echo "╚═══════════════════════════════════════════════════════╝"

# Step 1: Verify services are healthy
echo ""
echo "─── Verifying all services healthy ───"
UNHEALTHY=$(docker compose ps --format json 2>/dev/null | grep -v healthy | grep -c running || true)
if [ "${UNHEALTHY}" -gt 0 ]; then
    echo "WARNING: Some services may not be healthy. Current status:"
    docker compose ps
    read -p "Continue anyway? (y/N): " CONTINUE
    [ "${CONTINUE}" != "y" ] && exit 1
fi
docker compose ps

# Step 2: Run verification commands
echo ""
echo "─── Running verification ───"

echo "  [1/4] Server TypeScript check..."
docker compose exec server npx tsc --noEmit 2>/dev/null && echo "    PASS" || \
    echo "    SKIP (tsc not available in container — run locally)"

echo "  [2/4] Server health check..."
curl -sf http://localhost:3501/health > /dev/null && echo "    PASS" || echo "    FAIL"

echo "  [3/4] Client health check..."
curl -sf http://localhost:8080 > /dev/null && echo "    PASS" || echo "    FAIL"

echo "  [4/4] Cognee health check..."
curl -sf http://localhost:8000/api/v1/settings > /dev/null && echo "    PASS" || echo "    FAIL"

# Step 3: Tag images
echo ""
echo "─── Tagging images ───"
PROJECT=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')
for SVC in server client cognee; do
    docker tag "${PROJECT}-${SVC}:latest" "${PROJECT}-${SVC}:${TAG}" 2>/dev/null && \
        echo "  Tagged ${SVC}: ${TAG}" || \
        echo "  WARN: Could not tag ${SVC}"
done

# Step 4: SQL dump
echo ""
echo "─── PostgreSQL dump ───"
mkdir -p ./backups
docker compose exec -T postgres pg_dumpall \
    -U "${POSTGRES_USER:-app_user}" \
    --clean --if-exists \
    > "./backups/pg-dump-${TAG}.sql"
echo "  Saved: ./backups/pg-dump-${TAG}.sql"

# Step 5: Record checkpoint
echo "${TAG}" >> .checkpoint-history
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Checkpoint saved: ${TAG}                            "
echo "║   Rollback with: ./docker/scripts/rollback.sh ${TAG}  "
echo "╚═══════════════════════════════════════════════════════╝"
```

### 4.2 Expected Checkpoints

| Phase | Tag Pattern | When to Run |
|-------|-------------|-------------|
| Pre-refactor | `pre-refactor-YYYYMMDD` | Before ANY changes |
| Phase 1 | `phase-1-foundation-YYYYMMDD` | After REFACTOR-001 through 010 |
| Phase 2 | `phase-2-architecture-YYYYMMDD` | After REFACTOR-011 through 030 |
| Phase 3 | `phase-3-testing-YYYYMMDD` | After REFACTOR-031 through 041 |
| Phase 4 | `phase-4-performance-YYYYMMDD` | After REFACTOR-042 through 050 |
| Phase 5 | `phase-5-documentation-YYYYMMDD` | After REFACTOR-051 through 055 |
| Phase 6 | `phase-6-security-YYYYMMDD` | After REFACTOR-056 through 063 |

---

## 5. Rollback Scripts

### 5.1 One-Command Emergency Rollback

> **DATA LOSS WARNING**: This rollback restores the database to the state at the checkpoint. Any data created, modified, or indexed AFTER the checkpoint will be lost. This includes test data, Cognee indexing, user accounts, etc. This is the expected tradeoff for a dev/staging rollback. Checkpoint frequently (after each phase) to minimize the loss window.

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# rollback.sh — Emergency rollback to a tagged checkpoint
# Usage: ./docker/scripts/rollback.sh <tag>
# Example: ./docker/scripts/rollback.sh pre-refactor-20260217-140000
#
# This script:
#   1. Stops all running services
#   2. Restores PostgreSQL from the checkpoint's SQL dump
#   3. Restarts services using the tagged images
#   4. Verifies health
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

TAG="${1:?Usage: rollback.sh <checkpoint-tag>}"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   ROLLBACK TO: ${TAG}                                 "
echo "║   WARNING: This will overwrite current database!       "
echo "╚═══════════════════════════════════════════════════════╝"

# Verify the SQL dump exists
DUMP_FILE="./backups/pg-dump-${TAG}.sql"
if [ ! -f "${DUMP_FILE}" ]; then
    echo "ERROR: Dump file not found: ${DUMP_FILE}"
    echo ""
    echo "Available dumps:"
    ls -lh ./backups/pg-dump-*.sql 2>/dev/null || echo "  (none)"
    echo ""
    echo "Available tags:"
    cat .checkpoint-history 2>/dev/null || echo "  (no checkpoint history)"
    exit 1
fi

read -p "This will DESTROY current data and restore from ${TAG}. Continue? (type 'yes'): " CONFIRM
[ "${CONFIRM}" != "yes" ] && { echo "Aborted."; exit 0; }

PROJECT=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')

# Step 1: Stop application services (keep postgres + redis running)
echo ""
echo "─── Step 1/5: Stopping application services ───"
docker compose stop server client cognee

# Step 2: Restore database from dump
echo ""
echo "─── Step 2/5: Restoring PostgreSQL from dump ───"
echo "  Loading: ${DUMP_FILE}"
docker compose exec -T postgres psql \
    -U "${POSTGRES_USER:-app_user}" \
    -d "${POSTGRES_DB:-ai_accountant}" \
    -f - < "${DUMP_FILE}"
echo "  Database restored."

# Step 3: Retag images to the checkpoint version
echo ""
echo "─── Step 3/5: Switching to checkpoint images ───"
for SVC in server client cognee; do
    if docker image inspect "${PROJECT}-${SVC}:${TAG}" > /dev/null 2>&1; then
        docker tag "${PROJECT}-${SVC}:${TAG}" "${PROJECT}-${SVC}:latest"
        echo "  Restored ${SVC} to tag: ${TAG}"
    else
        echo "  WARN: No tagged image for ${SVC}:${TAG} — will use current image"
    fi
done

# Step 4: Restart all services
echo ""
echo "─── Step 4/5: Starting all services ───"
docker compose up -d

# Step 5: Wait for health and verify
echo ""
echo "─── Step 5/5: Waiting for health checks ───"
echo "  (timeout: 120s)"

for SVC in postgres redis server client; do
    printf "  Waiting for %-10s" "${SVC}..."
    timeout 120 bash -c "until docker compose ps ${SVC} 2>/dev/null | grep -q healthy 2>/dev/null || docker compose ps ${SVC} 2>/dev/null | grep -q running; do sleep 3; done" && \
        echo " UP" || echo " TIMEOUT"
done

printf "  Waiting for %-10s" "cognee..."
timeout 180 bash -c 'until docker compose ps cognee 2>/dev/null | grep -q healthy; do sleep 5; done' && \
    echo " UP" || echo " TIMEOUT (Cognee starts slowly — check 'docker compose logs cognee')"

echo ""
echo "─── Final status ───"
docker compose ps
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Rollback complete to: ${TAG}                        "
echo "║   Verify at: http://localhost:8080                     "
echo "╚═══════════════════════════════════════════════════════╝"
```

### 5.2 Volume-Level Restore (Nuclear Option)

If the SQL dump restore fails, use this to restore from volume tar backups:

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# restore-volume.sh — Restore a Docker volume from tar backup
# Usage: ./docker/scripts/restore-volume.sh <backup-file> <volume-name>
# Example: ./docker/scripts/restore-volume.sh ./backups/postgres-20260217-140000.tar.gz postgres-data
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_FILE="${1:?Usage: restore-volume.sh <backup.tar.gz> <volume-name>}"
VOLUME_SUFFIX="${2:?Usage: restore-volume.sh <backup.tar.gz> <volume-name>}"

# Find the full volume name
VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep "${VOLUME_SUFFIX}" | head -1)
if [ -z "${VOLUME_NAME}" ]; then
    echo "ERROR: Volume matching '${VOLUME_SUFFIX}' not found."
    docker volume ls
    exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "=== Restoring volume: ${VOLUME_NAME} ==="
echo "  From: ${BACKUP_FILE}"

read -p "This will DESTROY all data in ${VOLUME_NAME}. Continue? (type 'yes'): " CONFIRM
[ "${CONFIRM}" != "yes" ] && { echo "Aborted."; exit 0; }

# Stop ALL services using this volume
echo "  Stopping all services..."
docker compose down

# Remove and recreate the volume
echo "  Removing volume: ${VOLUME_NAME}"
docker volume rm "${VOLUME_NAME}"
docker volume create "${VOLUME_NAME}"

# Restore from backup
echo "  Extracting backup..."
docker run --rm \
    -v "${VOLUME_NAME}:/data" \
    -v "$(pwd)/$(dirname ${BACKUP_FILE}):/backup:ro" \
    alpine:3.19 \
    tar xzf "/backup/$(basename ${BACKUP_FILE})" -C /

echo "  Volume restored."
echo "  Restart with: docker compose up -d"
```

---

## 6. Migration Rollback Strategy

### The Challenge

GoldLedger's migration approach is **forward-only** with no down-migrations:
- All 31 migration files use `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- They are mounted into PostgreSQL's `docker-entrypoint-initdb.d/` which only runs on first init
- There is no migration runner (like Drizzle Kit `migrate` or Flyway) — just raw SQL files
- No migration tracking table exists — PG doesn't know which migrations have run

### Strategy for Refactoring Migrations

**Rule: The refactoring should NOT add new database migrations.**

The 63-task refactoring plan is primarily about code restructuring (splitting files, adding types, extracting services). Schema changes are not anticipated. If schema changes become necessary:

1. **Create a new numbered migration file** (e.g., `0037_refactoring_indexes.sql`)
2. **Add the mount to `docker-compose.yml`** in the correct sequence
3. **Also write a corresponding rollback SQL file** (e.g., `0037_refactoring_indexes_DOWN.sql`)
4. **Before running the migration**:
   - Take a `pg_dumpall` backup (see checkpoint script)
   - Test the migration on a copy of the database first
5. **The `IF NOT EXISTS` pattern means**: re-running migrations is always safe (idempotent)

### Manual Migration Execution

Since `docker-entrypoint-initdb.d/` only runs on first init, apply new migrations manually:

```bash
# Apply a single new migration to the running database
docker compose exec -T postgres psql \
    -U "${POSTGRES_USER:-app_user}" \
    -d "${POSTGRES_DB:-ai_accountant}" \
    -f - < ./docker/migrations/0037_new_migration.sql

# Verify it worked
docker compose exec postgres psql \
    -U "${POSTGRES_USER:-app_user}" \
    -d "${POSTGRES_DB:-ai_accountant}" \
    -c "\dt" | grep new_table_name
```

### If a Migration Goes Wrong

```bash
# Option A: Apply the DOWN migration
docker compose exec -T postgres psql \
    -U app_user -d ai_accountant \
    -f - < ./docker/migrations/0037_new_migration_DOWN.sql

# Option B: Restore from last checkpoint dump
docker compose exec -T postgres psql \
    -U app_user -d ai_accountant \
    -f - < ./backups/pg-dump-phase-N-YYYYMMDD.sql

# Option C: Full volume restore (nuclear)
./docker/scripts/restore-volume.sh ./backups/postgres-YYYYMMDD.tar.gz postgres-data
docker compose up -d
```

---

## 7. Testing Protocol (Per-Phase Verification)

Before marking any phase as complete, run this full verification:

### 7.1 Quick Smoke Test

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# smoke-test.sh — Quick health check of all services
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

PASS=0
FAIL=0

check() {
    local NAME="$1" CMD="$2"
    printf "  %-30s" "${NAME}..."
    if eval "${CMD}" > /dev/null 2>&1; then
        echo "PASS"
        ((PASS++))
    else
        echo "FAIL"
        ((FAIL++))
    fi
}

echo "=== GoldLedger Docker Smoke Test ==="
echo ""

# Service health
check "PostgreSQL healthy" "docker compose ps postgres | grep -q healthy"
check "Redis healthy" "docker compose ps redis | grep -q healthy"
check "Server running" "docker compose ps server | grep -q running"
check "Client running" "docker compose ps client | grep -q running"
check "Cognee running" "docker compose ps cognee | grep -q running"

# HTTP endpoints
check "Server /health" "curl -sf http://localhost:3501/health"
check "Client http" "curl -sf http://localhost:8080"
check "Cognee /api/v1/settings" "curl -sf http://localhost:8000/api/v1/settings"

# API proxy through nginx
check "Client → Server proxy" "curl -sf http://localhost:8080/api/events -o /dev/null -w '%{http_code}' | grep -q '200\|401'"

# Database connectivity
check "PG: ai_accountant tables" "docker compose exec -T postgres psql -U app_user -d ai_accountant -c '\dt' | grep -q transactions"
check "PG: cognee_db exists" "docker compose exec -T postgres psql -U app_user -d cognee_db -c '\dt' 2>/dev/null || docker compose exec -T postgres psql -U app_user -d postgres -c \"SELECT 1 FROM pg_database WHERE datname='cognee_db'\" | grep -q 1"

# Redis connectivity
check "Redis PING" "docker compose exec -T redis redis-cli ping | grep -q PONG"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
[ "${FAIL}" -eq 0 ] && echo "All checks passed!" || { echo "Some checks FAILED — investigate before proceeding."; exit 1; }
```

### 7.2 Full Verification (Build + Test + Docker)

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# full-verify.sh — Full verification before phase checkpoint
# Run from: project root
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

PASS=0
FAIL=0
SKIP=0

run_check() {
    local NAME="$1"
    shift
    printf "  %-40s" "${NAME}..."
    if "$@" > /tmp/verify-output.log 2>&1; then
        echo "PASS"
        ((PASS++))
    else
        echo "FAIL (see /tmp/verify-output.log)"
        ((FAIL++))
    fi
}

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   GoldLedger Full Verification                        ║"
echo "╚═══════════════════════════════════════════════════════╝"

# Local checks (outside Docker)
echo ""
echo "─── Local TypeScript Checks ───"
run_check "Server tsc --noEmit"    bash -c "cd server && npx tsc --noEmit"
run_check "Client tsc --noEmit"    bash -c "cd client && npx tsc --noEmit"

echo ""
echo "─── Local Tests ───"
run_check "Server npm test"        bash -c "cd server && npm test"

echo ""
echo "─── Client Build ───"
run_check "Client npm run build"   bash -c "cd client && npm run build"

echo ""
echo "─── Docker Build ───"
run_check "docker compose build"   docker compose build

echo ""
echo "─── Docker Up ───"
docker compose up -d
sleep 10  # Wait for services to start

echo ""
echo "─── Docker Health ───"
run_check "All services healthy"   bash -c "docker compose ps | grep -v healthy | grep -c running | grep -q '^0$'" || true

echo ""
echo "─── Smoke Test ───"
run_check "Smoke test"             bash ./docker/scripts/smoke-test.sh

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped"
echo "═══════════════════════════════════════════════════════"
[ "${FAIL}" -eq 0 ] && echo "  VERDICT: READY FOR CHECKPOINT" || echo "  VERDICT: FIX FAILURES BEFORE CHECKPOINT"
```

---

## 8. Cognee-Specific Considerations

### 8.1 Cognee is Built from Source

The Cognee service is built from `./cognee-repo/Dockerfile` — a cloned GitHub repo. This creates versioning risks:

**Mitigation:**
- The pre-refactor image tag captures the exact Cognee build
- `cognee-repo/` should be **pinned to a specific commit** during refactoring:
  ```bash
  cd cognee-repo && git log -1 --format="%H %s" > ../backups/cognee-commit.txt
  ```
- Do NOT `git pull` in cognee-repo during refactoring unless required
- If Cognee needs an upgrade, do it as a separate, isolated change

### 8.2 Cognee Data Locations — Three Stores Problem

Cognee stores data across **three separate stores**. A rollback must account for all of them, or you get cross-store inconsistency:

| Store | Location | Backup Method | Included in pg_dumpall? |
|-------|----------|---------------|------------------------|
| Vector embeddings (pgvector) | `postgres / cognee_db` | pg_dumpall | **Yes** |
| Relational metadata | `postgres / cognee_db` tables | pg_dumpall | **Yes** |
| Knowledge graph (Kuzu) | `cognee-data:/app/.cognee_system` | Volume tar only | **No** |
| Cognee config/state | `cognee-data:/app/.cognee_system` | Volume tar only | **No** |
| Session/rate-limit cache | `redis-data:/data` | Redis backup | **No** (ephemeral — loss acceptable) |

**Consistency implication**: A Tier 1 rollback (`pg_dumpall` restore) restores the PostgreSQL side of Cognee (embeddings + metadata) but leaves the Kuzu graph store untouched. This means Kuzu may reference entities that no longer exist in PG, or PG may have data that Kuzu hasn't indexed yet. This is **acceptable** because:

1. Kuzu is a derived store — it can be rebuilt from PG source data via `cognify`
2. Search results may be stale but won't cause errors (Cognee handles missing references gracefully)
3. The refactoring does not modify Cognee's data — only GoldLedger's `ai_accountant` database

For **perfect atomic consistency** (Tier 2 / nuclear), use volume-level restores for ALL three stores simultaneously.

### 8.3 Cognee Consistency Restoration After Rollback

After any Tier 1 rollback, run this sequence to ensure Cognee is consistent:

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# restore-cognee-consistency.sh — Rebuild Cognee graph after rollback
# Run AFTER a pg_dumpall restore to sync Kuzu with restored PG data
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

COGNEE_URL="${COGNEE_API_URL:-http://localhost:8000}"

echo "=== Cognee Consistency Restoration ==="

# Step 1: Verify Cognee is healthy
echo "  [1/4] Checking Cognee health..."
curl -sf "${COGNEE_URL}/api/v1/settings" > /dev/null || \
    { echo "  FAIL: Cognee not reachable at ${COGNEE_URL}"; exit 1; }
echo "    Cognee is healthy."

# Step 2: List current datasets
echo "  [2/4] Listing datasets..."
curl -sf "${COGNEE_URL}/api/v1/datasets" | python3 -m json.tool 2>/dev/null || \
    echo "    (Could not list datasets — Cognee may need auth)"

# Step 3: Flush Redis cache (stale after rollback)
echo "  [3/4] Flushing Redis cache..."
docker compose exec -T redis redis-cli FLUSHDB 2>/dev/null && \
    echo "    Redis cache flushed." || \
    echo "    WARN: Could not flush Redis (may need manual: redis-cli FLUSHDB)"

# Step 4: Trigger re-cognify to rebuild Kuzu graph from PG data
echo "  [4/4] Triggering Cognee re-index (background)..."
curl -sf -X POST "${COGNEE_URL}/api/v1/cognify" \
    -H "Content-Type: application/json" \
    -d '{"datasets": [], "run_in_background": true}' && \
    echo "    Re-cognify triggered (running in background)." || \
    echo "    WARN: Cognify trigger failed — may need manual re-index."

echo ""
echo "=== Cognee consistency restoration initiated ==="
echo "  Monitor progress: curl ${COGNEE_URL}/api/v1/datasets"
echo "  Re-indexing may take 10-30 minutes depending on data volume."
```

### 8.4 When to Use Full (Tier 2) Cognee Restore

Use the volume-level restore for Cognee ONLY if:
- Kuzu graph is corrupted (Cognee errors on graph queries)
- Re-cognify fails repeatedly
- You need to restore Cognee to a specific historical state (not just sync with PG)

```bash
# Nuclear Cognee restore
docker compose stop cognee
./docker/scripts/restore-volume.sh ./backups/cognee-YYYYMMDD.tar.gz cognee-data
docker compose start cognee
# Wait for healthy (60s+ start period)
timeout 180 bash -c 'until curl -sf http://localhost:8000/api/v1/settings; do sleep 5; done'
```

---

## 9. Recovery Time Estimates

| Scenario | Recovery Method | Estimated Time |
|----------|----------------|----------------|
| Service crash (single) | `docker compose restart <service>` | 10–30 seconds |
| Bad code deploy | Retag images + restart | 1–2 minutes |
| Database corruption (minor) | SQL dump restore | 2–5 minutes |
| Full volume restore | Stop + restore tar + restart | 5–10 minutes |
| Complete rollback (all services + data) | Full rollback script | 5–15 minutes |
| Cognee re-index (if knowledge graph lost) | Re-cognify all datasets | 10–30 minutes |
| Fresh rebuild from scratch | `docker compose up --build -d` | 10–20 minutes (build time) |

---

## 10. Recommended Directory Structure for Scripts

```
docker/
├── scripts/
│   ├── tag-pre-refactor.sh      # Tag all images before refactoring
│   ├── snapshot-all.sh           # Full pre-refactor snapshot
│   ├── backup-postgres.sh        # Backup postgres volume
│   ├── backup-cognee.sh          # Backup cognee volume
│   ├── backup-redis.sh           # Backup redis volume
│   ├── checkpoint.sh             # Create per-phase checkpoint
│   ├── rollback.sh               # Emergency rollback to checkpoint
│   ├── restore-volume.sh         # Nuclear volume restore
│   ├── smoke-test.sh             # Quick health check
│   └── full-verify.sh            # Full build + test + docker verify
├── migrations/
│   ├── 0009_complete_schema.sql  # ... existing ...
│   ├── ...
│   └── 0036_pwa_support.sql
├── init-cognee-db.sql
└── init-cognee-db.sh
```

All scripts should have:
```bash
chmod +x docker/scripts/*.sh
```

**IMPORTANT**: Ensure all scripts use LF line endings (not CRLF). This is critical for WSL/Docker on Windows:
```bash
# Fix line endings if needed
sed -i 's/\r$//' docker/scripts/*.sh
```

---

## 11. Environment Variable Safety

### Secrets in docker-compose.yml

The compose file references these secrets via `${VAR}` interpolation from `.env`:

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `POSTGRES_PASSWORD` | **YES** | (none) | DB auth — MUST be set |
| `JWT_SECRET` | **YES** | (none) | Auth tokens — MUST be set |
| `ANTHROPIC_API_KEY` | For AI | (none) | Claude agent calls |
| `VITE_OPENROUTER_API_KEY` | For AI | (none) | Used by both server + Cognee |
| `TFN_ENCRYPTION_KEY` | Prod | Default placeholder | **NEVER use default in prod** |
| `PAYMENT_ENCRYPTION_KEY` | Prod | Default placeholder | **NEVER use default in prod** |
| `BANK_ENCRYPTION_KEY` | Prod | Default placeholder | **NEVER use default in prod** |

### Backup Safety

**NEVER include `.env` in backups that leave the machine.** The backup scripts only capture volumes and SQL dumps — no secrets.

---

## 12. Known Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migrations are forward-only (no DOWN files) | **High** | SQL dump restore is the rollback path. Write DOWN files for any new migrations. |
| `docker-entrypoint-initdb.d` is one-shot | **Medium** | New migrations must be applied manually. Document in the checkpoint script. |
| Cognee built from unversioned repo clone | **High** | Pin to commit hash. Tag image. Do NOT update during refactoring. |
| Volume tar backup requires service downtime | **Medium** | pg_dumpall (logical backup) can run live. Use that as primary. |
| `.env` contains hardcoded default encryption keys | **Critical** | Fix in REFACTOR-009. For now, document that defaults are dev-only. |
| WSL CRLF line endings break shell scripts | **Medium** | All scripts must use LF. Add `.gitattributes` rule. |
| Seed data in migrations (0035) has no ON CONFLICT | **Low** | Migrations only run once. But pg_dumpall restore replays them — use `--clean --if-exists`. |
| Redis data is ephemeral (session cache) | **Low** | Redis loss is acceptable — sessions re-create. Backup is optional. |
| No migration tracking table | **Medium** | Idempotent SQL (`IF NOT EXISTS`) compensates. Consider adding Drizzle Kit in Phase 2. |

---

*End of Docker Rollback Plan v1.0*
