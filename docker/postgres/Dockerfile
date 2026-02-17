# =============================================================================
# Custom PostgreSQL 17 + pgvector + postgresql_anonymizer
# Base: pgvector/pgvector:pg17 (Debian bookworm)
# Adds: Dalibo postgresql_anonymizer extension for data masking
# =============================================================================
FROM pgvector/pgvector:pg17

# Install the postgresql_anonymizer extension from Dalibo Labs apt repo
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      gnupg \
      lsb-release && \
    # Add Dalibo Labs repository
    echo "deb https://apt.dalibo.org/labs $(lsb_release -cs)-dalibo/ main" > /etc/apt/sources.list.d/dalibo.list && \
    curl -fsSL https://apt.dalibo.org/labs/debian-dalibo.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/dalibo.gpg && \
    apt-get update && \
    # Install the anonymizer extension for PG17
    apt-get install -y --no-install-recommends postgresql-17-anonymizer && \
    # Clean up
    apt-get purge -y curl gnupg lsb-release && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
