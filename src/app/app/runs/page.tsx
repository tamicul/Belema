import Link from "next/link";
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
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Runs</h1>
        <Link href="/app/runs/new">New run</Link>
      </div>

      <p style={{ color: "#555" }}>Execution history for sync jobs (Saved Search-first).</p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Created</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Kind</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td style={{ borderBottom: "1px solid #f3f3f3", padding: 8 }}>
                  <Link href={`/app/runs/${r.id}`}>{r.createdAt.toISOString()}</Link>
                </td>
                <td style={{ borderBottom: "1px solid #f3f3f3", padding: 8 }}>{r.kind}</td>
                <td style={{ borderBottom: "1px solid #f3f3f3", padding: 8 }}>{r.status}</td>
                <td style={{ borderBottom: "1px solid #f3f3f3", padding: 8, color: r.error ? "#b00020" : "#999" }}>
                  {r.error ?? "—"}
                </td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 12, color: "#666" }}>
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
