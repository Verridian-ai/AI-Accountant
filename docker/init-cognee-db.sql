-- =============================================================================
-- Initialize extensions in the main CBA database (ai_accountant)
-- Runs automatically on first postgres container start
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
