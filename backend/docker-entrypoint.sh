#!/bin/sh
set -e

echo "=== [Q-GUARD Backend] Starting Initialization ==="

# Ensure data and logs directories exist
mkdir -p /app/data /app/logs

# Run database migrations
echo "[1/3] Running database migrations..."
node --experimental-sqlite src/db/migrate.js

# Run idempotent database seeding
echo "[2/3] Verifying seed data and default accounts..."
node --experimental-sqlite src/db/seed.js

# Launch backend application
echo "[3/3] Starting Q-GUARD HTTP Server..."
exec node --experimental-sqlite src/server.js
