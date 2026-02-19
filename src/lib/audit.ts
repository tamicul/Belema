import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function auditEvent(input: {
  orgId: string;
  actorId?: string | null;
  action: AuditAction;
  summary: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
  ip?: string;
  userAgent?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId ?? null,
      action: input.action,
      summary: input.summary,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    },
  });
}
