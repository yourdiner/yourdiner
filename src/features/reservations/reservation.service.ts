import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  getRestaurantReservationSettings,
  computeReservationWindow,
} from "@/lib/reservation-settings";
import { ReservationStatus } from "@prisma/client";
import type { OrderActor } from "@/features/dining-session/auth";
import { findOrCreateCustomer } from "@/features/dining-session/customer.service";
import { assertTableInRestaurant, isTableAvailable } from "./availability.service";
import { suggestBestTable } from "./assignment.service";
import { logReservationEvent } from "./reservation-event.service";
import type { CreateReservationInput, UpdateReservationInput } from "./schemas";

const EDITABLE_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

export async function completeReservationFromSession(
  reservationId: string,
  restaurantId: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) return;
  if (
    reservation.status === ReservationStatus.COMPLETED ||
    reservation.status === ReservationStatus.CANCELLED ||
    reservation.status === ReservationStatus.NO_SHOW
  ) {
    return;
  }

  await prisma.reservation.updateMany({
    where: { id: reservationId, restaurantId },
    data: {
      status: ReservationStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  await logReservationEvent({
    reservationId,
    restaurantId: reservation.restaurantId,
    type: "COMPLETED",
    message: "Reservation completed after dining session closed",
    metadata: { source: "session_close" },
  });
}

export async function createReservation(
  restaurantId: string,
  input: CreateReservationInput,
  actor: OrderActor,
  createdByStaffId?: string
) {
  const settings = await getRestaurantReservationSettings(restaurantId);
  if (!settings.enabled) {
    throw new AppError("Reservations are disabled", "FORBIDDEN", 403);
  }

  const reservedAt = new Date(input.reservedAt);
  const { expectedEndAt, holdExpiresAt } = computeReservationWindow(reservedAt, settings);

  let tableId = input.tableId;
  if (!tableId) {
    const suggested = await suggestBestTable(
      restaurantId,
      reservedAt,
      expectedEndAt,
      input.guestCount
    );
    if (!suggested) {
      throw new AppError(
        "No tables available for selected time",
        "NO_TABLES_AVAILABLE",
        409
      );
    }
    tableId = suggested.id;
  } else {
    await assertTableInRestaurant(tableId, restaurantId);
    const available = await isTableAvailable(
      restaurantId,
      tableId,
      reservedAt,
      expectedEndAt
    );
    if (!available) {
      const alt = await suggestBestTable(
        restaurantId,
        reservedAt,
        expectedEndAt,
        input.guestCount
      );
      throw new AppError(
        alt
          ? `Table not available. Try Table ${alt.number} instead.`
          : "No tables available for selected time",
        "TABLE_CONFLICT",
        409
      );
    }
  }

  const customer = await findOrCreateCustomer(
    restaurantId,
    input.guestPhone,
    input.guestName
  );

  const reservation = await prisma.reservation.create({
    data: {
      restaurantId,
      tableId,
      customerId: customer?.id,
      guestName: input.guestName,
      guestPhone: input.guestPhone.replace(/\D/g, "").slice(-10),
      guestEmail: input.guestEmail || null,
      guestCount: input.guestCount,
      reservedAt,
      expectedEndAt,
      holdExpiresAt,
      specialRequest: input.specialRequest || null,
      status: input.status as ReservationStatus,
      source: input.source,
      createdByStaffId: createdByStaffId ?? null,
    },
    include: {
      table: { select: { id: true, name: true, number: true, capacity: true } },
      customer: true,
    },
  });

  await logReservationEvent({
    reservationId: reservation.id,
    restaurantId,
    type: "CREATED",
    message: `Reservation created for ${reservation.guestName}`,
    metadata: { tableId, reservedAt: reservedAt.toISOString() },
    actor,
  });

  if (reservation.status === ReservationStatus.CONFIRMED) {
    await logReservationEvent({
      reservationId: reservation.id,
      restaurantId,
      type: "CONFIRMED",
      message: "Reservation confirmed",
      actor,
    });
  }

  return reservation;
}

export async function updateReservation(
  reservationId: string,
  restaurantId: string,
  input: UpdateReservationInput,
  actor: OrderActor
) {
  const existing = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!existing) throw new AppError("Reservation not found", "NOT_FOUND", 404);

  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new AppError(
      "Cannot edit reservation after check-in or completion",
      "FORBIDDEN",
      403
    );
  }

  const settings = await getRestaurantReservationSettings(restaurantId);
  const reservedAt = input.reservedAt ? new Date(input.reservedAt) : existing.reservedAt;
  const { expectedEndAt, holdExpiresAt } = computeReservationWindow(reservedAt, settings);
  const guestCount = input.guestCount ?? existing.guestCount;
  const tableId = input.tableId !== undefined ? input.tableId : existing.tableId;
  const previousTableId = existing.tableId;

  if (tableId) {
    await assertTableInRestaurant(tableId, restaurantId);
    const available = await isTableAvailable(
      restaurantId,
      tableId,
      reservedAt,
      expectedEndAt,
      reservationId
    );
    if (!available) {
      throw new AppError("Table not available for selected time", "TABLE_CONFLICT", 409);
    }
  }

  const reservation = await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      ...(input.guestName ? { guestName: input.guestName } : {}),
      ...(input.guestPhone
        ? { guestPhone: input.guestPhone.replace(/\D/g, "").slice(-10) }
        : {}),
      ...(input.guestEmail !== undefined ? { guestEmail: input.guestEmail || null } : {}),
      guestCount,
      reservedAt,
      expectedEndAt,
      holdExpiresAt,
      ...(input.tableId !== undefined ? { tableId: input.tableId } : {}),
      ...(input.specialRequest !== undefined
        ? { specialRequest: input.specialRequest || null }
        : {}),
      ...(input.status ? { status: input.status as ReservationStatus } : {}),
    },
    include: {
      table: { select: { id: true, name: true, number: true, capacity: true } },
      customer: true,
    },
  });

  await logReservationEvent({
    reservationId,
    restaurantId,
    type: "UPDATED",
    message: "Reservation updated",
    metadata: input as Record<string, unknown>,
    actor,
  });

  return reservation;
}

export async function confirmReservation(
  reservationId: string,
  restaurantId: string,
  actor: OrderActor
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId, status: ReservationStatus.PENDING },
  });
  if (!reservation) throw new AppError("Reservation not found", "NOT_FOUND", 404);

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: ReservationStatus.CONFIRMED },
    include: { table: true },
  });

  await logReservationEvent({
    reservationId,
    restaurantId,
    type: "CONFIRMED",
    message: "Reservation confirmed",
    actor,
  });

  return updated;
}

export async function cancelReservation(
  reservationId: string,
  restaurantId: string,
  actor: OrderActor
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new AppError("Reservation not found", "NOT_FOUND", 404);

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
    },
    include: { table: true },
  });

  await logReservationEvent({
    reservationId,
    restaurantId,
    type: "CANCELLED",
    message: "Reservation cancelled",
    actor,
  });

  return updated;
}

export async function markNoShow(
  reservationId: string,
  restaurantId: string,
  actor?: OrderActor,
  source: "manual" | "cron" = "manual"
) {
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      restaurantId,
      status: ReservationStatus.CONFIRMED,
    },
  });
  if (!reservation) throw new AppError("Reservation not found", "NOT_FOUND", 404);

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status: ReservationStatus.NO_SHOW,
      noShowAt: new Date(),
    },
    include: { table: true },
  });

  await logReservationEvent({
    reservationId,
    restaurantId,
    type: source === "cron" ? "CRON_NO_SHOW" : "NO_SHOW",
    message: "Marked as no show",
    metadata: { source },
    actor,
  });

  return updated;
}

export async function changeReservationTable(
  reservationId: string,
  restaurantId: string,
  tableId: string,
  actor: OrderActor
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new AppError("Reservation not found", "NOT_FOUND", 404);

  await assertTableInRestaurant(tableId, restaurantId);
  const available = await isTableAvailable(
    restaurantId,
    tableId,
    reservation.reservedAt,
    reservation.expectedEndAt,
    reservationId
  );
  if (!available) {
    throw new AppError("Table not available", "TABLE_CONFLICT", 409);
  }

  const previousTableId = reservation.tableId;

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { tableId },
    include: { table: true },
  });

  await logReservationEvent({
    reservationId,
    restaurantId,
    type: "TABLE_CHANGED",
    message: `Table changed to ${updated.table?.name || updated.table?.number}`,
    metadata: { tableId },
    actor,
  });

  return updated;
}
