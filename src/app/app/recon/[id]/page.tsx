import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function ReconRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/signin");

  const run = await prisma.reconciliationRun.findUnique({
    where: { id },
    include: {
      sourceFiles: { select: { id: true, type: true, filename: true, uploadedAt: true } },
    },
  });

  if (!run) {
    return (
      <section>
        <h1 style={{ fontSize: 22 }}>Recon run not found</h1>
        <Link href="/app/recon">Back</Link>
      </section>
    );
  }

  const shopifyFile = run.sourceFiles.find((f) => f.type === "SHOPIFY_PAYOUTS_CSV")?.id;
  const bankFile = run.sourceFiles.find((f) => f.type === "BANK_STATEMENT_CSV")?.id;

  const payouts = shopifyFile
    ? await prisma.externalPayout.findMany({
        where: { sourceFileId: shopifyFile },
        orderBy: { payoutDate: "asc" },
        select: { id: true, payoutId: true, payoutAmount: true, payoutCurrency: true, payoutDate: true },
      })
    : [];

  const bankTxns = bankFile
    ? await prisma.externalBankTxn.findMany({
        where: { sourceFileId: bankFile },
        orderBy: { postedDate: "asc" },
        select: { id: true, postedDate: true, description: true, amount: true, reference: true },
      })
    : [];

  // Ultra-simple deterministic matcher for demo:
  // - If bank.reference equals payoutId OR description contains payoutId, propose a match.
  const proposed: Array<{ payoutId: string; payoutAmount: string; bankAmount: string; bankDesc: string }> = [];
  const exceptions: Array<{ kind: string; detail: string }> = [];

  for (const p of payouts) {
    const match = bankTxns.find(
      (b) => (b.reference && b.reference.trim() === p.payoutId) || b.description.toUpperCase().includes(p.payoutId.toUpperCase())
    );
    const payoutAmountStr = (p.payoutAmount as unknown as { toString: () => string }).toString();
    if (match) {
      const bankAmountStr = (match.amount as unknown as { toString: () => string }).toString();
      proposed.push({
        payoutId: p.payoutId,
        payoutAmount: payoutAmountStr,
        bankAmount: bankAmountStr,
        bankDesc: match.description,
      });
    } else {
      exceptions.push({ kind: "UNMATCHED_PAYOUT", detail: `${p.payoutId} (${p.payoutCurrency} ${payoutAmountStr})` });
    }
  }

  for (const b of bankTxns) {
    const matched = payouts.some(
      (p) => (b.reference && b.reference.trim() === p.payoutId) || b.description.toUpperCase().includes(p.payoutId.toUpperCase())
    );
    const bankAmountStr = (b.amount as unknown as { toString: () => string }).toString();
    if (!matched) {
      exceptions.push({
        kind: "UNMATCHED_BANK_TXN",
        detail: `${b.postedDate.toISOString().slice(0, 10)} ${bankAmountStr} ${b.description}`,
      });
    }
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22 }}>Recon run</h1>
        <Link href="/app/recon">All recon</Link>
      </div>

      <p style={{ color: "#666" }}>
        Status: <strong>{run.status}</strong> · Kind: {run.kind}
      </p>

      <h2 style={{ fontSize: 16, marginTop: 16 }}>Attached source files</h2>
      <ul>
        {run.sourceFiles.map((f) => (
          <li key={f.id}>
            <code>{f.type}</code> — {f.filename} — <span style={{ color: "#666" }}>{f.id}</span>
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: 16, marginTop: 16 }}>Proposed matches (demo)</h2>
      {proposed.length === 0 ? (
        <p style={{ color: "#666" }}>No matches yet. (For demo, ensure bank Reference or Description includes payout ID like PO-10001.)</p>
      ) : (
        <ul>
          {proposed.map((m) => (
            <li key={m.payoutId}>
              <strong>{m.payoutId}</strong> — payout {m.payoutAmount} ↔ bank {m.bankAmount} ({m.bankDesc})
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 16, marginTop: 16 }}>Exceptions</h2>
      {exceptions.length === 0 ? (
        <p style={{ color: "#666" }}>No exceptions.</p>
      ) : (
        <ul>
          {exceptions.map((e, idx) => (
            <li key={idx}>
              <code>{e.kind}</code>: {e.detail}
            </li>
          ))}
        </ul>
      )}

      <hr style={{ margin: "16px 0" }} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <a
          href={`/api/recon/evidence-pack.pdf?runId=${encodeURIComponent(run.id)}`}
          style={{
            display: "inline-block",
            padding: 10,
            border: "1px solid #111",
            borderRadius: 10,
            background: "rgba(255,255,255,0.7)",
          }}
        >
          Download Evidence Pack (PDF)
        </a>
        <a
          href={`/api/recon/evidence-pack?runId=${encodeURIComponent(run.id)}`}
          style={{
            display: "inline-block",
            padding: 10,
            border: "1px solid #111",
            borderRadius: 10,
            background: "rgba(255,255,255,0.7)",
          }}
        >
          Download Evidence Pack (JSON)
        </a>
      </div>

      <p style={{ color: "#666", marginTop: 12 }}>
        Next: immutable audit log view + persisted match results (MatchResult) for stable, repeatable runs.
      </p>
    </section>
  );
}
