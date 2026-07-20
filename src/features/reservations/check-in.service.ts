import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getRestaurantReservationSettings } from "@/lib/reservation-settings";
import { ReservationStatus } from "@prisma/client";
import type { OrderActor } from "@/features/dining-session/auth";
import { startDiningSessionService } from "@/features/dining-session/session.service";
import { getTableAvailability } from "@/features/tables/table-availability.service";
import { isWithinHoldWindow } from "@/features/tables/table-availability.logic";
import { logReservationEvent } from "./reservation-event.service";
import { createInAppNotification } from "@/modules/subscription-engine/services/notification.service";

export async function checkInReservation(
  reservationId: string,
  restaurantId: string,
  actor: OrderActor,
  options?: { staffId?: string | null }
) {
  const settings = await getRestaurantReservationSettings(restaurantId);
  if (!settings.enabled) {
    throw new AppError("Reservations are disabled", "FORBIDDEN", 403);
  }

  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      restaurantId,
      status: ReservationStatus.CONFIRMED,
    },
    include: { table: true },
  });

  if (!reservation) throw new AppError("Reservation not found", "NOT_FOUND", 404);
  if (!reservation.tableId) {
    throw new AppError("No table assigned", "VALIDATION", 400);
  }

  const now = new Date();
  if (!isWithinHoldWindow(reservation.reservedAt, reservation.holdExpiresAt, now)) {
    throw new AppError(
      "Check-in is only available during the reservation hold window",
      "TABLE_NOT_RESERVED",
      409
    );
  }

  const availability = await getTableAvailability(restaurantId, reservation.tableId, {
    now,
    reservationId,
  });
  if (
    !availability ||
    availability.status !== "RESERVED" ||
    availability.blockingReservation?.id !== reservationId
  ) {
    throw new AppError(
      "Table is not reserved for this reservation",
      "TABLE_NOT_RESERVED",
      409
    );
  }

  const session = await startDiningSessionService({
    restaurantId,
    tableId: reservation.tableId,
    guestCount: reservation.guestCount,
    customerPhone: reservation.guestPhone,
    customerName: reservation.guestName,
    notes: reservation.specialRequest ?? undefined,
    staffId: options?.staffId,
    reservationId: reservation.id,
    actor,
  });

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status: ReservationStatus.DINING,
      checkedInAt: new Date(),
      diningSessionId: session.id,
      customerId: session.customerId,
    },
    include: {
      table: true,
      diningSession: true,
    },
  });

  await logReservationEvent({
    reservationId,
    restaurantId,
    type: "CHECKED_IN",
    message: `Checked in at ${reservation.table?.name || `Table ${reservation.table?.number}`}`,
    actor,
  });

  await logReservationEvent({
    reservationId,
    restaurantId,
    type: "SESSION_LINKED",
    message: `Linked to dining session`,
    metadata: { diningSessionId: session.id },
    actor,
  });

  await createInAppNotification({
    restaurantId,
    title: "Reservation checked in",
    body: `${reservation.guestName} checked in for ${reservation.table?.name || `Table ${reservation.table?.number}`}`,
  });

  return { reservation: updated, session };
}
