import { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const roleRank: Record<OrgRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export async function getUserRoleInOrg(userId: string, orgId: string) {
  const m = await prisma.membership.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { role: true },
  });
  return m?.role ?? null;
}

export function hasAtLeastRole(role: OrgRole, minimum: OrgRole) {
  return roleRank[role] >= roleRank[minimum];
}
