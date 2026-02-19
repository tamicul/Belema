#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

echo "[belema] prisma migrate deploy"
npx prisma migrate deploy

if [[ "${BELEMA_SEED_ON_START:-}" == "true" ]]; then
  echo "[belema] seeding (BELEMA_SEED_ON_START=true)"
  npm run -s seed
fi

echo "[belema] starting web"
exec npm run -s start
