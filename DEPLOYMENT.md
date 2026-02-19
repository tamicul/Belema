# Belema — Deployment

This app is containerized for deployment with Postgres.

## What you get
- Next.js production build
- Prisma migrations applied on container start (`prisma migrate deploy`)
- Optional seed-on-start for a demo admin user
- `/api/health` endpoint (checks DB connectivity)

## Quick start (Docker Compose)

1) Copy env:

```bash
cp .env.production.example .env.production
```

2) Edit `.env.production` (set `NEXTAUTH_SECRET` and confirm `DATABASE_URL`).

3) Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up --build
```

Open: http://localhost:3000

Health: http://localhost:3000/api/health

## Seeding
Set in `.env.production`:

```env
BELEMA_SEED_ON_START=true
SEED_ADMIN_EMAIL=admin@belema.local
SEED_ADMIN_PASSWORD=...
```

Then restart the `web` container.

## Production notes
- Put this behind HTTPS (Caddy/Nginx/Cloudflare Tunnel/etc.)
- Store secrets in your secret manager (not in git)
- Use a managed Postgres for production (recommended)
