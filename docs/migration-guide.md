# SQLite to PostgreSQL Migration Guide

This guide walks through migrating the AI Accountant application from SQLite to Cloud SQL PostgreSQL.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Backup SQLite Database](#backup-sqlite-database)
4. [Set Up Cloud SQL PostgreSQL](#set-up-cloud-sql-postgresql)
5. [Run the Migration](#run-the-migration)
6. [Verify Data Integrity](#verify-data-integrity)
7. [Update Application Configuration](#update-application-configuration)
8. [Post-Migration Tasks](#post-migration-tasks)
9. [Rollback Procedure](#rollback-procedure)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

1. **Google Cloud SDK (gcloud CLI)**
   ```bash
   # Install on macOS
   brew install google-cloud-sdk

   # Install on Windows
   # Download from: https://cloud.google.com/sdk/docs/install

   # Verify installation
   gcloud --version
   ```

2. **Cloud SQL Proxy** (for secure local connections)
   ```bash
   # macOS/Linux
   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
   chmod +x cloud-sql-proxy

   # Windows
   # Download from: https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.x64.exe
   ```

3. **PostgreSQL Client** (psql)
   ```bash
   # macOS
   brew install postgresql

   # Windows
   # Included with PostgreSQL installation or use pgAdmin
   ```

4. **Node.js 18+** and the `pg` package
   ```bash
   cd server
   npm install pg
   ```

### Required Permissions

- Google Cloud project with Cloud SQL Admin API enabled
- IAM roles: `Cloud SQL Client`, `Cloud SQL Admin`
- Service account key for Cloud SQL Proxy (if not using gcloud auth)

---

## Pre-Migration Checklist

Before starting the migration:

- [ ] Notify users of planned maintenance window
- [ ] Ensure no active writes to the SQLite database
- [ ] Document current database size and row counts
- [ ] Review and test the migration script in a dev environment
- [ ] Prepare rollback plan
- [ ] Have backup restoration procedures ready

### Estimate Migration Time

```bash
# Check current SQLite database size
ls -lh server/sqlite.db

# Count rows in major tables
sqlite3 server/sqlite.db "SELECT 'transactions', COUNT(*) FROM transactions UNION ALL SELECT 'statements', COUNT(*) FROM statements UNION ALL SELECT 'accounts', COUNT(*) FROM accounts;"
```

Approximate migration times:
- < 10,000 transactions: ~1-2 minutes
- 10,000-100,000 transactions: ~5-15 minutes
- 100,000+ transactions: ~30+ minutes

---

## Backup SQLite Database

### Create Backup

```bash
# Navigate to server directory
cd server

# Create timestamped backup
cp sqlite.db "sqlite_backup_$(date +%Y%m%d_%H%M%S).db"

# Verify backup
sqlite3 "sqlite_backup_$(date +%Y%m%d_%H%M%S).db" "PRAGMA integrity_check;"
```

### Store Backup Safely

```bash
# Upload to Google Cloud Storage (recommended)
gsutil cp sqlite_backup_*.db gs://your-bucket/backups/

# Or copy to secure location
cp sqlite_backup_*.db /path/to/secure/backup/location/
```

---

## Set Up Cloud SQL PostgreSQL

### Create Cloud SQL Instance

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Create PostgreSQL 15 instance
gcloud sql instances create ai-accountant-prod \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=australia-southeast1 \
    --storage-type=SSD \
    --storage-size=10GB \
    --storage-auto-increase \
    --backup-start-time=02:00 \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=03 \
    --availability-type=regional \
    --enable-point-in-time-recovery

# Note: For production, use at least db-g1-small tier
```

### Create Database and User

```bash
# Create database
gcloud sql databases create ai_accountant --instance=ai-accountant-prod

# Create application user
gcloud sql users create ai_accountant_app \
    --instance=ai-accountant-prod \
    --password="GENERATE_STRONG_PASSWORD_HERE"

# Store password securely in Secret Manager
echo -n "YOUR_PASSWORD" | gcloud secrets create db-password --data-file=-
```

### Start Cloud SQL Proxy

```bash
# Authenticate (if not already)
gcloud auth application-default login

# Start proxy (keep running in terminal)
./cloud-sql-proxy YOUR_PROJECT_ID:australia-southeast1:ai-accountant-prod \
    --port=5432 \
    --address=127.0.0.1
```

### Apply Schema Migration

```bash
# Connect via psql through proxy
psql "host=127.0.0.1 port=5432 dbname=ai_accountant user=ai_accountant_app"

# Run the schema migration
\i server/drizzle/0006_postgres_migration.sql

# Verify tables were created
\dt

# Exit psql
\q
```

---

## Run the Migration

### Set Environment Variables

Create a `.env.migration` file (do not commit to git):

```bash
# SQLite source
SQLITE_URL=file:sqlite.db

# PostgreSQL target (via Cloud SQL Proxy)
PG_HOST=127.0.0.1
PG_PORT=5432
PG_DATABASE=ai_accountant
PG_USER=ai_accountant_app
PG_PASSWORD=your_secure_password
PG_SSL=false  # Proxy handles encryption
```

### Dry Run (Recommended)

```bash
# Load environment variables
export $(cat .env.migration | xargs)

# Run migration in dry-run mode
npx tsx server/drizzle/migrate-to-postgres.ts --dry-run
```

Review the output to ensure:
- All tables are detected
- Row counts are as expected
- No errors are reported

### Execute Migration

```bash
# Run the actual migration
npx tsx server/drizzle/migrate-to-postgres.ts

# When prompted, type 'yes' to confirm
```

### Migration Options

```bash
# Migrate specific table only
npx tsx server/drizzle/migrate-to-postgres.ts --table=transactions

# Adjust batch size for large tables
npx tsx server/drizzle/migrate-to-postgres.ts --batch-size=5000
```

---

## Verify Data Integrity

### Row Count Verification

```bash
# Connect to PostgreSQL
psql "host=127.0.0.1 port=5432 dbname=ai_accountant user=ai_accountant_app"
```

```sql
-- Compare row counts with SQLite
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL SELECT 'statements', COUNT(*) FROM statements
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'transfer_links', COUNT(*) FROM transfer_links
ORDER BY table_name;
```

### Financial Data Verification

```sql
-- Verify transaction amounts are valid integers (cents)
SELECT COUNT(*) as invalid_amounts
FROM transactions
WHERE amount IS NULL OR amount != ROUND(amount);

-- Check for balance integrity
SELECT
    account_id,
    SUM(amount) as calculated_balance,
    (SELECT current_balance FROM accounts WHERE id = t.account_id) as stored_balance
FROM transactions t
WHERE account_id IS NOT NULL
GROUP BY account_id
HAVING SUM(amount) != (SELECT current_balance FROM accounts WHERE id = t.account_id);

-- Verify statement balances
SELECT
    id,
    cents_to_dollars(opening_balance) as opening_aud,
    cents_to_dollars(closing_balance) as closing_aud,
    transaction_count
FROM statements
WHERE opening_balance IS NOT NULL
LIMIT 10;
```

### Spot Check Records

```sql
-- Sample transactions to verify data quality
SELECT
    id,
    date,
    description,
    cents_to_dollars(amount) as amount_aud,
    cents_to_dollars(balance) as balance_aud,
    category,
    gst_applicable
FROM transactions
ORDER BY date DESC
LIMIT 20;
```

---

## Update Application Configuration

### Update Environment Variables

Create or update your `.env.local` or production environment:

```bash
# Database Configuration - PostgreSQL
DATABASE_TYPE=postgres

# Cloud SQL Direct Connection (for Cloud Run)
DB_HOST=/cloudsql/YOUR_PROJECT_ID:australia-southeast1:ai-accountant-prod
DB_NAME=ai_accountant
DB_USER=ai_accountant_app
DB_PASSWORD=your_secure_password

# Or for Cloud SQL Proxy
DB_HOST=127.0.0.1
DB_PORT=5432

# Connection Pool Settings
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=30000

# SSL (true for direct connection, false for proxy)
DB_SSL=true
```

### Update Application Code

The application should now use the PostgreSQL connection:

```typescript
// server/src/db.ts - Update to use PostgreSQL
import { getDb } from './db/postgres-connection';

export const db = getDb();
```

### Cloud Run Configuration

For Cloud Run deployments, add the Cloud SQL connection:

```yaml
# cloudbuild.yaml or Cloud Run configuration
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cloudsql-instances: YOUR_PROJECT_ID:australia-southeast1:ai-accountant-prod
```

---

## Post-Migration Tasks

### 1. Update Indexes (if needed)

```sql
-- Analyze tables for query optimization
ANALYZE;

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### 2. Set Up Monitoring

```bash
# Enable Cloud SQL insights
gcloud sql instances patch ai-accountant-prod \
    --insights-config-query-insights-enabled \
    --insights-config-record-application-tags \
    --insights-config-record-client-address
```

### 3. Configure Backups

```bash
# Verify backup configuration
gcloud sql instances describe ai-accountant-prod --format="value(settings.backupConfiguration)"

# Create on-demand backup
gcloud sql backups create --instance=ai-accountant-prod
```

### 4. Remove SQLite Files (after validation period)

Wait at least 1-2 weeks before removing SQLite files:

```bash
# Archive SQLite database
mv server/sqlite.db server/sqlite_archived_$(date +%Y%m%d).db

# Remove after validation period
rm server/sqlite_archived_*.db
```

---

## Rollback Procedure

If issues are discovered after migration:

### Immediate Rollback (within 24 hours)

1. **Stop the application**
   ```bash
   # Stop Cloud Run service
   gcloud run services update ai-accountant --no-traffic
   ```

2. **Restore SQLite configuration**
   ```bash
   # Restore environment variables to use SQLite
   # Update .env.local:
   DATABASE_TYPE=sqlite
   ```

3. **Restore SQLite backup**
   ```bash
   cp sqlite_backup_TIMESTAMP.db sqlite.db
   ```

4. **Restart application**
   ```bash
   gcloud run services update ai-accountant --to-latest
   ```

### Late Rollback (after 24 hours)

If data was written to PostgreSQL after migration:

1. Export new data from PostgreSQL
2. Restore SQLite backup
3. Manually merge new records
4. Consider this only as last resort

---

## Troubleshooting

### Connection Issues

**Error: Connection refused**
```bash
# Verify Cloud SQL Proxy is running
ps aux | grep cloud-sql-proxy

# Check proxy logs for errors
./cloud-sql-proxy --help
```

**Error: SSL required**
```bash
# Set SSL mode
export PGSSLMODE=require
```

### Migration Errors

**Error: Duplicate key violation**
```sql
-- Check for duplicates
SELECT id, COUNT(*)
FROM transactions
GROUP BY id
HAVING COUNT(*) > 1;

-- Clear and re-run with ON CONFLICT
TRUNCATE transactions CASCADE;
```

**Error: Foreign key constraint**
```bash
# Run migration in dependency order
npx tsx server/drizzle/migrate-to-postgres.ts --table=users
npx tsx server/drizzle/migrate-to-postgres.ts --table=accounts
npx tsx server/drizzle/migrate-to-postgres.ts --table=statements
npx tsx server/drizzle/migrate-to-postgres.ts --table=transactions
```

### Performance Issues

**Slow queries after migration**
```sql
-- Rebuild indexes
REINDEX DATABASE ai_accountant;

-- Update statistics
ANALYZE VERBOSE;
```

### Data Type Issues

**Boolean conversion problems**
```sql
-- Check for non-boolean values
SELECT DISTINCT gst_applicable FROM transactions WHERE gst_applicable NOT IN (true, false);

-- Fix if needed
UPDATE transactions SET gst_applicable = false WHERE gst_applicable IS NULL;
```

---

## Support

For additional help:
- Review PostgreSQL logs: `gcloud sql operations list --instance=ai-accountant-prod`
- Check Cloud SQL documentation: https://cloud.google.com/sql/docs/postgres
- Contact the development team

---

## Appendix: Currency Handling

The application stores all currency values as **integers representing cents** to avoid floating-point precision issues.

### Converting for Display

```sql
-- Use the helper function
SELECT cents_to_dollars(amount) as amount_aud FROM transactions;

-- Or manual conversion
SELECT amount / 100.0 as amount_aud FROM transactions;
```

### Converting for Storage

```typescript
// In application code
const amountCents = Math.round(amountDollars * 100);
```

### GST Calculations

Australian GST is 10%. For a GST-inclusive amount:
- GST component = Amount / 11
- GST-exclusive amount = Amount - (Amount / 11)

```sql
SELECT
    cents_to_dollars(amount) as total_aud,
    cents_to_dollars(calculate_gst(amount)) as gst_aud,
    cents_to_dollars(amount - calculate_gst(amount)) as ex_gst_aud
FROM transactions
WHERE gst_applicable = true;
```
