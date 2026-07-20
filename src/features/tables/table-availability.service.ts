import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getActiveDiningSessionForTable } from "@/lib/dining-session";
import {
  activeDiningSessionStatusFilter,
  blockingReservationStatusFilter,
  blockingTableSessionStatusFilter,
} from "@/lib/prisma-filters";
import { ReservationStatus } from "@prisma/client";
import { getRestaurantReservationSettings } from "@/lib/reservation-settings";
import { markNoShow } from "@/features/reservations/reservation.service";
import {
  buildAvailabilitySnapshot,
  TABLE_RESERVATION_BLOCKED_MESSAGE,
  type ActiveSessionSnapshot,
  type TableAvailabilitySnapshot,
} from "./table-availability.logic";
import {
  buildAvailabilityMap,
  classifyReservationsForTable,
  type AvailabilityReservationRow,
  type AvailabilitySessionRow,
  type AvailabilityTableRow,
} from "./table-availability.builder";

export {
  TABLE_RESERVATION_BLOCKED_MESSAGE,
  computedStatusToDisplayStatus,
  toLegacyComputedStatus,
  type TableAvailabilitySnapshot,
  type TableAvailabilityStatus,
  type ComputedTableStatus,
} from "./table-availability.logic";

export { buildAvailabilityMap } from "./table-availability.builder";

export async function processExpiredReservationHolds(restaurantId: string, now: Date) {
  const settings = await getRestaurantReservationSettings(restaurantId);
  if (!settings.autoMarkNoShow) return;

  const expired = await prisma.reservation.findMany({
    where: {
      restaurantId,
      status: ReservationStatus.CONFIRMED,
      holdExpiresAt: { lte: now },
    },
    select: { id: true },
  });

  for (const reservation of expired) {
    try {
      await markNoShow(reservation.id, restaurantId, undefined, "cron");
    } catch {
      // skip rows already transitioned
    }
  }
}

async function findReservationsForTable(tableId: string) {
  return prisma.reservation.findMany({
    where: {
      tableId,
      ...blockingReservationStatusFilter(),
    },
    select: {
      id: true,
      guestName: true,
      guestCount: true,
      reservedAt: true,
      holdExpiresAt: true,
      status: true,
    },
    orderBy: { reservedAt: "asc" },
  });
}

export async function getTableAvailability(
  restaurantId: string,
  tableId: string,
  options?: {
    now?: Date;
    reservationId?: string | null;
    /** @deprecated Hold expiry runs via cron / reservations dashboard, not availability reads. */
    skipLazyNoShow?: boolean;
  }
): Promise<TableAvailabilitySnapshot | null> {
  const now = options?.now ?? new Date();

  // Hold expiry (NO_SHOW writes) deliberately omitted — classification already
  // ignores CONFIRMED holds outside holdExpiresAt. Cron + reservations dashboard
  // perform durable NO_SHOW transitions.

  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true, isActive: true, status: true },
  });
  if (!table) return null;

  const activeSessionRow = await getActiveDiningSessionForTable(tableId);
  let activeSession: ActiveSessionSnapshot | null = activeSessionRow
    ? { id: activeSessionRow.id, status: activeSessionRow.status }
    : null;

  // Customer QR pending/active TableSession occupies the table even before dining starts.
  if (!activeSession) {
    const blockingCustomer = await prisma.tableSession.findFirst({
      where: {
        tableId,
        restaurantId,
        isActive: true,
        ...blockingTableSessionStatusFilter(),
      },
      select: { id: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    if (blockingCustomer) {
      activeSession = {
        id: blockingCustomer.id,
        status: blockingCustomer.status,
      };
    }
  }

  const settings = await getRestaurantReservationSettings(restaurantId);
  const candidates = await findReservationsForTable(tableId);
  const { holdReservation, occupiedReservation } = classifyReservationsForTable(
    candidates,
    now,
    Boolean(activeSession),
    settings.averageDiningMinutes
  );

  return buildAvailabilitySnapshot({
    table,
    activeSession,
    holdReservation,
    occupiedReservation,
    reservationId: options?.reservationId,
    now,
  });
}

/** Shared reservation select used by restaurant-wide availability + floor compose. */
export const AVAILABILITY_RESERVATION_SELECT = {
  id: true,
  tableId: true,
  guestName: true,
  guestCount: true,
  reservedAt: true,
  holdExpiresAt: true,
  status: true,
} as const;

export async function loadAvailabilitySourceData(restaurantId: string) {
  const [tables, sessions, customerSessions, reservations] = await Promise.all([
    prisma.table.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, isActive: true, status: true },
    }),
    prisma.diningSession.findMany({
      where: {
        restaurantId,
        ...activeDiningSessionStatusFilter(),
      },
      select: { id: true, tableId: true, status: true },
    }),
    prisma.tableSession.findMany({
      where: {
        restaurantId,
        isActive: true,
        ...blockingTableSessionStatusFilter(),
      },
      select: { id: true, tableId: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reservation.findMany({
      where: {
        restaurantId,
        tableId: { not: null },
        ...blockingReservationStatusFilter(),
      },
      select: AVAILABILITY_RESERVATION_SELECT,
      orderBy: { reservedAt: "asc" },
    }),
  ]);

  return {
    tables: tables as AvailabilityTableRow[],
    sessions: sessions as AvailabilitySessionRow[],
    customerSessions: customerSessions as AvailabilitySessionRow[],
    reservations: reservations as AvailabilityReservationRow[],
  };
}

export async function getRestaurantTablesAvailability(
  restaurantId: string,
  now = new Date()
): Promise<Map<string, TableAvailabilitySnapshot>> {
  // No processExpiredReservationHolds — see getTableAvailability.
  const [data, settings] = await Promise.all([
    loadAvailabilitySourceData(restaurantId),
    getRestaurantReservationSettings(restaurantId),
  ]);
  return buildAvailabilityMap({
    ...data,
    now,
    averageDiningMinutes: settings.averageDiningMinutes,
  });
}

export async function assertTableAvailableForSession(
  restaurantId: string,
  tableId: string,
  options?: {
    reservationId?: string | null;
    now?: Date;
  }
): Promise<TableAvailabilitySnapshot> {
  const snapshot = await getTableAvailability(restaurantId, tableId, {
    now: options?.now,
    reservationId: options?.reservationId,
  });

  if (!snapshot) {
    throw new AppError("Table not found", "NOT_FOUND", 404);
  }

  if (snapshot.canStartSession) {
    return snapshot;
  }

  const reason = snapshot.blockReason ?? "Table is not available";

  if (reason === "Table has an active session") {
    throw new AppError(reason, "TABLE_HAS_ACTIVE_SESSION", 409);
  }

  if (reason === TABLE_RESERVATION_BLOCKED_MESSAGE) {
    throw new AppError(reason, "TABLE_RESERVATION_BLOCKED", 409);
  }

  if (
    reason.startsWith("This table has a reservation") ||
    reason.startsWith("This table has an active reservation")
  ) {
    const code = reason.includes("active reservation")
      ? "RESERVATION_ACTIVE"
      : "RESERVATION_OVERLAP";
    throw new AppError(reason, code, 409);
  }

  throw new AppError(reason, "TABLE_NOT_AVAILABLE", 400);
}

/** @deprecated Use assertTableAvailableForSession */
export async function assertCanStartSession(
  tableId: string,
  options: {
    restaurantId: string;
    reservationId?: string | null;
    now?: Date;
  }
): Promise<TableAvailabilitySnapshot> {
  return assertTableAvailableForSession(options.restaurantId, tableId, options);
}
