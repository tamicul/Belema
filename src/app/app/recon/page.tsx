import Link from "next/link";

export default function ReconHome() {
  return (
    <section>
      <h1 style={{ fontSize: 22 }}>Reconciliation (demo)</h1>
      <p>
        This is the demo reconciliation flow (bank recon accelerator). It will use the <strong>most recent</strong> bank
        statement + Shopify payouts ingests you’ve loaded.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <Link href="/app/recon/new">New recon run</Link>
        <span style={{ color: "#666" }}>·</span>
        <Link href="/app/recon/ingests">Ingest history</Link>
        <span style={{ color: "#666" }}>·</span>
        <Link href="/app/recon/ingest">Ingest CSV</Link>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <p style={{ color: "#666" }}>
        Next: matcher/exceptions + evidence pack export (in progress).
      </p>
    </section>
  );
}
