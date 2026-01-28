# =============================================================================
# Dockerfile for Hono Backend - Optimized for Google Cloud Run
# =============================================================================

FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache curl tzdata python3 make g++ && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files and install dependencies
COPY server/package*.json ./
RUN npm ci && npm cache clean --force

# Copy source code
COPY server/src ./src
COPY server/tsconfig.json ./
COPY server/drizzle ./drizzle

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Cloud Run configuration
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Use tsx to run TypeScript directly (avoids compilation issues)
CMD ["npx", "tsx", "src/index.ts"]
