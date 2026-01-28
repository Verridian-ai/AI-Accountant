
# -----------------------------------------------------------------------------
# Dockerfile for Server (Hybrid Node.js + Python Environment)
# -----------------------------------------------------------------------------
FROM node:20-slim AS base

# Install Python and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# -----------------------------------------------------------------------------
# Node Dependencies
# -----------------------------------------------------------------------------
COPY package*.json ./
RUN npm install

# -----------------------------------------------------------------------------
# Python Dependencies (Virtual Environment)
# -----------------------------------------------------------------------------
COPY requirements.txt ./
RUN python3 -m venv venv
ENV PATH="/app/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------
# App Source
# -----------------------------------------------------------------------------
COPY . .

# Expose API port
EXPOSE 3501

# Start the server (tsx for TypeScript execution)
CMD ["npm", "run", "dev"]
