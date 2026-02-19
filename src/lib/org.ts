import { prisma } from "@/lib/prisma";

export async function getDefaultOrgIdForUser(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { orgId: true },
  });
  return membership?.orgId ?? null;
}
