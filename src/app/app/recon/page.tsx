import Link from "next/link";
import ui from "../ui.module.css";

export default function ReconHome() {
  return (
    <section className={ui.page}>
      <div className={ui.row} style={{ justifyContent: "space-between" }}>
        <h1 className={ui.h1}>Reconciliation</h1>
        <span className={`${ui.badge} ${ui.badgeWarn}`}>Pilot mode</span>
      </div>

      <p className={ui.muted}>
        This flow pairs a Shopify payouts ingest with a bank statement ingest, proposes matches, and exports an evidence pack.
      </p>

      <div className={ui.row}>
        <Link className={`${ui.btn} ${ui.btnPrimary}`} href="/app/recon/new">
          New recon run
        </Link>
        <Link className={ui.btn} href="/app/recon/ingests">
          Ingest history
        </Link>
        <Link className={ui.btn} href="/app/recon/ingest">
          Ingest CSV
        </Link>
      </div>

      <div className={ui.card}>
        <h2 className={ui.h2}>What you get</h2>
        <ul style={{ paddingLeft: 18, display: "grid", gap: 6, marginTop: 8 }}>
          <li>Proposed matches (explainable)</li>
          <li>Exception list (unmatched payouts / bank txns)</li>
          <li>Evidence Pack export (JSON + PDF)</li>
        </ul>
      </div>
    </section>
  );
}
