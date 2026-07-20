import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-session";
import { requireTenantContext } from "@/lib/tenancy";
import {
  activeDiningSessionStatusFilter,
  blockingReservationStatusFilter,
  blockingTableSessionStatusFilter,
  terminalOrderStatusFilter,
} from "@/lib/prisma-filters";
import {
  AVAILABILITY_RESERVATION_SELECT,
  buildAvailabilityMap,
} from "@/features/tables/table-availability.service";
import { getRestaurantReservationSettings } from "@/lib/reservation-settings";
import { consolidateOpenOrdersForSession } from "@/features/dining-session/order.service";

export async function fetchFloorTablesForRestaurant(restaurantId: string) {
  const now = new Date();

  // Single load: tables + rich sessions + customer sessions + reservations (no second
  // tables/sessions pass via getRestaurantTablesAvailability).
  const [tables, sessions, customerSessions, reservations, settings] = await Promise.all([
    prisma.table.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { number: "asc" },
    }),
    prisma.diningSession.findMany({
      where: {
        restaurantId,
        ...activeDiningSessionStatusFilter(),
      },
      include: {
        staff: { select: { id: true, displayName: true } },
        customer: { select: { name: true } },
        orders: {
          where: terminalOrderStatusFilter(),
          select: { id: true, total: true, status: true },
          orderBy: { createdAt: "asc" },
        },
      },
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
    getRestaurantReservationSettings(restaurantId),
  ]);

  const multi = sessions.filter((s) => s.orders.length > 1);
  let floorSessions = sessions;
  if (multi.length > 0) {
    await Promise.all(multi.map((s) => consolidateOpenOrdersForSession(s.id, restaurantId)));
    floorSessions = await prisma.diningSession.findMany({
      where: {
        restaurantId,
        ...activeDiningSessionStatusFilter(),
      },
      include: {
        staff: { select: { id: true, displayName: true } },
        customer: { select: { name: true } },
        orders: {
          where: terminalOrderStatusFilter(),
          select: { id: true, total: true, status: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
  } else {
    floorSessions = sessions.map((s) => ({
      ...s,
      orders: s.orders.slice(0, 1),
    }));
  }

  const slimSessions = floorSessions.map((s) => ({
    id: s.id,
    tableId: s.tableId,
    status: s.status,
  }));

  const availability = buildAvailabilityMap({
    tables: tables.map((t) => ({
      id: t.id,
      isActive: t.isActive,
      status: t.status,
    })),
    sessions: slimSessions,
    customerSessions,
    reservations,
    now,
    averageDiningMinutes: settings.averageDiningMinutes,
  });

  const sessionByTable = new Map(floorSessions.map((s) => [s.tableId, s]));

  return tables.map((table) => {
    const snapshot = availability.get(table.id);
    return {
      ...table,
      diningSession: sessionByTable.get(table.id) ?? null,
      availability: snapshot ?? null,
      activeReservation: snapshot?.blockingReservation ?? null,
      status: snapshot?.status ?? "AVAILABLE",
      canStartSession: snapshot?.canStartSession ?? true,
      blockReason: snapshot?.blockReason ?? null,
    };
  });
}

export async function getFloorTables() {
  const staffSession = await getStaffSession();
  if (!staffSession) redirect("/staff/login");

  const tenant = await requireTenantContext();
  if (staffSession.restaurantId !== tenant.restaurantId) redirect("/staff/login");

  const tables = await fetchFloorTablesForRestaurant(tenant.restaurantId);
  return {
    tables,
    viewer: {
      staffId: staffSession.staffId,
      role: staffSession.role,
    },
  };
}

export async function getFloorTableDetail(tableId: string) {
  const staffSession = await getStaffSession();
  if (!staffSession) redirect("/staff/login");

  const tenant = await requireTenantContext();
  if (staffSession.restaurantId !== tenant.restaurantId) redirect("/staff/login");

  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId: tenant.restaurantId },
  });
  if (!table) redirect("/staff/floor");

  const { getTableAvailability } = await import("@/features/tables/table-availability.service");
  const availability = await getTableAvailability(tenant.restaurantId, tableId);

  const diningSession = availability?.activeSession
    ? await prisma.diningSession.findUnique({
        where: { id: availability.activeSession.id },
        include: {
          staff: { select: { displayName: true } },
          customer: { select: { name: true } },
          orders: {
            where: terminalOrderStatusFilter(),
            select: { id: true, total: true, status: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      })
    : null;

  return { table, diningSession, availability };
}
