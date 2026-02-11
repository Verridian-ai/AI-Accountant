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
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies if requirements.txt exists
COPY requirements.txt ./
RUN python3 -m pip install --break-system-packages --no-cache-dir -r requirements.txt || true

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Server runs on port 3501
ENV PORT=3501
EXPOSE 3501

# Start with node --import to load tsx
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
