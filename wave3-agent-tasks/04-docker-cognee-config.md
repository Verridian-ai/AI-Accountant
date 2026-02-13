# Agent 4: Docker Cognee Configuration

## Role
Update Docker Compose configuration to enable Cognee multi-user authentication, backend access control, and Redis caching integration.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to MODIFY

### 1. `docker-compose.yml`
**Purpose**: Update Cognee service environment variables for multi-user support + Redis caching
**CRITICAL**: Read the entire file first. Preserve ALL existing env vars. Only CHANGE or ADD the ones listed below.

#### Step 1: Change existing Cognee env vars
Find these lines in the `cognee` service environment section and CHANGE their values:

```yaml
# BEFORE:
- REQUIRE_AUTHENTICATION=false
- ENABLE_BACKEND_ACCESS_CONTROL=false

# AFTER:
- REQUIRE_AUTHENTICATION=true
- ENABLE_BACKEND_ACCESS_CONTROL=true
```

#### Step 2: Add new Cognee env vars for Redis caching
Add these AFTER the existing env vars in the `cognee` service:

```yaml
# Wave 3: Redis caching for Cognee
- CACHING=true
- CACHE_BACKEND=redis
- CACHE_HOST=redis
- CACHE_PORT=6379
```

#### Step 3: Add Redis dependency to Cognee service
Ensure the `cognee` service has `redis` in its `depends_on`:

```yaml
cognee:
  # ...existing config...
  depends_on:
    - postgres
    - redis   # ← ADD this if not present
```

#### Step 4: Add admin credentials env vars
Add Cognee admin credentials as env vars so they're configurable (not hardcoded):

```yaml
# Wave 3: Admin credentials (used by CogneeClient for admin operations)
- COGNEE_ADMIN_EMAIL=${COGNEE_ADMIN_EMAIL:-admin@cognee-cba.dev}
- COGNEE_ADMIN_PASSWORD=${COGNEE_ADMIN_PASSWORD:-CbaAdmin2026}
```

#### Step 5: Add migration for Wave 3
Ensure the migration file `0015_cognee_multi_user.sql` will be picked up by the migration runner. Check how existing migrations are mounted/executed in the Docker setup.

If migrations are mounted via volume in the `postgres` service's `initdb.d`:
```yaml
postgres:
  volumes:
    - ./docker/migrations:/docker-entrypoint-initdb.d/migrations
```

**Note**: `initdb.d` only runs on first database creation. For existing databases, migrations must be applied manually or via a migration runner script. Document this in a comment.

### 2. `.env` or `.env.example` (if exists)
**Purpose**: Add new environment variables documentation

Add these entries if an env file exists:
```bash
# Wave 3: Cognee admin credentials
COGNEE_ADMIN_EMAIL=admin@cognee-cba.dev
COGNEE_ADMIN_PASSWORD=CbaAdmin2026

# Wave 3: TFN encryption key (used in Wave 4 — added early for forward compat)
# TFN_ENCRYPTION_KEY=  # Generate with: openssl rand -hex 32
```

## Backward Compatibility Notes
- When `ENABLE_BACKEND_ACCESS_CONTROL=true`, Cognee enforces per-user dataset access
- Existing admin token still works for admin operations (creating users, listing all datasets)
- If Cognee container is recreated but DB persists, the admin user must be re-created
- Redis cache is additive — existing Cognee functionality is unaffected if cache misses

## Verification
- [ ] `docker compose config` validates without errors
- [ ] Cognee service lists `redis` in `depends_on`
- [ ] `REQUIRE_AUTHENTICATION=true` is set
- [ ] `ENABLE_BACKEND_ACCESS_CONTROL=true` is set
- [ ] Cache env vars (CACHING, CACHE_BACKEND, CACHE_HOST, CACHE_PORT) are present
- [ ] All other existing env vars are preserved unchanged
- [ ] Create marker file: `.agent-done-W03-04`

## Dependencies
- **None** — can start immediately (docker-compose.yml is independent)
- **Note**: Changes won't take effect until `docker compose up -d --force-recreate cognee`
