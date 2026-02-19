import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

type PdfDoc = InstanceType<typeof PDFDocument>;

function reasonForMatch(payoutId: string, bankRef: string | null, bankDesc: string) {
  if (bankRef && bankRef.trim() === payoutId) return "REFERENCE_EQUALS_PAYOUT_ID";
  if (bankDesc.toUpperCase().includes(payoutId.toUpperCase())) return "DESCRIPTION_CONTAINS_PAYOUT_ID";
  return "UNKNOWN";
}

function asStrDecimal(x: unknown) {
  try {
    // Prisma Decimal has toString()
    return (x as { toString: () => string }).toString();
  } catch {
    return String(x);
  }
}

function watermark(doc: PdfDoc) {
  const { width, height } = doc.page;
  doc.save();
  doc.rotate(-24, { origin: [width / 2, height / 2] });
  doc.fillColor("#94a3b8");
  doc.opacity(0.15);
  doc.fontSize(48);
  doc.text("CONFIDENTIAL", width * 0.15, height * 0.42, { width: width * 0.7, align: "center" });
  doc.opacity(1);
  doc.restore();
}

function footer(doc: PdfDoc) {
  const { width, height, margins } = doc.page;
  const y = height - margins.bottom + 8;
  doc.save();
  doc.fontSize(9);
  doc.fillColor("#475569");
  doc.text("© 2026 Tambo Consulting LLC — Confidential — Do not distribute", margins.left, y, {
    width: width - margins.left - margins.right,
    align: "center",
  });
  doc.restore();
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
    const payoutAmountStr = asStrDecimal(p.payoutAmount);
    const match = bankTxns.find(
      (b) => (b.reference && b.reference.trim() === p.payoutId) || b.description.toUpperCase().includes(p.payoutId.toUpperCase())
    );

    if (match) {
      matches.push({
        payoutId: p.payoutId,
        payoutAmount: payoutAmountStr,
        payoutCurrency: p.payoutCurrency,
        bankAmount: asStrDecimal(match.amount),
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
      exceptions.push({
        type: "UNMATCHED_BANK_TXN",
        detail: `${b.postedDate.toISOString().slice(0, 10)} ${asStrDecimal(b.amount)} ${b.description}`,
      });
    }
  }

  // Build PDF
  const doc = new PDFDocument({ size: "LETTER", margin: 54 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));

  const finished: Promise<Buffer> = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const now = new Date();

  // Keep PDF generation intentionally minimal and single-page for production reliability.
  // (We had crashes with multi-page + pageAdded handlers under Next.js bundling.)

  doc.fillColor("#0f172a");
  doc.fontSize(20).text("Belema — Evidence Pack");
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#334155");
  doc.text(`Generated: ${now.toISOString().replace("T", " ").slice(0, 19)}Z`);
  doc.text("© 2026 Tambo Consulting LLC — Confidential — Do not distribute");

  doc.moveDown(1);

  const orgLine = `${run.org.name} (${run.org.slug})`;
  doc.fontSize(11).fillColor("#0f172a").text("Summary");
  doc.fontSize(10).fillColor("#334155");
  doc.text(`Organization: ${orgLine}`);
  doc.text(`Run: ${run.id}`);
  doc.text(`Status: ${run.status}    Kind: ${run.kind}`);

  const matchedPct = payouts.length ? Math.round((matches.length / payouts.length) * 100) : 0;
  doc.moveDown(0.5);
  doc.text(`Payouts: ${payouts.length}`);
  doc.text(`Bank transactions: ${bankTxns.length}`);
  doc.text(`Matches: ${matches.length}/${payouts.length} (${matchedPct}%)`);
  doc.text(`Exceptions: ${exceptions.length}`);

  doc.moveDown(1);
  doc.fontSize(11).fillColor("#0f172a").text("Top Exceptions (first 10)");
  doc.fontSize(9).fillColor("#334155");
  if (exceptions.length === 0) doc.text("None.");
  else exceptions.slice(0, 10).forEach((e) => doc.text(`• ${e.type}: ${e.detail}`));

  doc.moveDown(0.8);
  doc.fontSize(11).fillColor("#0f172a").text("Top Matches (first 10)");
  doc.fontSize(9).fillColor("#334155");
  if (matches.length === 0) doc.text("None.");
  else
    matches.slice(0, 10).forEach((m) =>
      doc.text(`• ${m.payoutId} ${m.payoutCurrency} ${m.payoutAmount} ↔ bank ${m.bankAmount} (${m.bankPostedDate}) — ${m.reasonCode}`)
    );

  doc.end();
  const pdf = await finished;

  const filename = `belema-evidence-pack-${run.id}.pdf`;
  return new NextResponse(pdf as any, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
