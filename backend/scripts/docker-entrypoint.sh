#!/bin/sh
set -e

# Fix permissions on mounted volumes (runs as root)
chown -R app:app /app/uploads 2>/dev/null || true

# Run migrations and start app as app user
exec gosu app sh -c 'CI=true npx drizzle-kit push --config=drizzle.config.ts --force && exec node dist/server.js'
