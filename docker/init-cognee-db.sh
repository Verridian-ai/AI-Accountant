#!/bin/bash
# =============================================================================
# Create Cognee database and enable extensions
# Runs as part of PostgreSQL container initialization
# =============================================================================
set -e

echo "Creating cognee_db database for Cognee knowledge graph..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create cognee_db if it doesn't exist
    SELECT 'CREATE DATABASE cognee_db OWNER $POSTGRES_USER'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cognee_db')\gexec
EOSQL

# Enable vector extension in cognee_db
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "cognee_db" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "vector";
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL

echo "Cognee database initialized successfully."
