# ==============================================================================
# Q-GUARD Frontend Dashboard Dockerfile
# Multi-Stage Build (Node.js 22 Builder + Nginx Alpine)
# ==============================================================================

# Stage 1: Build Application Bundle
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies needed for vite build)
RUN npm ci

# Copy frontend source code & assets
COPY . .

# Build production bundle to /app/dist
RUN npm run build

# Stage 2: Serve with Nginx Alpine
FROM nginx:1.27-alpine

# Remove default nginx html files
RUN rm -rf /usr/share/nginx/html/*

# Copy built distribution files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
