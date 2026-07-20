import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReservationStatus, TableStatus } from "@prisma/client";

const getActiveDiningSessionForTable = vi.fn();

vi.mock("@/lib/dining-session", () => ({
  getActiveDiningSessionForTable,
}));

vi.mock("@/lib/reservation-settings", () => ({
  getRestaurantReservationSettings: vi.fn().mockResolvedValue({
    autoMarkNoShow: true,
    holdTimeMinutes: 14,
    averageDiningMinutes: 90,
    cleaningBufferMinutes: 0,
    reservationConflictPolicy: "BLOCK",
  }),
}));

vi.mock("@/features/reservations/reservation.service", () => ({
  markNoShow: vi.fn(),
}));

const prisma = {
  table: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  reservation: {
    findMany: vi.fn(),
  },
  diningSession: {
    findMany: vi.fn(),
  },
  tableSession: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ prisma }));

describe("table availability service integration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getActiveDiningSessionForTable.mockResolvedValue(null);
    prisma.tableSession.findFirst.mockResolvedValue(null);
    prisma.tableSession.findMany.mockResolvedValue([]);
    prisma.table.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      isActive: true,
      status: TableStatus.AVAILABLE,
    }));
    const { getRestaurantReservationSettings } = await import("@/lib/reservation-settings");
    vi.mocked(getRestaurantReservationSettings).mockResolvedValue({
      enabled: true,
      autoMarkNoShow: true,
      holdTimeMinutes: 14,
      averageDiningMinutes: 90,
      cleaningBufferMinutes: 0,
      autoReleaseOnNoShow: true,
      allowWalkInOverride: true,
      reservationIntervalMinutes: 30,
      reservationConflictPolicy: "BLOCK",
    });
  });

  it("assertTableAvailableForSession rejects during hold window", async () => {
    const now = new Date(2026, 6, 9, 22, 32);
    const tableId = "table-1";
    const restaurantId = "rest-1";

    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        guestName: "Jordan",
        guestCount: 2,
        reservedAt: new Date(2026, 6, 9, 22, 30),
        holdExpiresAt: new Date(2026, 6, 9, 22, 44),
        status: ReservationStatus.CONFIRMED,
      },
    ]);

    const { assertTableAvailableForSession } = await import("./table-availability.service");

    await expect(
      assertTableAvailableForSession(restaurantId, tableId, { now })
    ).rejects.toMatchObject({
      code: "TABLE_RESERVATION_BLOCKED",
    });
  });

  it("assertTableAvailableForSession allows matching reservation check-in", async () => {
    const now = new Date(2026, 6, 9, 22, 32);
    const tableId = "table-1";
    const restaurantId = "rest-1";

    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        guestName: "Jordan",
        guestCount: 2,
        reservedAt: new Date(2026, 6, 9, 22, 30),
        holdExpiresAt: new Date(2026, 6, 9, 22, 44),
        status: ReservationStatus.CONFIRMED,
      },
    ]);

    const { assertTableAvailableForSession } = await import("./table-availability.service");

    const snapshot = await assertTableAvailableForSession(restaurantId, tableId, {
      reservationId: "res-1",
      now,
    });

    expect(snapshot.canStartSession).toBe(true);
    expect(snapshot.status).toBe("RESERVED");
  });

  it("assertTableAvailableForSession leaves dining-window RESERVED open for conflict gate", async () => {
    // Status becomes RESERVED once now >= reservedAt - averageDiningMinutes,
    // but canStartSession stays true pre-arrival so BLOCK/WARN override can run.
    const now = new Date(2026, 6, 12, 15, 40);
    const tableId = "table-1";
    const restaurantId = "rest-1";

    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-upcoming",
        guestName: "Sam",
        guestCount: 2,
        reservedAt: new Date(2026, 6, 12, 16, 30),
        holdExpiresAt: new Date(2026, 6, 12, 17, 0),
        status: ReservationStatus.CONFIRMED,
      },
    ]);

    const { assertTableAvailableForSession } = await import("./table-availability.service");

    const snapshot = await assertTableAvailableForSession(restaurantId, tableId, { now });
    expect(snapshot.status).toBe("RESERVED");
    expect(snapshot.canStartSession).toBe(true);
  });

  it("marks table OCCUPIED while customer QR session is pending approval", async () => {
    const now = new Date(2026, 6, 12, 15, 40);
    const tableId = "table-1";
    const restaurantId = "rest-1";

    prisma.reservation.findMany.mockResolvedValue([]);
    prisma.tableSession.findFirst.mockResolvedValue({
      id: "ts-pending",
      status: "PENDING_APPROVAL",
    });

    const { getTableAvailability } = await import("./table-availability.service");
    const snapshot = await getTableAvailability(restaurantId, tableId, { now });

    expect(snapshot?.status).toBe("OCCUPIED");
    expect(snapshot?.canStartSession).toBe(false);
  });

  it("assertTableAvailableForSession allows walk-in that finishes before reservation", async () => {
    // Same clock, but dining is only 30 min → finish 4:10 <= 4:30
    const now = new Date(2026, 6, 12, 15, 40);
    const tableId = "table-1";
    const restaurantId = "rest-1";

    const { getRestaurantReservationSettings } = await import("@/lib/reservation-settings");
    vi.mocked(getRestaurantReservationSettings).mockResolvedValue({
      enabled: true,
      averageDiningMinutes: 30,
      holdTimeMinutes: 30,
      cleaningBufferMinutes: 0,
      autoMarkNoShow: true,
      autoReleaseOnNoShow: true,
      allowWalkInOverride: true,
      reservationIntervalMinutes: 30,
      reservationConflictPolicy: "BLOCK",
    });

    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-upcoming",
        guestName: "Sam",
        guestCount: 2,
        reservedAt: new Date(2026, 6, 12, 16, 30),
        holdExpiresAt: new Date(2026, 6, 12, 17, 0),
        status: ReservationStatus.CONFIRMED,
      },
    ]);

    const { assertTableAvailableForSession } = await import("./table-availability.service");

    const snapshot = await assertTableAvailableForSession(restaurantId, tableId, { now });
    expect(snapshot.status).toBe("AVAILABLE");
    expect(snapshot.canStartSession).toBe(true);
  });

  it("getRestaurantTablesAvailability marks table RESERVED during hold with stale Table.status", async () => {
    const tableId = "table-1";
    const restaurantId = "rest-1";
    const now = new Date(2026, 6, 9, 22, 35);

    prisma.table.findMany.mockResolvedValue([
      {
        id: tableId,
        isActive: true,
        status: TableStatus.AVAILABLE,
      },
    ]);

    prisma.diningSession.findMany.mockResolvedValue([]);

    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        tableId,
        guestName: "Jordan",
        guestCount: 2,
        reservedAt: new Date(2026, 6, 9, 22, 30),
        holdExpiresAt: new Date(2026, 6, 9, 22, 44),
        status: ReservationStatus.CONFIRMED,
      },
    ]);

    const { getRestaurantTablesAvailability } = await import("./table-availability.service");

    const availability = await getRestaurantTablesAvailability(restaurantId, now);
    const snapshot = availability.get(tableId);

    expect(snapshot?.status).toBe("RESERVED");
    expect(snapshot?.blockingReservation?.guestName).toBe("Jordan");
  });
});
