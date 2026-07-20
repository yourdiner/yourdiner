import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { OrderActor } from "./auth";
import { actorCanAccessAssignedSession } from "./session-access";

export async function assertSessionStaffAccess(
  sessionId: string,
  restaurantId: string,
  actor: OrderActor
) {
  if (actor.type === "customer") return;

  const session = await prisma.diningSession.findFirst({
    where: { id: sessionId, restaurantId },
    select: { staffId: true },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);

  if (!actorCanAccessAssignedSession(actor, session.staffId)) {
    throw new AppError(
      "This table is assigned to another waiter. Contact a manager for access.",
      "FORBIDDEN",
      403
    );
  }
}
