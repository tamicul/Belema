const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const org = await prisma.organization.findFirst({
    where: { slug: "acme" },
    select: { id: true, slug: true, name: true },
  });
  console.log(org);
})().catch(console.error).finally(() => prisma.$disconnect());
