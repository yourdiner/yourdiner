import { describe, expect, it } from "vitest";
import { TableStatus, ReservationStatus } from "@prisma/client";
import { buildAvailabilityMap } from "./table-availability.builder";
import { filterReservationConflicts } from "@/features/reservations/availability.service";

describe("buildAvailabilityMap", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");

  it("marks table AVAILABLE when no session or hold", () => {
    const map = buildAvailabilityMap({
      tables: [{ id: "t1", isActive: true, status: TableStatus.AVAILABLE }],
      sessions: [],
      customerSessions: [],
      reservations: [],
      now,
    });
    expect(map.get("t1")?.status).toBe("AVAILABLE");
    expect(map.get("t1")?.canStartSession).toBe(true);
  });

  it("prefers dining session over customer session and reservations", () => {
    const map = buildAvailabilityMap({
      tables: [{ id: "t1", isActive: true, status: TableStatus.AVAILABLE }],
      sessions: [{ id: "ds1", tableId: "t1", status: "ACTIVE" }],
      customerSessions: [{ id: "cs1", tableId: "t1", status: "PENDING_APPROVAL" }],
      reservations: [
        {
          id: "r1",
          tableId: "t1",
          guestName: "Ada",
          guestCount: 2,
          reservedAt: new Date("2026-07-14T11:30:00.000Z"),
          holdExpiresAt: new Date("2026-07-14T12:30:00.000Z"),
          status: ReservationStatus.CONFIRMED,
        },
      ],
      now,
    });
    expect(map.get("t1")?.status).toBe("OCCUPIED");
    expect(map.get("t1")?.activeSession?.id).toBe("ds1");
    expect(map.get("t1")?.blockingReservation).toBeNull();
  });

  it("ignores CONFIRMED holds outside hold window (same as expired without NO_SHOW write)", () => {
    const map = buildAvailabilityMap({
      tables: [{ id: "t1", isActive: true, status: TableStatus.AVAILABLE }],
      sessions: [],
      customerSessions: [],
      reservations: [
        {
          id: "r1",
          tableId: "t1",
          guestName: "Late",
          guestCount: 2,
          reservedAt: new Date("2026-07-14T10:00:00.000Z"),
          holdExpiresAt: new Date("2026-07-14T11:00:00.000Z"),
          status: ReservationStatus.CONFIRMED,
        },
      ],
      now,
    });
    expect(map.get("t1")?.status).toBe("AVAILABLE");
    expect(map.get("t1")?.canStartSession).toBe(true);
  });

  it("marks dining-window RESERVED when averageDiningMinutes is set", () => {
    const diningNow = new Date("2026-07-14T15:20:00.000Z");
    const map = buildAvailabilityMap({
      tables: [{ id: "t1", isActive: true, status: TableStatus.AVAILABLE }],
      sessions: [],
      customerSessions: [],
      reservations: [
        {
          id: "r1",
          tableId: "t1",
          guestName: "Ada",
          guestCount: 2,
          reservedAt: new Date("2026-07-14T16:45:00.000Z"),
          holdExpiresAt: new Date("2026-07-14T17:15:00.000Z"),
          status: ReservationStatus.CONFIRMED,
        },
      ],
      now: diningNow,
      averageDiningMinutes: 90,
    });
    expect(map.get("t1")?.status).toBe("RESERVED");
    expect(map.get("t1")?.canStartSession).toBe(true);
  });

  it("keeps AVAILABLE before dining cutoff", () => {
    const beforeCutoff = new Date("2026-07-14T15:10:00.000Z");
    const map = buildAvailabilityMap({
      tables: [{ id: "t1", isActive: true, status: TableStatus.AVAILABLE }],
      sessions: [],
      customerSessions: [],
      reservations: [
        {
          id: "r1",
          tableId: "t1",
          guestName: "Ada",
          guestCount: 2,
          reservedAt: new Date("2026-07-14T16:45:00.000Z"),
          holdExpiresAt: new Date("2026-07-14T17:15:00.000Z"),
          status: ReservationStatus.CONFIRMED,
        },
      ],
      now: beforeCutoff,
      averageDiningMinutes: 90,
    });
    expect(map.get("t1")?.status).toBe("AVAILABLE");
    expect(map.get("t1")?.canStartSession).toBe(true);
  });
});

describe("filterReservationConflicts", () => {
  it("detects overlapping PENDING/CONFIRMED using expectedEndAt", () => {
    const windowStart = new Date("2026-07-14T12:00:00.000Z");
    const windowEnd = new Date("2026-07-14T14:00:00.000Z");
    const conflicts = filterReservationConflicts(
      [
        {
          id: "r1",
          restaurantId: "rest",
          tableId: "t1",
          status: "CONFIRMED",
          reservedAt: new Date("2026-07-14T13:00:00.000Z"),
          expectedEndAt: new Date("2026-07-14T15:00:00.000Z"),
          diningSessionId: null,
          guestName: "Gue",
          diningSession: null,
        },
      ],
      windowStart,
      windowEnd
    );
    expect(conflicts).toHaveLength(1);
  });

  it("returns empty when windows do not overlap", () => {
    const windowStart = new Date("2026-07-14T12:00:00.000Z");
    const windowEnd = new Date("2026-07-14T13:00:00.000Z");
    const conflicts = filterReservationConflicts(
      [
        {
          id: "r1",
          restaurantId: "rest",
          tableId: "t1",
          status: "CONFIRMED",
          reservedAt: new Date("2026-07-14T15:00:00.000Z"),
          expectedEndAt: new Date("2026-07-14T17:00:00.000Z"),
          diningSessionId: null,
          guestName: "Gue",
          diningSession: null,
        },
      ],
      windowStart,
      windowEnd
    );
    expect(conflicts).toHaveLength(0);
  });
});
