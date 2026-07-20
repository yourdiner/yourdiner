import { prisma } from "@/lib/db";
import { DiningSessionEventType, Prisma } from "@prisma/client";
import type { OrderActor } from "./auth";
import { actorStaffId, actorUserId } from "./auth-helpers";

type EventInput = {
  diningSessionId: string;
  type: DiningSessionEventType;
  message: string;
  metadata?: Record<string, unknown>;
  actor: OrderActor;
};

export async function appendSessionEvent(input: EventInput) {
  const message =
    input.actor.type === "customer"
      ? `${input.actor.displayName} — ${input.message}`
      : input.message;

  return prisma.diningSessionEvent.create({
    data: {
      diningSessionId: input.diningSessionId,
      type: input.type,
      message,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      actorUserId: actorUserId(input.actor),
      actorStaffId: actorStaffId(input.actor) ?? (input.actor.type === "admin" ? input.actor.staffId : undefined),
    },
  });
}

export async function getSessionTimeline(diningSessionId: string) {
  return prisma.diningSessionEvent.findMany({
    where: { diningSessionId },
    orderBy: { createdAt: "asc" },
    include: {
      actorUser: { select: { name: true } },
      actorStaff: { select: { displayName: true } },
    },
  });
}

export function formatEventActor(event: {
  actorUser: { name: string } | null;
  actorStaff: { displayName: string } | null;
}): string {
  return event.actorStaff?.displayName || event.actorUser?.name || "Customer";
}
