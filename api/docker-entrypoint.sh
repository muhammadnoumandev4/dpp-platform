#!/bin/sh
set -e

# Named volumes are root-owned on first mount; ensure the app user can write uploads.
if [ -d /app/uploads ]; then
  chown -R dpp:dpp /app/uploads 2>/dev/null || true
fi

# Drop privileges for migrations, seed, and the long-running API process.
exec su-exec dpp sh -c '
  set -e
  npx prisma migrate deploy
  if [ "$RUN_SEED" = "true" ]; then
    npx ts-node prisma/seed.ts
  fi
  exec node dist/main
'
