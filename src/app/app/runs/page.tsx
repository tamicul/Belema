import Link from "next/link";
import ui from "../ui.module.css";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getDefaultOrgIdForUser } from "@/lib/org";

export default async function RunsPage() {
  const session = await getSession();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const orgId = await getDefaultOrgIdForUser(userId);
  if (!orgId) {
    return (
      <section>
        <h1>Runs</h1>
        <p>No org found for this user.</p>
      </section>
    );
  }

  const runs = await prisma.syncRun.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <section className={ui.page}>
      <div className={ui.row} style={{ justifyContent: "space-between" }}>
        <div className={ui.row}>
          <h1 className={ui.h1} style={{ margin: 0 }}>
            Runs
          </h1>
          <span className={`${ui.badge} ${ui.badgeOk}`}>Saved Search-first</span>
        </div>
        <Link className={`${ui.btn} ${ui.btnPrimary}`} href="/app/runs/new">
          New run
        </Link>
      </div>

      <p className={ui.muted}>Execution history for sync jobs.</p>

      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Created</th>
              <th className={ui.th}>Kind</th>
              <th className={ui.th}>Status</th>
              <th className={ui.th}>Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className={ui.tr}>
                <td className={ui.td} style={{ whiteSpace: "nowrap" }}>
                  <Link className={ui.code} href={`/app/runs/${r.id}`}>
                    {r.createdAt.toISOString()}
                  </Link>
                </td>
                <td className={ui.td}>{r.kind}</td>
                <td className={ui.td}>
                  <span className={ui.badge}>{r.status}</span>
                </td>
                <td className={ui.td} style={{ color: r.error ? "#b00020" : "rgba(15,23,42,0.55)" }}>
                  {r.error ?? "—"}
                </td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={4} className={ui.td} style={{ color: "rgba(15,23,42,0.60)" }}>
                  No runs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
