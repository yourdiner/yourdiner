import { prisma } from "@/lib/db";
import { ReservationStatus } from "@prisma/client";
import {
  excludedCalendarReservationStatusFilter,
} from "./constants";
import { getRestaurantTablesAvailability, processExpiredReservationHolds } from "@/features/tables/table-availability.service";
import { isWithinHoldWindow } from "@/features/tables/table-availability.logic";

export type ReservationListFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  status?: ReservationStatus;
  tableId?: string;
  search?: string;
  limit?: number;
};

export type ReservationDisplayGroup =
  | "UPCOMING"
  | "RESERVED"
  | "LATE"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export function getReservationDisplayGroup(
  reservation: {
    status: ReservationStatus;
    reservedAt: Date;
    holdExpiresAt: Date;
  },
  now = new Date()
): ReservationDisplayGroup {
  switch (reservation.status) {
    case ReservationStatus.CHECKED_IN:
    case ReservationStatus.DINING:
      return "CHECKED_IN";
    case ReservationStatus.COMPLETED:
      return "COMPLETED";
    case ReservationStatus.CANCELLED:
      return "CANCELLED";
    case ReservationStatus.NO_SHOW:
      return "NO_SHOW";
    case ReservationStatus.CONFIRMED:
    case ReservationStatus.PENDING:
      if (
        reservation.status === ReservationStatus.CONFIRMED &&
        isWithinHoldWindow(reservation.reservedAt, reservation.holdExpiresAt, now)
      ) {
        return "RESERVED";
      }
      if (reservation.reservedAt > now) {
        return "UPCOMING";
      }
      return "LATE";
    default:
      return "UPCOMING";
  }
}

export async function listReservations(restaurantId: string, filters: ReservationListFilters = {}) {
  const limit = filters.limit ?? 100;

  return prisma.reservation.findMany({
    where: {
      restaurantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.tableId ? { tableId: filters.tableId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            reservedAt: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { guestName: { contains: filters.search, mode: "insensitive" } },
              { guestPhone: { contains: filters.search.replace(/\D/g, "").slice(-10) } },
            ],
          }
        : {}),
    },
    include: {
      table: { select: { id: true, name: true, number: true, capacity: true } },
      customer: { select: { id: true, name: true, phone: true } },
      diningSession: { select: { id: true, status: true } },
    },
    orderBy: { reservedAt: "asc" },
    take: limit,
  });
}

export async function getReservationDetail(reservationId: string, restaurantId: string) {
  return prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
    include: {
      table: true,
      customer: true,
      diningSession: true,
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

export async function getReservationsDashboard(restaurantId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const now = new Date();

  await processExpiredReservationHolds(restaurantId, now);

  const [today, availability] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        restaurantId,
        reservedAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        table: { select: { id: true, name: true, number: true } },
      },
      orderBy: { reservedAt: "asc" },
    }),
    getRestaurantTablesAvailability(restaurantId, now),
  ]);

  const counts = {
    upcoming: today.filter((r) => getReservationDisplayGroup(r, now) === "UPCOMING").length,
    reserved: today.filter((r) => getReservationDisplayGroup(r, now) === "RESERVED").length,
    late: today.filter((r) => getReservationDisplayGroup(r, now) === "LATE").length,
    checkedIn: today.filter((r) => getReservationDisplayGroup(r, now) === "CHECKED_IN").length,
    noShow: today.filter((r) => r.status === "NO_SHOW").length,
    cancelled: today.filter((r) => r.status === "CANCELLED").length,
    completed: today.filter((r) => r.status === "COMPLETED").length,
  };

  let tablesReserved = 0;
  let tablesAvailable = 0;

  for (const snapshot of availability.values()) {
    if (snapshot.status === "AVAILABLE") {
      tablesAvailable++;
    } else if (snapshot.status === "RESERVED" || snapshot.status === "OCCUPIED") {
      tablesReserved++;
    }
  }

  const todayWithGroups = today.map((r) => ({
    ...r,
    displayGroup: getReservationDisplayGroup(r, now),
  }));

  return {
    today: todayWithGroups,
    counts,
    tablesReserved,
    tablesAvailable,
  };
}

export async function getCalendarData(restaurantId: string, day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const [tables, reservations, sessions] = await Promise.all([
    prisma.table.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { number: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        restaurantId,
        reservedAt: { gte: start, lte: end },
        ...excludedCalendarReservationStatusFilter(),
      },
      include: { table: true },
      orderBy: { reservedAt: "asc" },
    }),
    prisma.diningSession.findMany({
      where: {
        restaurantId,
        status: { in: ["ACTIVE", "BILL_REQUESTED"] },
        startedAt: { lte: end },
      },
      include: { table: true },
    }),
  ]);

  return { tables, reservations, sessions, day: start };
}
