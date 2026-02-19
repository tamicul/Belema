import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import ui from "../../ui.module.css";

function asStrDecimal(x: unknown) {
  try {
    return (x as { toString: () => string }).toString();
  } catch {
    return String(x);
  }
}

function normMoneyStr(s: string) {
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

  // Deterministic MVP matcher:
  // - bank amount must equal payout amount (exact for now)
  // - postedDate within ±3 days of payoutDate
  // - if multiple candidates => NEEDS_REVIEW
  const windowDays = 3;

  const proposed: Array<{
    payoutId: string;
    payoutAmount: string;
    payoutCurrency: string;
    bankAmount: string;
    bankPostedDate: string;
    bankDesc: string;
    reason: string;
  }> = [];

  const exceptions: Array<{ kind: string; detail: string }> = [];

  for (const p of payouts) {
    const payoutAmountStr = asStrDecimal(p.payoutAmount);
    const payoutAmountNorm = normMoneyStr(payoutAmountStr);

    const candidates = bankTxns.filter((b) => {
      const bankAmountNorm = normMoneyStr(asStrDecimal(b.amount));
      return bankAmountNorm === payoutAmountNorm && withinDays(b.postedDate, p.payoutDate, windowDays);
    });

    if (candidates.length === 1) {
      const match = candidates[0];
      proposed.push({
        payoutId: p.payoutId,
        payoutAmount: payoutAmountStr,
        payoutCurrency: p.payoutCurrency,
        bankAmount: asStrDecimal(match.amount),
        bankPostedDate: match.postedDate.toISOString().slice(0, 10),
        bankDesc: match.description,
        reason: match.description.toUpperCase().includes("SHOPIFY") ? "BANK_AMOUNT_DATE_MATCH|DESC_KEYWORD_SHOPIFY" : "BANK_AMOUNT_DATE_MATCH",
      });
    } else if (candidates.length === 0) {
      exceptions.push({ kind: "UNMATCHED_PAYOUT", detail: `${p.payoutId} (${p.payoutCurrency} ${payoutAmountStr})` });
    } else {
      exceptions.push({ kind: "NEEDS_REVIEW", detail: `${p.payoutId}: multiple bank candidates (${candidates.length}) for amount ${payoutAmountStr}` });
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
        kind: "UNMATCHED_BANK_TXN",
        detail: `${b.postedDate.toISOString().slice(0, 10)} ${bankAmountStr} ${b.description}`,
      });
    }
  }

  const matchedPct = payouts.length ? Math.round((proposed.length / payouts.length) * 100) : 0;

  return (
    <section className={ui.page}>
      <div className={ui.row} style={{ justifyContent: "space-between" }}>
        <div className={ui.row}>
          <h1 className={ui.h1}>Recon run</h1>
          <span className={`${ui.badge} ${ui.badgeWarn}`}>{run.status}</span>
        </div>
        <Link className={ui.btn} href="/app/recon">
          All recon
        </Link>
      </div>

      <div className={ui.card}>
        <div className={ui.kv}>
          <div className={ui.k}>Run</div>
          <div className={ui.v}>
            <span className={ui.code}>{run.id}</span>
          </div>
          <div className={ui.k}>Kind</div>
          <div className={ui.v}>{run.kind}</div>
          <div className={ui.k}>Close readiness</div>
          <div className={ui.v}>
            Matched: <strong>{proposed.length}</strong>/<strong>{payouts.length}</strong> ({matchedPct}%) · Exceptions: {exceptions.length}
          </div>
        </div>
      </div>

      <div className={ui.card}>
        <h2 className={ui.h2}>Attached source files</h2>
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {run.sourceFiles.map((f) => (
            <div key={f.id} className={ui.row} style={{ justifyContent: "space-between" }}>
              <div>
                <span className={ui.badge}>{f.type}</span> <strong style={{ marginLeft: 8 }}>{f.filename}</strong>
              </div>
              <span className={`${ui.code} ${ui.muted}`}>{f.id}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={ui.card}>
        <div className={ui.row} style={{ justifyContent: "space-between" }}>
          <h2 className={ui.h2}>Proposed matches</h2>
          <span className={`${ui.badge} ${proposed.length ? ui.badgeOk : ui.badgeWarn}`}>{proposed.length} matches</span>
        </div>

        {proposed.length === 0 ? (
          <p className={ui.muted} style={{ marginTop: 8 }}>
            No matches yet. Matching is deterministic: exact amount + ±3 day window.
          </p>
        ) : (
          <div className={ui.tableWrap} style={{ marginTop: 10 }}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Payout</th>
                  <th className={ui.th}>Amount</th>
                  <th className={ui.th}>Bank date</th>
                  <th className={ui.th}>Bank desc</th>
                  <th className={ui.th}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {proposed.map((m) => (
                  <tr key={m.payoutId} className={ui.tr}>
                    <td className={ui.td}><span className={ui.code}>{m.payoutId}</span></td>
                    <td className={ui.td}>{m.payoutCurrency} {m.payoutAmount}</td>
                    <td className={ui.td}>{m.bankPostedDate}</td>
                    <td className={ui.td}>{m.bankDesc}</td>
                    <td className={ui.td}><span className={ui.code}>{m.reason}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={ui.card}>
        <div className={ui.row} style={{ justifyContent: "space-between" }}>
          <h2 className={ui.h2}>Exceptions</h2>
          <span className={`${ui.badge} ${exceptions.length ? ui.badgeBad : ui.badgeOk}`}>{exceptions.length} items</span>
        </div>

        {exceptions.length === 0 ? (
          <p className={ui.muted} style={{ marginTop: 8 }}>No exceptions.</p>
        ) : (
          <div className={ui.tableWrap} style={{ marginTop: 10 }}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Type</th>
                  <th className={ui.th}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e, idx) => (
                  <tr key={idx} className={ui.tr}>
                    <td className={ui.td}><span className={ui.badge}>{e.kind}</span></td>
                    <td className={ui.td}>{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={ui.row}>
        <a className={`${ui.btn} ${ui.btnPrimary}`} href={`/api/recon/evidence-pack.pdf?runId=${encodeURIComponent(run.id)}`}>
          Download Evidence Pack (PDF)
        </a>
        <a className={ui.btn} href={`/api/recon/evidence-pack?runId=${encodeURIComponent(run.id)}`}>
          Download Evidence Pack (JSON)
        </a>
      </div>

      <p className={ui.muted}>
        Next: persist MatchResult + review actions (approve/reject) so runs are stable and repeatable.
      </p>
    </section>
  );
}
