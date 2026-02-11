# -----------------------------------------------------------------------------
# Dockerfile for Server (Node.js + Python - Production)
# -----------------------------------------------------------------------------
FROM node:20-slim

WORKDIR /app

# Install Python 3 for Claude agent services (GST rules, CGT calculator, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies if requirements.txt exists
COPY requirements.txt ./
RUN python3 -m pip install --break-system-packages --no-cache-dir -r requirements.txt || true

# Install Node dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeuser

# Ensure upload directory exists and is writable
RUN mkdir -p /app/uploads && chown -R nodeuser:nodejs /app/uploads

USER nodeuser

# Server runs on port 3501
ENV PORT=3501
EXPOSE 3501

# Start with node --import to load tsx
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
