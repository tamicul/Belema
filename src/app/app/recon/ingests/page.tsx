import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getDefaultOrgIdForUser } from "@/lib/org";
import { redirect } from "next/navigation";

function fmt(d: Date) {
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export default async function IngestHistoryPage() {
  const session = await getSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/signin");

  const orgId = await getDefaultOrgIdForUser(userId);
  if (!orgId) throw new Error("No org");

  const files = await prisma.sourceFile.findMany({
    where: { orgId },
    orderBy: { uploadedAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      filename: true,
      uploadedAt: true,
      runId: true,
      _count: { select: { rawRows: true, payouts: true, bankTxns: true } },
    },
  });

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22 }}>Ingest history</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/app/recon/new">New recon run</Link>
          <Link href="/app/recon/ingest">Ingest CSV</Link>
        </div>
      </div>

      <p style={{ color: "#666" }}>
        Shows the last 50 ingests. Use the <strong>sourceFileId</strong> + timestamp to pick the correct pair for a recon.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[
                "Uploaded",
                "Type",
                "Filename",
                "sourceFileId",
                "Rows",
                "Payouts",
                "BankTxns",
                "Attached runId",
              ].map((h) => (
                <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3", whiteSpace: "nowrap" }}>
                  {fmt(f.uploadedAt)}
                </td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>
                  <code>{f.type}</code>
                </td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>{f.filename}</td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>
                  <code>{f.id}</code>
                </td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>{f._count.rawRows}</td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>{f._count.payouts}</td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>{f._count.bankTxns}</td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>
                  {f.runId ? <code>{f.runId}</code> : <span style={{ color: "#999" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
