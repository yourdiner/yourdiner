import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getActiveDiningSessionForTable } from "@/lib/dining-session";
import type { ReservationStatus } from "@prisma/client";
import type { ReservationSettings } from "@/lib/reservation-settings";
import {
  blockingReservationStatusFilter,
  upcomingReservationStatusFilter,
  BLOCKING_RESERVATION_STATUS_LIST,
  activeDiningSessionStatusFilter,
} from "@/lib/prisma-filters";
export { BLOCKING_RESERVATION_STATUS_LIST as BLOCKING_RESERVATION_STATUSES };

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function getReservationBlockEnd(
  reservation: {
    status: ReservationStatus;
    reservedAt: Date;
    expectedEndAt: Date;
    diningSessionId: string | null;
  },
  sessionActive: boolean
): Date | null {
  if (
    reservation.status === "PENDING" ||
    reservation.status === "CONFIRMED"
  ) {
    return reservation.expectedEndAt;
  }

  if (
    reservation.status === "CHECKED_IN" ||
    reservation.status === "DINING"
  ) {
    if (sessionActive) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    return null;
  }

  return null;
}

type ConflictReservation = {
  id: string;
  restaurantId: string;
  tableId: string | null;
  status: ReservationStatus;
  reservedAt: Date;
  expectedEndAt: Date;
  diningSessionId: string | null;
  guestName: string;
  diningSession: { id: string; status: string } | null;
};

/** Pure conflict filter — same rules as findReservationConflicts loop. */
export function filterReservationConflicts(
  reservations: ConflictReservation[],
  windowStart: Date,
  windowEnd: Date
): ConflictReservation[] {
  const conflicts: ConflictReservation[] = [];
  for (const r of reservations) {
    const sessionActive =
      r.diningSession?.status === "ACTIVE" || r.diningSession?.status === "BILL_REQUESTED";
    const blockEnd = getReservationBlockEnd(r, sessionActive);
    if (!blockEnd) continue;
    if (overlaps(windowStart, windowEnd, r.reservedAt, blockEnd)) {
      conflicts.push(r);
    }
  }
  return conflicts;
}

/** Ensures tableId belongs to restaurantId; throws NOT_FOUND otherwise. */
export async function assertTableInRestaurant(tableId: string, restaurantId: string) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true, isActive: true, status: true, number: true, name: true },
  });
  if (!table) {
    throw new AppError("Table not found", "NOT_FOUND", 404);
  }
  return table;
}

export async function hasActiveSessionOnTable(tableId: string): Promise<boolean> {
  const session = await getActiveDiningSessionForTable(tableId);
  return Boolean(session);
}

export async function isTableAvailable(
  restaurantId: string,
  tableId: string,
  windowStart: Date,
  windowEnd: Date,
  excludeReservationId?: string
): Promise<boolean> {
  // Future booking overlap only — for "can start session now" use table-availability.service.
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true, isActive: true, status: true },
  });
  if (!table?.isActive || table.status === "DISABLED") return false;

  if (await hasActiveSessionOnTable(tableId)) return false;

  const conflicts = await findReservationConflicts(
    restaurantId,
    tableId,
    windowStart,
    windowEnd,
    excludeReservationId
  );
  return conflicts.length === 0;
}

export async function findReservationConflicts(
  restaurantId: string,
  tableId: string,
  windowStart: Date,
  windowEnd: Date,
  excludeReservationId?: string
) {
  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId,
      tableId,
      ...blockingReservationStatusFilter(),
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    include: {
      diningSession: { select: { id: true, status: true } },
    },
  });

  return filterReservationConflicts(reservations, windowStart, windowEnd);
}

/**
 * Batch availability: 3 queries total (tables, active sessions, reservations),
 * then in-memory conflict checks — same result as per-table isTableAvailable loop.
 */
export async function getAvailableTables(
  restaurantId: string,
  windowStart: Date,
  windowEnd: Date,
  guestCount: number
) {
  const tables = await prisma.table.findMany({
    where: {
      restaurantId,
      isActive: true,
      status: { not: "DISABLED" },
      capacity: { gte: guestCount },
    },
    orderBy: [{ capacity: "asc" }, { number: "asc" }],
  });

  if (tables.length === 0) return [];

  const tableIds = tables.map((t) => t.id);

  const [sessions, reservations] = await Promise.all([
    prisma.diningSession.findMany({
      where: {
        restaurantId,
        tableId: { in: tableIds },
        ...activeDiningSessionStatusFilter(),
      },
      select: { tableId: true },
    }),
    prisma.reservation.findMany({
      where: {
        restaurantId,
        tableId: { in: tableIds },
        ...blockingReservationStatusFilter(),
      },
      include: {
        diningSession: { select: { id: true, status: true } },
      },
    }),
  ]);

  const occupiedTableIds = new Set(sessions.map((s) => s.tableId));
  const reservationsByTable = new Map<string, typeof reservations>();
  for (const r of reservations) {
    if (!r.tableId) continue;
    const list = reservationsByTable.get(r.tableId) ?? [];
    list.push(r);
    reservationsByTable.set(r.tableId, list);
  }

  const available = [];
  for (const table of tables) {
    if (occupiedTableIds.has(table.id)) continue;
    const conflicts = filterReservationConflicts(
      reservationsByTable.get(table.id) ?? [],
      windowStart,
      windowEnd
    );
    if (conflicts.length === 0) {
      available.push(table);
    }
  }
  return available;
}

export async function getNextReservationWarning(
  restaurantId: string,
  tableId: string,
  at: Date = new Date()
) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true },
  });
  if (!table) return null;

  const next = await prisma.reservation.findFirst({
    where: {
      restaurantId,
      tableId,
      ...upcomingReservationStatusFilter(),
      reservedAt: { gt: at },
    },
    orderBy: { reservedAt: "asc" },
    include: { table: { select: { name: true, number: true } } },
  });

  if (!next) return null;

  const minutesUntil = Math.round((next.reservedAt.getTime() - at.getTime()) / 60000);
  if (minutesUntil > 120) return null;

  const tableLabel = next.table?.name || `Table ${next.table?.number}`;
  return {
    reservationId: next.id,
    guestName: next.guestName,
    reservedAt: next.reservedAt,
    minutesUntil,
    message: `Next reservation for ${tableLabel} starts in ${minutesUntil} minute${minutesUntil === 1 ? "" : "s"}.`,
  };
}

export async function getWalkInConflictWarning(
  restaurantId: string,
  tableId: string,
  at: Date,
  settings: ReservationSettings
) {
  if (!settings.allowWalkInOverride) return null;

  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true },
  });
  if (!table) return null;

  const conflicts = await findReservationConflicts(
    restaurantId,
    tableId,
    at,
    new Date(at.getTime() + 2 * 60 * 60 * 1000)
  );

  if (conflicts.length === 0) return null;

  const next = conflicts.sort(
    (a, b) => a.reservedAt.getTime() - b.reservedAt.getTime()
  )[0];

  return `Walk-in override: ${next.guestName} has a reservation at ${next.reservedAt.toLocaleTimeString()}.`;
}
