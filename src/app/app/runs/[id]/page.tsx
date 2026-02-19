import { prisma } from "@/lib/prisma";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.syncRun.findUnique({ where: { id } });

  if (!run) {
    return (
      <section>
        <h1>Run</h1>
        <p>Not found.</p>
      </section>
    );
  }

  return (
    <section>
      <h1 style={{ fontSize: 22 }}>Run</h1>
      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <div>
          <strong>ID:</strong> {run.id}
        </div>
        <div>
          <strong>Kind:</strong> {run.kind}
        </div>
        <div>
          <strong>Status:</strong> {run.status}
        </div>
        <div>
          <strong>Created:</strong> {run.createdAt.toISOString()}
        </div>
        <div>
          <strong>Started:</strong> {run.startedAt?.toISOString() ?? "—"}
        </div>
        <div>
          <strong>Finished:</strong> {run.finishedAt?.toISOString() ?? "—"}
        </div>
        <div>
          <strong>Error:</strong> {run.error ?? "—"}
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 18 }}>Stats</h2>
      <pre style={{ background: "#fafafa", padding: 12, border: "1px solid #eee", borderRadius: 8, overflowX: "auto" }}>
        {JSON.stringify(run.stats, null, 2)}
      </pre>
    </section>
  );
}
