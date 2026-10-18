# ==============================================================================
# Q-GUARD Backend Dockerfile
# Node.js 22 Alpine (Native SQLite DatabaseSync Support)
# ==============================================================================
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install security certificates & curl/wget for healthchecks
RUN apk add --no-cache ca-certificates wget

# Copy package definition files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure entrypoint script has executable permissions and unix line endings
RUN chmod +x /app/docker-entrypoint.sh

# Create persistent storage directories
RUN mkdir -p /app/data /app/logs

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DB_PATH=/app/data/qguard.db

# Expose backend port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Execute entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
