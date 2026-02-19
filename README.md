# Belema

Reconciliation platform scaffold (Next.js + Postgres) with:
- Auth (NextAuth) + Users
- Organizations + Memberships + RBAC roles
- Audit events
- Runs dashboard skeleton (SyncRun table)
- NetSuite integration direction: **Saved Search-first** (declarative data sources)

## Prereqs
- Node.js (>=20 recommended)
- Docker (for local Postgres)

## Local setup

```bash
# 1) install
npm install

# 2) env
cp .env.example .env

# 3) start postgres
npm run db:up

# 4) migrate + generate prisma client
npm run prisma:migrate

# 5) seed dev admin + org
npm run seed

# 6) run app
npm run dev
```

Then open:
- http://localhost:3000/signin

Default dev credentials (from `.env`):
- email: `admin@belema.local`
- password: `password`

## Data model (high-level)
- `User`, `Organization`, `Membership(OrgRole)`
- `AuditEvent` for immutable audit trail
- `Connector` + `NetSuiteSavedSearch` for Saved Search-first sync
- `SyncRun` for job/run history (dashboard at `/app/runs`)

## Next milestone (implementation direction)
1) Add Connector CRUD (NetSuite connector config stubs + secret reference)
2) Add Saved Search CRUD + validation of expected columns
3) Add worker/queue skeleton and run execution lifecycle (`QUEUED → RUNNING → ...`)
4) Add incremental sync checkpoints and run stats schema
