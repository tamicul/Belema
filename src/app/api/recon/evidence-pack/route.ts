import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function asStrDecimal(x: unknown) {
  try {
    return (x as { toString: () => string }).toString();
  } catch {
    return String(x);
  }
}

function normMoneyStr(s: string) {
  // normalize decimals for string comparison (MVP assumes 2dp input)
  const n = Number(s);
  if (Number.isFinite(n)) return n.toFixed(2);
  return s.trim();
}

function daysBetween(a: Date, b: Date) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((a.getTime() - b.getTime()) / ms);
}

function withinDays(a: Date, b: Date, windowDays: number) {
  const d = Math.abs(daysBetween(a, b));
  return d <= windowDays;
}

function reasonCodesForMatch(bankDesc: string) {
  const codes: string[] = ["BANK_AMOUNT_DATE_MATCH"];
  if (bankDesc.toUpperCase().includes("SHOPIFY")) codes.push("DESC_KEYWORD_SHOPIFY");
  return codes;
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

  // Deterministic MVP matcher:
  // - bank amount must equal payout amount (exact for now)
  // - postedDate within ±3 days of payoutDate
  // - if multiple candidates => NEEDS_REVIEW (represented as exception)
  const windowDays = 3;

  for (const p of payouts) {
    const payoutAmountStr = asStrDecimal(p.payoutAmount);
    const payoutAmountNorm = normMoneyStr(payoutAmountStr);

    const candidates = bankTxns.filter((b) => {
      const bankAmountNorm = normMoneyStr(asStrDecimal(b.amount));
      return bankAmountNorm === payoutAmountNorm && withinDays(b.postedDate, p.payoutDate, windowDays);
    });

    if (candidates.length === 1) {
      const match = candidates[0];
      matches.push({
        payoutId: p.payoutId,
        payoutAmount: payoutAmountStr,
        payoutCurrency: p.payoutCurrency,
        bankAmount: asStrDecimal(match.amount),
        bankPostedDate: match.postedDate.toISOString().slice(0, 10),
        bankDescription: match.description,
        bankReference: match.reference,
        reasonCode: reasonCodesForMatch(match.description).join("|")
      });
    } else if (candidates.length === 0) {
      exceptions.push({ type: "UNMATCHED_PAYOUT", detail: `${p.payoutId} (${p.payoutCurrency} ${payoutAmountStr})` });
    } else {
      exceptions.push({ type: "NEEDS_REVIEW", detail: `${p.payoutId}: multiple bank candidates (${candidates.length}) for amount ${payoutAmountStr}` });
    }
  }

  for (const b of bankTxns) {
    const bankAmountStr = asStrDecimal(b.amount);
    const bankAmountNorm = normMoneyStr(bankAmountStr);

    const matched = payouts.some((p) => {
      const payoutAmountNorm = normMoneyStr(asStrDecimal(p.payoutAmount));
      return payoutAmountNorm === bankAmountNorm && withinDays(b.postedDate, p.payoutDate, windowDays);
    });

    if (!matched) {
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
