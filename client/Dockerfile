
# -----------------------------------------------------------------------------
# Dockerfile for Client (Vite React App)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build-time API URL (empty = use nginx proxy)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build for production
RUN npm run build

# -----------------------------------------------------------------------------
# Production Serve (Nginx)
# -----------------------------------------------------------------------------
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx config to handle React Router (SPA fallback) + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
