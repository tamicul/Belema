import { getSession } from "@/lib/session";
import { getDefaultOrgIdForUser } from "@/lib/org";

export default async function AppHome() {
  const session = await getSession();
  const userId = (session?.user as any)?.id as string | undefined;

  const orgId = userId ? await getDefaultOrgIdForUser(userId) : null;

  return (
    <section>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Dashboard</h1>
      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <div>
          <strong>User:</strong> {session?.user?.email}
        </div>
        <div>
          <strong>Org:</strong> {orgId ?? "(none)"}
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Next</h2>
      <ul>
        <li>Connect NetSuite (Saved Search-first)</li>
        <li>Create a Saved Search source</li>
        <li>Run a sync and view results</li>
      </ul>
    </section>
  );
}
