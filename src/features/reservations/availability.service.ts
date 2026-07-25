import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getActiveDiningSessionForTable } from "@/lib/dining-session";
import type { ReservationStatus } from "@prisma/client";
import {
  getRestaurantReservationSettings,
  type ReservationSettings,
} from "@/lib/reservation-settings";
import { computeExpectedFinishTime } from "@/features/reservations/reservation-conflict.logic";
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

/**
 * Active dining session occupies [startedAt, startedAt + avg dining + cleaning].
 * Future reservation windows that start after that projected free time are allowed.
 */
export function activeSessionBlocksWindow(
  sessionStartedAt: Date,
  windowStart: Date,
  windowEnd: Date,
  averageDiningMinutes: number,
  cleaningBufferMinutes: number
): boolean {
  const blockEnd = computeExpectedFinishTime(
    sessionStartedAt,
    averageDiningMinutes,
    cleaningBufferMinutes
  );
  return overlaps(windowStart, windowEnd, sessionStartedAt, blockEnd);
}

function getReservationBlockEnd(
  reservation: {
    status: ReservationStatus;
    reservedAt: Date;
    expectedEndAt: Date;
    diningSessionId: string | null;
  },
  sessionActive: boolean,
  options?: {
    sessionStartedAt?: Date | null;
    averageDiningMinutes?: number;
    cleaningBufferMinutes?: number;
  }
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
    if (!sessionActive) return null;
    // Project free time from when dining actually started (avg dining + buffer),
    // not a hard-coded 24h block that blocks evening bookings all day.
    if (
      options?.sessionStartedAt &&
      typeof options.averageDiningMinutes === "number"
    ) {
      return computeExpectedFinishTime(
        options.sessionStartedAt,
        options.averageDiningMinutes,
        options.cleaningBufferMinutes ?? 0
      );
    }
    return reservation.expectedEndAt;
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
  diningSession: { id: string; status: string; startedAt?: Date } | null;
};

/** Pure conflict filter — same rules as findReservationConflicts loop. */
export function filterReservationConflicts(
  reservations: ConflictReservation[],
  windowStart: Date,
  windowEnd: Date,
  diningSettings?: Pick<
    ReservationSettings,
    "averageDiningMinutes" | "cleaningBufferMinutes"
  >
): ConflictReservation[] {
  const conflicts: ConflictReservation[] = [];
  for (const r of reservations) {
    const sessionActive =
      r.diningSession?.status === "ACTIVE" ||
      r.diningSession?.status === "BILL_REQUESTED";
    const blockEnd = getReservationBlockEnd(r, sessionActive, {
      sessionStartedAt: r.diningSession?.startedAt ?? null,
      averageDiningMinutes: diningSettings?.averageDiningMinutes,
      cleaningBufferMinutes: diningSettings?.cleaningBufferMinutes,
    });
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

  const settings = await getRestaurantReservationSettings(restaurantId);

  const activeSession = await prisma.diningSession.findFirst({
    where: {
      tableId,
      restaurantId,
      ...activeDiningSessionStatusFilter(),
    },
    select: { startedAt: true },
  });

  if (
    activeSession &&
    activeSessionBlocksWindow(
      activeSession.startedAt,
      windowStart,
      windowEnd,
      settings.averageDiningMinutes,
      settings.cleaningBufferMinutes
    )
  ) {
    return false;
  }

  const conflicts = await findReservationConflicts(
    restaurantId,
    tableId,
    windowStart,
    windowEnd,
    excludeReservationId,
    settings
  );
  return conflicts.length === 0;
}

export async function findReservationConflicts(
  restaurantId: string,
  tableId: string,
  windowStart: Date,
  windowEnd: Date,
  excludeReservationId?: string,
  diningSettings?: Pick<
    ReservationSettings,
    "averageDiningMinutes" | "cleaningBufferMinutes"
  >
) {
  const settings =
    diningSettings ?? (await getRestaurantReservationSettings(restaurantId));

  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId,
      tableId,
      ...blockingReservationStatusFilter(),
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    include: {
      diningSession: { select: { id: true, status: true, startedAt: true } },
    },
  });

  return filterReservationConflicts(reservations, windowStart, windowEnd, settings);
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
  const settings = await getRestaurantReservationSettings(restaurantId);

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
      select: { tableId: true, startedAt: true },
    }),
    prisma.reservation.findMany({
      where: {
        restaurantId,
        tableId: { in: tableIds },
        ...blockingReservationStatusFilter(),
      },
      include: {
        diningSession: { select: { id: true, status: true, startedAt: true } },
      },
    }),
  ]);

  const sessionByTable = new Map(
    sessions.map((s) => [s.tableId, s.startedAt] as const)
  );
  const reservationsByTable = new Map<string, typeof reservations>();
  for (const r of reservations) {
    if (!r.tableId) continue;
    const list = reservationsByTable.get(r.tableId) ?? [];
    list.push(r);
    reservationsByTable.set(r.tableId, list);
  }

  const available = [];
  for (const table of tables) {
    const sessionStartedAt = sessionByTable.get(table.id);
    if (
      sessionStartedAt &&
      activeSessionBlocksWindow(
        sessionStartedAt,
        windowStart,
        windowEnd,
        settings.averageDiningMinutes,
        settings.cleaningBufferMinutes
      )
    ) {
      continue;
    }

    const conflicts = filterReservationConflicts(
      reservationsByTable.get(table.id) ?? [],
      windowStart,
      windowEnd,
      settings
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
    new Date(at.getTime() + 2 * 60 * 60 * 1000),
    undefined,
    settings
  );

  if (conflicts.length === 0) return null;

  const next = conflicts.sort(
    (a, b) => a.reservedAt.getTime() - b.reservedAt.getTime()
  )[0];

  return `Walk-in override: ${next.guestName} has a reservation at ${next.reservedAt.toLocaleTimeString()}.`;
}
