import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function reasonForMatch(payoutId: string, bankRef: string | null, bankDesc: string) {
  if (bankRef && bankRef.trim() === payoutId) return "REFERENCE_EQUALS_PAYOUT_ID";
  if (bankDesc.toUpperCase().includes(payoutId.toUpperCase())) return "DESCRIPTION_CONTAINS_PAYOUT_ID";
  return "UNKNOWN";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId") || "";
  if (!runId) return NextResponse.json({ ok: false, error: "MISSING_RUN_ID" }, { status: 400 });

  const run = await prisma.reconciliationRun.findUnique({
    where: { id: runId },
    include: {
      org: { select: { id: true, slug: true, name: true } },
      sourceFiles: {
        select: { id: true, type: true, filename: true, uploadedAt: true },
      },
    },
  });

  if (!run) return NextResponse.json({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });

  const shopifyFile = run.sourceFiles.find((f) => f.type === "SHOPIFY_PAYOUTS_CSV") || null;
  const bankFile = run.sourceFiles.find((f) => f.type === "BANK_STATEMENT_CSV") || null;

  const payouts = shopifyFile
    ? await prisma.externalPayout.findMany({
        where: { sourceFileId: shopifyFile.id },
        orderBy: { payoutDate: "asc" },
        select: { payoutId: true, payoutAmount: true, payoutCurrency: true, payoutDate: true },
      })
    : [];

  const bankTxns = bankFile
    ? await prisma.externalBankTxn.findMany({
        where: { sourceFileId: bankFile.id },
        orderBy: { postedDate: "asc" },
        select: { postedDate: true, description: true, amount: true, reference: true },
      })
    : [];

  const matches: Array<{
    payoutId: string;
    payoutAmount: string;
    payoutCurrency: string;
    bankAmount: string;
    bankPostedDate: string;
    bankDescription: string;
    bankReference: string | null;
    reasonCode: string;
  }> = [];

  const exceptions: Array<{ type: string; detail: string }> = [];

  for (const p of payouts) {
    const payoutAmountStr = (p.payoutAmount as unknown as { toString: () => string }).toString();

    const match = bankTxns.find(
      (b) => (b.reference && b.reference.trim() === p.payoutId) || b.description.toUpperCase().includes(p.payoutId.toUpperCase())
    );

    if (match) {
      const bankAmountStr = (match.amount as unknown as { toString: () => string }).toString();
      matches.push({
        payoutId: p.payoutId,
        payoutAmount: payoutAmountStr,
        payoutCurrency: p.payoutCurrency,
        bankAmount: bankAmountStr,
        bankPostedDate: match.postedDate.toISOString().slice(0, 10),
        bankDescription: match.description,
        bankReference: match.reference,
        reasonCode: reasonForMatch(p.payoutId, match.reference, match.description),
      });
    } else {
      exceptions.push({ type: "UNMATCHED_PAYOUT", detail: `${p.payoutId} (${p.payoutCurrency} ${payoutAmountStr})` });
    }
  }

  for (const b of bankTxns) {
    const matched = payouts.some(
      (p) => (b.reference && b.reference.trim() === p.payoutId) || b.description.toUpperCase().includes(p.payoutId.toUpperCase())
    );
    if (!matched) {
      const bankAmountStr = (b.amount as unknown as { toString: () => string }).toString();
      exceptions.push({
        type: "UNMATCHED_BANK_TXN",
        detail: `${b.postedDate.toISOString().slice(0, 10)} ${bankAmountStr} ${b.description}`,
      });
    }
  }

  const now = new Date();
  const payload = {
    ok: true,
    meta: {
      product: "Belema",
      generatedAt: now.toISOString(),
      copyright: "© 2026 Tambo Consulting LLC. All rights reserved.",
      confidentiality: "Confidential — do not distribute.",
    },
    org: run.org,
    run: {
      id: run.id,
      kind: run.kind,
      status: run.status,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    },
    sources: {
      shopify: shopifyFile
        ? { id: shopifyFile.id, filename: shopifyFile.filename, uploadedAt: shopifyFile.uploadedAt.toISOString() }
        : null,
      bank: bankFile ? { id: bankFile.id, filename: bankFile.filename, uploadedAt: bankFile.uploadedAt.toISOString() } : null,
    },
    summary: {
      payoutsCount: payouts.length,
      bankTxnsCount: bankTxns.length,
      matchesCount: matches.length,
      exceptionsCount: exceptions.length,
    },
    matches,
    exceptions,
  };

  const filename = `belema-evidence-pack-${run.id}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
