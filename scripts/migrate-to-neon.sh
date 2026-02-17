#!/bin/bash
set -euo pipefail

# =============================================================================
# GoldLedger: Local PostgreSQL -> Neon Cloud Migration
# =============================================================================
# Uses Docker postgres container's pg_dump/psql for both dump AND import.
# No local psql required.
# =============================================================================

PROJECT_ROOT="/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
cd "$PROJECT_ROOT"

# Read .env (strip CR/whitespace from Windows line endings)
NEON_URL=$(grep '^NEON_DATABASE_URL=' .env | cut -d'=' -f2- | tr -d '\r\n ')
LOCAL_USER=$(grep '^POSTGRES_USER=' .env | cut -d'=' -f2- | tr -d '\r\n ')
LOCAL_DB=$(grep '^POSTGRES_DB=' .env | cut -d'=' -f2- | tr -d '\r\n ')
[ -z "$LOCAL_USER" ] && LOCAL_USER="app_user"
[ -z "$LOCAL_DB" ] && LOCAL_DB="ai_accountant"

if [ -z "$NEON_URL" ]; then
  echo "ERROR: NEON_DATABASE_URL not set in .env"
  exit 1
fi

echo "=== GoldLedger: Local -> Neon Cloud Migration ==="
echo ""
echo "Local: $LOCAL_USER@docker/$LOCAL_DB"
echo "Neon:  neondb_owner@neon/neondb"
echo ""

# Helper: run psql command against Neon via the Docker container
neon_psql() {
  docker compose exec -T postgres psql "$NEON_URL" "$@"
}

# Helper: local psql
local_psql() {
  docker compose exec -T postgres psql -U "$LOCAL_USER" -d "$LOCAL_DB" "$@"
}

# Step 1: Verify local DB
echo "[1/5] Verifying local database..."
LOCAL_TABLE_COUNT=$(local_psql -t -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'" | tr -d ' \n')
LOCAL_TX_COUNT=$(local_psql -t -c "SELECT count(*) FROM transactions" | tr -d ' \n')
echo "   Local: $LOCAL_TABLE_COUNT tables, $LOCAL_TX_COUNT transactions"

# Step 2: Verify Neon connectivity
echo "[2/5] Verifying Neon Cloud connectivity..."
NEON_VERSION=$(neon_psql -t -c "SELECT version()" | head -1 | tr -d ' ')
echo "   Neon: Connected (${NEON_VERSION:0:30}...)"

# Step 3: Drop existing Neon tables (clean slate)
echo "[3/5] Cleaning Neon Cloud (drop existing tables)..."
EXISTING_TABLES=$(neon_psql -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public'" | tr -d ' ' | grep -v '^$' || true)
if [ -n "$EXISTING_TABLES" ]; then
  for tbl in $EXISTING_TABLES; do
    neon_psql -c "DROP TABLE IF EXISTS \"$tbl\" CASCADE" 2>/dev/null || true
  done
  echo "   Dropped existing tables."
else
  echo "   No existing tables to drop."
fi

# Also drop sequences and types that might conflict
neon_psql -c "
DO \$\$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequencename) || ' CASCADE';
  END LOOP;
  FOR r IN SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e' LOOP
    EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;
END \$\$;
" 2>/dev/null || true
echo "   Cleaned sequences and custom types."

# Step 4: Dump local schema and pipe directly to Neon
echo "[4/5] Migrating schema to Neon Cloud..."
docker compose exec -T postgres pg_dump \
  -U "$LOCAL_USER" -d "$LOCAL_DB" \
  --schema-only --no-owner --no-privileges --no-comments --no-tablespaces \
  --no-security-labels \
  | grep -v '^\\\restrict' \
  | grep -v '^CREATE EXTENSION' \
  | grep -v '^COMMENT ON EXTENSION' \
  | docker compose exec -T postgres psql "$NEON_URL" -v ON_ERROR_STOP=0 2>&1 \
  | grep -c 'ERROR' || true

# Verify schema
NEON_TABLE_COUNT=$(neon_psql -t -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'" | tr -d ' \n')
echo "   Schema: $NEON_TABLE_COUNT tables created in Neon"

# Step 5: Dump local data and pipe directly to Neon
echo "[5/5] Migrating data to Neon Cloud..."
docker compose exec -T postgres pg_dump \
  -U "$LOCAL_USER" -d "$LOCAL_DB" \
  --data-only --no-owner --no-privileges --disable-triggers \
  | grep -v '^\\\restrict' \
  | docker compose exec -T postgres psql "$NEON_URL" -v ON_ERROR_STOP=0 2>&1 \
  | grep -c 'ERROR' || true

echo "   Data import complete."

# Verification
echo ""
echo "=== Verification ==="
neon_psql -c "
SELECT 'transactions' as table_name, count(*) as row_count FROM transactions
UNION ALL SELECT 'accounts', count(*) FROM accounts
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'statements', count(*) FROM statements
UNION ALL SELECT 'journal_entries', count(*) FROM journal_entries
UNION ALL SELECT 'chart_of_accounts', count(*) FROM chart_of_accounts
ORDER BY table_name;
" 2>/dev/null || echo "   (verification query had errors)"

FINAL_TABLES=$(neon_psql -t -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'" | tr -d ' \n')
FINAL_TX=$(neon_psql -t -c "SELECT count(*) FROM transactions" 2>/dev/null | tr -d ' \n' || echo "0")

echo ""
echo "=== Summary ==="
echo "Local:  $LOCAL_TABLE_COUNT tables, $LOCAL_TX_COUNT transactions"
echo "Neon:   $FINAL_TABLES tables, $FINAL_TX transactions"

if [ "$LOCAL_TABLE_COUNT" = "$FINAL_TABLES" ] && [ "$LOCAL_TX_COUNT" = "$FINAL_TX" ]; then
  echo ""
  echo "SUCCESS: Migration verified - all tables and data transferred!"
else
  echo ""
  echo "WARNING: Table or row counts differ. Check above for errors."
fi

echo ""
echo "=== Migration Complete ==="
