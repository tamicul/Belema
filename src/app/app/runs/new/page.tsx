import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getDefaultOrgIdForUser } from "@/lib/org";
import { redirect } from "next/navigation";

async function createRun() {
  "use server";
  const session = await getSession();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/signin");

  const orgId = await getDefaultOrgIdForUser(userId);
  if (!orgId) throw new Error("No org");

  const run = await prisma.syncRun.create({
    data: {
      orgId,
      kind: "NETSUITE_SAVED_SEARCH_SYNC",
      status: "QUEUED",
      stats: { note: "skeleton run - no worker yet" },
    },
  });

  redirect(`/app/runs/${run.id}`);
}

export default function NewRunPage() {
  return (
    <section>
      <h1 style={{ fontSize: 22 }}>New Run</h1>
      <p>This creates a placeholder run record (workers/queues come next).</p>
      <form action={createRun}>
        <button type="submit" style={{ padding: 10, border: "1px solid #111", borderRadius: 6 }}>
          Create run
        </button>
      </form>
    </section>
  );
}
