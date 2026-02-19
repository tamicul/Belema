import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/recon/csv";
import { parseDateFlexible, parseDecimal } from "@/lib/recon/parse";
import type { IngestMessage, IngestReport } from "@/lib/recon/importers/types";

const REQUIRED = ["Date", "Description", "Money Out", "Money in"] as const;

export async function ingestBankStatementCsvText(opts: {
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
      type: "BANK_STATEMENT_CSV",
      filename: opts.filename,
      mimeType: "text/csv",
    },
    select: { id: true },
  });

  let warnings = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNumber = i + 2;
    const messages: IngestMessage[] = [];

    const postedDateRes = parseDateFlexible(r["Date"]);
    const description = r["Description"];

    const moneyInStr = r["Money in"];
    const moneyOutStr = r["Money Out"];

    const moneyIn = moneyInStr ? parseDecimal(moneyInStr) : { ok: true as const, value: "0" };
    const moneyOut = moneyOutStr ? parseDecimal(moneyOutStr) : { ok: true as const, value: "0" };

    if (!postedDateRes.ok) messages.push({ level: "ERROR", code: "BAD_POSTED_DATE", message: postedDateRes.error });
    if (!description) messages.push({ level: "ERROR", code: "MISSING_DESCRIPTION", message: "Description is required" });
    if (!moneyIn.ok) messages.push({ level: "ERROR", code: "BAD_MONEY_IN", message: moneyIn.error });
    if (!moneyOut.ok) messages.push({ level: "ERROR", code: "BAD_MONEY_OUT", message: moneyOut.error });

    const moneyInNum = moneyIn.ok ? Number(moneyIn.value) : 0;
    const moneyOutNum = moneyOut.ok ? Number(moneyOut.value) : 0;

    // XOR validation rule
    if (moneyInNum > 0 && moneyOutNum > 0) {
      messages.push({
        level: "ERROR",
        code: "BOTH_MONEY_IN_AND_OUT",
        message: "Row has both Money in and Money Out > 0",
      });
    }

    const amount = (moneyInNum - moneyOutNum).toFixed(2);
    if (moneyInNum === 0 && moneyOutNum === 0) {
      messages.push({ level: "WARN", code: "ZERO_ROW", message: "Both Money in and Money Out are 0" });
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
          postedDate: postedDateRes.ok ? postedDateRes.value.toISOString() : null,
          description,
          moneyIn: moneyIn.ok ? moneyIn.value : null,
          moneyOut: moneyOut.ok ? moneyOut.value : null,
          amount,
        },
        messages: messages.length ? messages : undefined,
      },
    });

    if (!hasError && postedDateRes.ok && description) {
      const balStr = (r as any)["Balance"];
      const balRes = balStr ? parseDecimal(balStr) : null;

      await prisma.externalBankTxn.create({
        data: {
          orgId: opts.orgId,
          runId: opts.runId ?? null,
          sourceFileId: sourceFile.id,
          postedDate: postedDateRes.value,
          description,
          reference: (r as any)["Reference"] || null,
          sortCode: (r as any)["Sort Code"] || null,
          accountNumber: (r as any)["Account Number"] || null,
          moneyIn: moneyIn.ok ? moneyIn.value : "0",
          moneyOut: moneyOut.ok ? moneyOut.value : "0",
          amount,
          balance: balRes && balRes.ok ? balRes.value : null,
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
