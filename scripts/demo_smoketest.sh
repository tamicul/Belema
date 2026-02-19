#!/usr/bin/env bash
set -euo pipefail

# Runs a minimal end-to-end smoke test against the running docker-compose.prod stack.
# Creates sample Shopify + bank CSVs, ingests them, creates a recon run, and downloads evidence packs.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

ENV_FILE=${ENV_FILE:-.env.production}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}
BASE_URL=${BASE_URL:-http://localhost:3000}

cat > /tmp/belema_shopify.csv <<'CSV'
ID,Status,Date,Month,Currency,Amount,Transaction: ID,Transaction: Type,Transaction: Processed At,Transaction: Currency
PO-10001,paid,2026-02-15,2026-02,USD,1200.00,T-1,sale,2026-02-15T10:00:00Z,USD
PO-10001,paid,2026-02-15,2026-02,USD,1200.00,T-2,fee,2026-02-15T10:01:00Z,USD
PO-10002,paid,2026-02-16,2026-02,USD,850.00,T-3,sale,2026-02-16T11:00:00Z,USD
CSV

cat > /tmp/belema_bank.csv <<'CSV'
Date,Description,Reference,Sort Code,Account Number,Money in,Money Out,Balance
2026-02-15,Shopify Payout PO-10001,PO-10001,,,1200.00,0.00,5000.00
2026-02-16,Deposit - Shopify PO-10002,PO-10002,,,850.00,0.00,5850.00
2026-02-16,Bank fee,,,,0.00,10.00,5840.00
CSV

echo "[smoketest] checking health"
curl -fsS "$BASE_URL/api/health" >/dev/null

echo "[smoketest] fetching orgId for seeded org 'acme'"
ORG_ID=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db psql -U belema -d belema -tAc "select id from \"Organization\" where slug='acme' limit 1;" | tr -d ' \r\n')
if [[ -z "$ORG_ID" ]]; then
  echo "ERROR: could not find seeded org 'acme'" >&2
  exit 1
fi

export ORG_ID

echo "[smoketest] ingesting shopify"
SHOPIFY_JSON=$(node -e 'const fs=require("fs"); console.log(JSON.stringify({orgId:process.env.ORG_ID, filename:"shopify_payouts.csv", type:"SHOPIFY", csvText: fs.readFileSync("/tmp/belema_shopify.csv","utf8")}))' )
curl -fsS "$BASE_URL/api/recon/ingest" -H 'content-type: application/json' -d "$SHOPIFY_JSON" >/dev/null

echo "[smoketest] ingesting bank"
BANK_JSON=$(node -e 'const fs=require("fs"); console.log(JSON.stringify({orgId:process.env.ORG_ID, filename:"bank_statement.csv", type:"BANK", csvText: fs.readFileSync("/tmp/belema_bank.csv","utf8")}))' )
curl -fsS "$BASE_URL/api/recon/ingest" -H 'content-type: application/json' -d "$BANK_JSON" >/dev/null

RUN_ID=$(node -e 'console.log(require("crypto").randomUUID())')
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db psql -U belema -d belema -v ON_ERROR_STOP=1 -c "insert into \"ReconciliationRun\"(id,\"orgId\",status,kind,stats,\"createdAt\",\"updatedAt\") values ('$RUN_ID','$ORG_ID','QUEUED','BANK_RECONCILIATION','{}',now(),now());" >/dev/null

SHOPIFY_FILE=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db psql -U belema -d belema -tAc "select id from \"SourceFile\" where \"orgId\"='$ORG_ID' and type='SHOPIFY_PAYOUTS_CSV' order by \"uploadedAt\" desc limit 1;" | tr -d ' \r\n')
BANK_FILE=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db psql -U belema -d belema -tAc "select id from \"SourceFile\" where \"orgId\"='$ORG_ID' and type='BANK_STATEMENT_CSV' order by \"uploadedAt\" desc limit 1;" | tr -d ' \r\n')

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db psql -U belema -d belema -v ON_ERROR_STOP=1 -c "update \"SourceFile\" set \"runId\"='$RUN_ID' where id in ('$SHOPIFY_FILE','$BANK_FILE');" >/dev/null

mkdir -p tmp
curl -fsS "$BASE_URL/api/recon/evidence-pack?runId=$RUN_ID" -o tmp/evidence-pack.json
curl -fsS "$BASE_URL/api/recon/evidence-pack.pdf?runId=$RUN_ID" -o tmp/evidence-pack.pdf

echo "[smoketest] OK: runId=$RUN_ID"
echo "[smoketest] wrote: tmp/evidence-pack.json tmp/evidence-pack.pdf"
