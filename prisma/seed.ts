import { PrismaClient, OrgRole, AuditAction } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@belema.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "password";
  const orgName = process.env.SEED_ORG_NAME ?? "Acme";
  const orgSlug = process.env.SEED_ORG_SLUG ?? "acme";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      name: "Admin",
      passwordHash,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: { name: orgName },
    create: {
      name: orgName,
      slug: orgSlug,
    },
  });

  await prisma.membership.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    update: { role: OrgRole.OWNER },
    create: {
      orgId: org.id,
      userId: user.id,
      role: OrgRole.OWNER,
    },
  });

  await prisma.auditEvent.create({
    data: {
      orgId: org.id,
      actorId: user.id,
      action: AuditAction.ORG_CREATED,
      summary: `Seed created org ${org.slug}`,
      metadata: { seeded: true },
    },
  });

  console.log("Seed complete:");
  console.log({ email, org: org.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
