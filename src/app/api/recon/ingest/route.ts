import { NextResponse } from "next/server";
import { ingestBankStatementCsvText, ingestShopifyPayoutsCsvText } from "@/lib/recon";

// Minimal API endpoint for demo/dev:
// POST JSON: { orgId, runId?, filename, type: 'SHOPIFY'|'BANK', csvText }
export async function POST(req: Request) {
  const body = await req.json();

  const { orgId, runId, filename, type, csvText } = body ?? {};
  if (!orgId || !filename || !type || !csvText) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  try {
    const report =
      type === "SHOPIFY"
        ? await ingestShopifyPayoutsCsvText({ orgId, runId, filename, csvText })
        : await ingestBankStatementCsvText({ orgId, runId, filename, csvText });

    return NextResponse.json({ ok: true, report });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 400 });
  }
}
