# DevOps & Infrastructure Patterns

## Overview
This skill covers containerization with Docker, GitHub Actions CI/CD pipelines, environment configuration, deployment strategies, and infrastructure patterns for Node.js + React applications. Covers local development, staging, and production workflows.

## Key Patterns

### Pattern 1: Multi-Stage Dockerfile for Node.js Backend
Multi-stage builds produce lean production images by separating build and runtime environments.

```dockerfile
# Dockerfile.server (for Node.js/Hono backend)

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY server/package*.json ./
COPY server/tsconfig.json ./
COPY server/src ./src

# Install dependencies (including devDependencies for build)
RUN npm ci

# Build TypeScript to JavaScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy only necessary files from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3501/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3501

# Start application
CMD ["node", "dist/index.js"]
```

**Why this approach**:
- **Two stages**: Build stage includes compilation tools; runtime stage only includes runtime
- **Non-root user**: Prevents container escape attacks
- **Health check**: Orchestrators (Docker Compose, Kubernetes) can detect crashed containers
- **Alpine base**: ~40MB vs ~400MB with full Node image
- **Minimal final image**: Only production dependencies included

### Pattern 2: Docker Compose for Local Development
Multi-service orchestration for local development matching production topology.

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: pgvector/pgvector:pg17-latest
    environment:
      POSTGRES_DB: ai_accountant
      POSTGRES_PASSWORD: ${DB_PASSWORD:-dev}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  server:
    build:
      context: .
      dockerfile: server/Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:dev@postgres:5432/ai_accountant
      REDIS_URL: redis://redis:6379
      PORT: 3501
    ports:
      - "3501:3501"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./server/src:/app/src  # Hot reload in development
    command: npm run dev

  client:
    build:
      context: .
      dockerfile: client/Dockerfile
    environment:
      VITE_API_URL: http://localhost:3501
    ports:
      - "8080:80"
    depends_on:
      - server

  cognee:
    image: cognee/cognee:latest
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      POSTGRES_DB_URL: postgresql://postgres:dev@postgres:5432/cognee_db
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

**Key features**:
- **Service discovery**: Services reference each other by hostname (e.g., `postgres:5432`)
- **Health checks**: Prevent dependent services from starting before dependencies are ready
- **Volume mounts**: Development volumes for hot reload; data volumes for persistence
- **Environment variables**: Externalized configuration via `.env` file

### Pattern 3: GitHub Actions CI/CD Pipeline
Automated testing and deployment on every push.

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      # Check out code
      - uses: actions/checkout@v4

      # Setup Node.js
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Install dependencies
      - run: npm ci --workspaces

      # Run linter
      - run: npm run lint

      # Run type check
      - run: npm run type-check

      # Run tests
      - run: npm run test

      # Build
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      # Authenticate with Docker Hub
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      # Build and push Docker image
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: ./server/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/goldledger:latest
            ${{ secrets.DOCKER_USERNAME }}/goldledger:${{ github.sha }}

      # Deploy to production
      - run: |
          curl -X POST ${{ secrets.DEPLOY_WEBHOOK }} \
            -H "Authorization: Bearer ${{ secrets.DEPLOY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"image": "goldledger:${{ github.sha }}"}'
```

### Pattern 4: Environment Configuration Strategy
Manage secrets and config across development, staging, production.

```typescript
// src/config.ts
import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3501),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:3000').transform(s => s.split(',')),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NEON_API_KEY: z.string().optional(),
  NEON_PROJECT_ID: z.string().optional(),
})

export const config = configSchema.parse(process.env)

// Usage in application
app.use(async (c, next) => {
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured')
  }
  await next()
})
```

**Configuration hierarchy**:
```bash
# .env.local (git-ignored, local development secrets)
JWT_SECRET=your-secret-key-here
DATABASE_URL=postgresql://...

# .env.example (git-tracked, no secrets, documentation)
JWT_SECRET=set-in-.env.local
DATABASE_URL=set-in-.env.local

# Production: GitHub Actions secrets or container orchestration
```

### Pattern 5: Deployment Strategy with Rolling Updates
Zero-downtime deployments using load balancers and health checks.

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

VERSION=$1
DOCKER_IMAGE="registry.example.com/goldledger:$VERSION"

echo "Building Docker image: $DOCKER_IMAGE"
docker build -f server/Dockerfile -t $DOCKER_IMAGE .

echo "Pushing to registry..."
docker push $DOCKER_IMAGE

echo "Rolling update with new version..."

# For Kubernetes:
kubectl set image deployment/goldledger-api \
  goldledger=$DOCKER_IMAGE \
  --record

kubectl rollout status deployment/goldledger-api

# For Docker Swarm:
docker service update \
  --image $DOCKER_IMAGE \
  --update-parallelism 1 \
  --update-delay 10s \
  goldledger-api

echo "Deployment complete"

# Health verification
sleep 5
curl -f http://api.example.com/health || exit 1
echo "Health check passed"
```

## Best Practices

- **Use Alpine images**: Smaller size, fewer vulnerabilities
- **Run as non-root**: Security best practice; prevent container escape
- **Layer caching**: Order Dockerfile commands by change frequency (static → dynamic)
- **Environment variables**: Never embed secrets; use CI/CD secrets management
- **Health checks**: Allow orchestrators to detect and restart failing containers
- **Logging to stdout**: Container logs collected by orchestrators; don't write to files
- **Resource limits**: Set CPU/memory requests and limits to prevent runaway consumption
- **CI before merge**: Require passing tests before merging to main branch
- **Semantic versioning**: Tag releases as v1.2.3 for reproducibility
- **Database migrations before deploy**: Run migrations as init container before app starts

## Common Pitfalls

- **Secrets in git**: Don't commit API keys, passwords, tokens; use .gitignore
- **Monolithic Dockerfile**: Multiple build stages confuse debugging; keep them simple
- **Running as root**: Compromised container gains root access; use USER instruction
- **No health checks**: Orchestrator doesn't know when container is failing
- **Hardcoded configuration**: Port numbers, URLs, API endpoints should be configurable
- **Ignoring caching**: Dockerfile layer cache misses make builds slow
- **Direct database connections**: Containers may restart; use connection pools
- **Missing error handling**: CI/CD scripts should fail fast on any error
- **No rollback strategy**: If deployment fails, have mechanism to revert to previous version

## GoldLedger Application

GoldLedger's DevOps patterns:

1. **Docker**: 5-service composition (postgres, redis, server, client, cognee)
2. **Multi-stage Dockerfile** for Node.js server (build → runtime)
3. **docker-compose.yml** with health checks and service dependencies
4. **GitHub Actions** for CI (linting, type-check, tests) and CD (Docker push, deploy)
5. **Environment configuration** via `.env` file with .env.example for documentation
6. **Non-root user** in production containers
7. **Health check endpoint** (`/health`) for container orchestrators

**Example from GoldLedger** (docker-compose.yml):
```yaml
services:
  server:
    build:
      context: .
      dockerfile: server/Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:dev@postgres:5432/ai_accountant
      NEON_DATABASE_URL: ${NEON_DATABASE_URL}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3501/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    depends_on:
      postgres:
        condition: service_healthy
```

## References

- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Compose](https://docs.docker.com/compose/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [12 Factor App](https://12factor.net/)
- [Semantic Versioning](https://semver.org/)
