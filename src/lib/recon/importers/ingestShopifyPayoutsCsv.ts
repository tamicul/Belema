import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/recon/csv";
import { parseDateFlexible, parseDecimal } from "@/lib/recon/parse";
import type { IngestMessage, IngestReport } from "@/lib/recon/importers/types";

const REQUIRED = [
  "ID",
  "Status",
  "Date",
  "Currency",
  "Amount",
  "Transaction: ID",
  "Transaction: Type",
] as const;

export async function ingestShopifyPayoutsCsvText(opts: {
  orgId: string;
  runId?: string;
  filename: string;
  csvText: string;
}): Promise<IngestReport> {
  const rows = parseCsv(opts.csvText);
  if (rows.length === 0) throw new Error("CSV_EMPTY");

  const missing = REQUIRED.filter((h) => !(h in rows[0]));
  if (missing.length) throw new Error(`MISSING_REQUIRED_COLUMNS:${missing.join(",")}`);

  const sourceFile = await prisma.sourceFile.create({
    data: {
      orgId: opts.orgId,
      runId: opts.runId ?? null,
      type: "SHOPIFY_PAYOUTS_CSV",
      filename: opts.filename,
      mimeType: "text/csv",
    },
    select: { id: true },
  });

  let warnings = 0;
  let errors = 0;

  // Track header consistency per payout_id
  const payoutHeaderById = new Map<
    string,
    { currency: string; amount: string; status: string; date: Date; month?: string }
  >();

  // Create payouts and lines as we go (MVP). We also store ImportedRowRaw for audit.
  // NOTE: Without a DB in the environment, this is still shippable code; it will run when Postgres is available.
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNumber = i + 2; // header is row 1

    const messages: IngestMessage[] = [];

    const payoutId = r["ID"];
    const payoutStatus = r["Status"];
    const payoutDateRes = parseDateFlexible(r["Date"]);
    const payoutCurrency = r["Currency"];
    const payoutAmountRes = parseDecimal(r["Amount"]);

    if (!payoutId) messages.push({ level: "ERROR", code: "MISSING_PAYOUT_ID", message: "ID is required" });
    if (!payoutStatus) messages.push({ level: "ERROR", code: "MISSING_PAYOUT_STATUS", message: "Status is required" });
    if (!payoutCurrency) messages.push({ level: "ERROR", code: "MISSING_PAYOUT_CURRENCY", message: "Currency is required" });
    if (!payoutDateRes.ok) messages.push({ level: "ERROR", code: "BAD_PAYOUT_DATE", message: payoutDateRes.error });
    if (!payoutAmountRes.ok) messages.push({ level: "ERROR", code: "BAD_PAYOUT_AMOUNT", message: payoutAmountRes.error });

    const txnId = r["Transaction: ID"];
    const txnType = r["Transaction: Type"];
    if (!txnId) messages.push({ level: "ERROR", code: "MISSING_TXN_ID", message: "Transaction: ID is required" });
    if (!txnType) messages.push({ level: "ERROR", code: "MISSING_TXN_TYPE", message: "Transaction: Type is required" });

    // Payout header consistency warnings
    if (payoutId && payoutDateRes.ok && payoutAmountRes.ok && payoutCurrency) {
      const existing = payoutHeaderById.get(payoutId);
      const next = {
        currency: payoutCurrency,
        amount: payoutAmountRes.value,
        status: payoutStatus,
        date: payoutDateRes.value,
        month: (r as any)["Month"] || undefined,
      };
      if (!existing) {
        payoutHeaderById.set(payoutId, next);
      } else {
        if (existing.currency !== next.currency) {
          messages.push({
            level: "WARN",
            code: "PAYOUT_CURRENCY_INCONSISTENT",
            message: `payout_currency differs within payout_id=${payoutId}`,
          });
        }
        if (existing.amount !== next.amount) {
          messages.push({
            level: "WARN",
            code: "PAYOUT_AMOUNT_INCONSISTENT",
            message: `payout_amount differs within payout_id=${payoutId}`,
          });
        }
      }
    }

    const hasError = messages.some((m) => m.level === "ERROR");
    const hasWarn = messages.some((m) => m.level === "WARN");

    if (hasWarn) warnings++;
    if (hasError) errors++;

    await prisma.importedRowRaw.create({
      data: {
        orgId: opts.orgId,
        runId: opts.runId ?? null,
        sourceFileId: sourceFile.id,
        rowNumber,
        status: hasError ? "ERROR" : hasWarn ? "WARNING" : "OK",
        raw: r,
        parsed: {
          payoutId,
          payoutStatus,
          payoutDate: payoutDateRes.ok ? payoutDateRes.value.toISOString() : null,
          payoutCurrency,
          payoutAmount: payoutAmountRes.ok ? payoutAmountRes.value : null,
          txnId,
          txnType,
        },
        messages: messages.length ? messages : undefined,
      },
    });

    // Only insert domain rows if row is minimally valid.
    if (!hasError && payoutId && payoutDateRes.ok && payoutAmountRes.ok && payoutCurrency) {
      const payout = await prisma.externalPayout.upsert({
        where: { sourceFileId_payoutId: { sourceFileId: sourceFile.id, payoutId } },
        update: {
          payoutStatus,
          payoutDate: payoutDateRes.value,
          payoutCurrency,
          payoutAmount: payoutAmountRes.value,
          runId: opts.runId ?? null,
        },
        create: {
          orgId: opts.orgId,
          runId: opts.runId ?? null,
          sourceFileId: sourceFile.id,
          payoutId,
          payoutStatus,
          payoutDate: payoutDateRes.value,
          payoutMonth: (r as any)["Month"] || null,
          payoutCurrency,
          payoutAmount: payoutAmountRes.value,
        },
        select: { id: true },
      });

      await prisma.externalPayoutLine.create({
        data: {
          orgId: opts.orgId,
          runId: opts.runId ?? null,
          sourceFileId: sourceFile.id,
          payoutDbId: payout.id,
          txnId,
          txnType,
          txnCurrency: (r as any)["Transaction: Currency"] || null,
          txnProcessedAt: (r as any)["Transaction: Processed At"]
            ? new Date((r as any)["Transaction: Processed At"])
            : null,
          raw: r,
        },
      });
    }
  }

  return {
    sourceFileId: sourceFile.id,
    insertedRawRows: rows.length,
    warnings,
    errors,
  };
}
