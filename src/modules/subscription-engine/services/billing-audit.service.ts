import { prisma } from "@/lib/db";
import type { BillingAuditAction } from "@prisma/client";

export async function logBillingAction(input: {
  action: BillingAuditAction;
  entityType: string;
  entityId?: string;
  restaurantId?: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.billingAuditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      restaurantId: input.restaurantId,
      actorUserId: input.actorUserId,
      metadata: (input.metadata ?? {}) as object,
    },
  });
}

export async function getBillingAuditLogs(params: {
  restaurantId?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}) {
  return prisma.billingAuditLog.findMany({
    where: {
      restaurantId: params.restaurantId,
      entityType: params.entityType,
      entityId: params.entityId,
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 50,
  });
}
