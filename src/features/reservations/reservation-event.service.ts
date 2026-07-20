import { prisma } from "@/lib/db";
import type { ReservationEventType } from "@prisma/client";
import type { OrderActor } from "@/features/dining-session/auth";
import { actorStaffId, actorUserId } from "@/features/dining-session/auth-helpers";

type LogReservationEventInput = {
  reservationId: string;
  restaurantId: string;
  type: ReservationEventType;
  message: string;
  metadata?: Record<string, unknown>;
  actor?: OrderActor;
  userId?: string | null;
};

export async function logReservationEvent(input: LogReservationEventInput) {
  const actorUser = input.actor ? actorUserId(input.actor) : input.userId ?? null;
  const actorStaff = input.actor
    ? input.actor.type === "staff"
      ? input.actor.staffId
      : actorStaffId(input.actor)
    : null;

  await prisma.reservationEvent.create({
    data: {
      reservationId: input.reservationId,
      type: input.type,
      message: input.message,
      metadata: (input.metadata ?? {}) as object,
      actorUserId: actorUser,
      actorStaffId: actorStaff,
    },
  });

  await prisma.activityLog.create({
    data: {
      restaurantId: input.restaurantId,
      userId: actorUser,
      action: input.type === "CREATED" ? "CREATE" : "UPDATE",
      entity: "reservation",
      entityId: input.reservationId,
      metadata: { type: input.type, ...input.metadata } as object,
    },
  });
}
