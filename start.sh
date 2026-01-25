#!/bin/bash
# start.sh - Render startup script

echo "🚀 Starting ShadowCore on port $PORT"

# Wait for database to be ready (if using Render DB)
if [ ! -z "$DATABASE_URL" ]; then
  echo "📊 Waiting for database connection..."
  sleep 2
fi

# Start the application
node index.js
