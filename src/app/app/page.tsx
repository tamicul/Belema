import { getSession } from "@/lib/session";
import { getDefaultOrgIdForUser } from "@/lib/org";
import ui from "./ui.module.css";

export default async function AppHome() {
  const session = await getSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const orgId = userId ? await getDefaultOrgIdForUser(userId) : null;

  return (
    <section className={ui.page}>
      <div className={ui.row} style={{ justifyContent: "space-between" }}>
        <h1 className={ui.h1}>Dashboard</h1>
        <span className={`${ui.badge} ${ui.badgeOk}`}>Connected</span>
      </div>

      <div className={ui.card}>
        <div className={ui.kv}>
          <div className={ui.k}>User</div>
          <div className={ui.v}>{session?.user?.email ?? "—"}</div>
          <div className={ui.k}>Org</div>
          <div className={ui.v}>
            <span className={ui.code}>{orgId ?? "(none)"}</span>
          </div>
        </div>
      </div>

      <div className={ui.card}>
        <h2 className={ui.h2}>Next</h2>
        <p className={ui.muted} style={{ marginTop: 6 }}>
          For production pilots, the fastest path is: ingest → run recon → review exceptions → export evidence pack.
        </p>
        <hr className={ui.hr} />
        <ul style={{ paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Connect NetSuite (Saved Search-first)</li>
          <li>Create a Saved Search source</li>
          <li>Run a sync and view results</li>
        </ul>
      </div>
    </section>
  );
}
