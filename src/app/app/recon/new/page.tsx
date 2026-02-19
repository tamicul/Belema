import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getDefaultOrgIdForUser } from "@/lib/org";
import { redirect } from "next/navigation";
import SelectPairForm from "./select-pair-form";

function fmt(d: Date) {
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

async function createReconRun(formData: FormData) {
  "use server";
  const session = await getSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/signin");

  const orgId = await getDefaultOrgIdForUser(userId);
  if (!orgId) throw new Error("No org");

  const shopifySourceFileId = String(formData.get("shopifySourceFileId") || "");
  const bankSourceFileId = String(formData.get("bankSourceFileId") || "");

  if (!shopifySourceFileId || !bankSourceFileId) {
    redirect("/app/recon/new");
  }

  const run = await prisma.reconciliationRun.create({
    data: {
      orgId,
      kind: "BANK_RECONCILIATION",
      status: "QUEUED",
      stats: {
        demo: true,
        note: "Recon run created from selected ingests",
        shopifySourceFileId,
        bankSourceFileId,
      },
    },
    select: { id: true },
  });

  await prisma.sourceFile.updateMany({
    where: { orgId, id: { in: [shopifySourceFileId, bankSourceFileId] } },
    data: { runId: run.id },
  });

  redirect(`/app/recon/${run.id}`);
}

export default async function NewReconRunPage() {
  const session = await getSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/signin");

  const orgId = await getDefaultOrgIdForUser(userId);
  if (!orgId) throw new Error("No org");

  const shopify = await prisma.sourceFile.findMany({
    where: { orgId, type: "SHOPIFY_PAYOUTS_CSV" },
    orderBy: { uploadedAt: "desc" },
    take: 25,
    select: { id: true, filename: true, uploadedAt: true, _count: { select: { rawRows: true, payouts: true } } },
  });

  const bank = await prisma.sourceFile.findMany({
    where: { orgId, type: "BANK_STATEMENT_CSV" },
    orderBy: { uploadedAt: "desc" },
    take: 25,
    select: { id: true, filename: true, uploadedAt: true, _count: { select: { rawRows: true, bankTxns: true } } },
  });

  const shopifyChoices = shopify.map((f) => ({
    id: f.id,
    label: `${fmt(f.uploadedAt)} · ${f.filename} · rows=${f._count.rawRows} · payouts=${f._count.payouts} · ${f.id}`,
  }));

  const bankChoices = bank.map((f) => ({
    id: f.id,
    label: `${fmt(f.uploadedAt)} · ${f.filename} · rows=${f._count.rawRows} · bankTxns=${f._count.bankTxns} · ${f.id}`,
  }));

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22 }}>New recon run</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/app/recon/ingests">Ingest history</Link>
          <Link href="/app/recon/ingest">Ingest CSV</Link>
        </div>
      </div>

      <p>Select a Shopify ingest + a bank ingest to pair together for reconciliation.</p>

      {/* Server action endpoint lives here */}
      <form action={createReconRun}>
        <SelectPairForm
          shopifyChoices={shopifyChoices}
          bankChoices={bankChoices}
          defaultShopifyId={shopify[0]?.id}
          defaultBankId={bank[0]?.id}
        />
      </form>
    </section>
  );
}
