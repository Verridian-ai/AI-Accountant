# -----------------------------------------------------------------------------
# Dockerfile for Server (Node.js - Production)
# -----------------------------------------------------------------------------
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Cloud Run uses PORT env variable (defaults to 8080)
ENV PORT=8080
EXPOSE 8080

# Start with node --import to load tsx
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
