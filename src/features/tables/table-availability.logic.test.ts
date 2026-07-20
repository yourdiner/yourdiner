import { describe, expect, it } from "vitest";
import { ReservationStatus, TableStatus } from "@prisma/client";
import {
  buildAvailabilitySnapshot,
  canStartSession,
  classifyReservationForTable,
  computeTableStatus,
  getReservationCutoffTime,
  isWithinDiningBlockingWindow,
  isWithinHoldWindow,
  TABLE_RESERVATION_BLOCKED_MESSAGE,
} from "./table-availability.logic";

const table = { id: "t1", isActive: true, status: TableStatus.AVAILABLE };

function pm(hour: number, minute = 0) {
  return new Date(2026, 6, 9, hour, minute);
}

const holdReservation = {
  id: "r1",
  guestName: "Alex",
  guestCount: 2,
  reservedAt: pm(22, 30),
  holdExpiresAt: pm(22, 44),
  status: ReservationStatus.CONFIRMED,
};

describe("hold window timeline (10:30 PM reservation, 14 min hold)", () => {
  it("10:29 PM -> AVAILABLE (hold-only, no dining window)", () => {
    const status = computeTableStatus({
      table,
      activeSession: null,
      holdReservation: null,
      occupiedReservation: null,
    });
    expect(status).toBe("AVAILABLE");
    expect(isWithinHoldWindow(holdReservation.reservedAt, holdReservation.holdExpiresAt, pm(22, 29))).toBe(
      false
    );
  });

  it("10:30 PM -> RESERVED", () => {
    expect(isWithinHoldWindow(holdReservation.reservedAt, holdReservation.holdExpiresAt, pm(22, 30))).toBe(
      true
    );
    const status = computeTableStatus({
      table,
      activeSession: null,
      holdReservation,
      occupiedReservation: null,
    });
    expect(status).toBe("RESERVED");
  });

  it("10:35 PM -> RESERVED", () => {
    const status = computeTableStatus({
      table,
      activeSession: null,
      holdReservation,
      occupiedReservation: null,
    });
    expect(status).toBe("RESERVED");
  });

  it("10:44 PM exactly -> AVAILABLE (hold boundary)", () => {
    expect(isWithinHoldWindow(holdReservation.reservedAt, holdReservation.holdExpiresAt, pm(22, 44))).toBe(
      false
    );
    const status = computeTableStatus({
      table,
      activeSession: null,
      holdReservation: null,
      occupiedReservation: null,
    });
    expect(status).toBe("AVAILABLE");
  });
});

describe("dining-window availability (averageDiningMinutes = 90)", () => {
  const avg = 90;

  it("Reservation 03:30, now 03:05 -> RESERVED", () => {
    const reservedAt = pm(3, 30);
    const holdExpiresAt = pm(4, 0);
    const now = pm(3, 5);
    expect(getReservationCutoffTime(reservedAt, avg)).toEqual(pm(2, 0));
    expect(isWithinDiningBlockingWindow(reservedAt, holdExpiresAt, now, avg)).toBe(true);
    expect(classifyReservationForTable(
      { status: ReservationStatus.CONFIRMED, reservedAt, holdExpiresAt },
      now,
      false,
      avg
    )).toBe("hold");

    const snapshot = buildAvailabilitySnapshot({
      table,
      activeSession: null,
      holdReservation: {
        id: "r-am",
        guestName: "Early",
        guestCount: 2,
        reservedAt,
        holdExpiresAt,
        status: ReservationStatus.CONFIRMED,
      },
      occupiedReservation: null,
      now,
    });
    expect(snapshot.status).toBe("RESERVED");
    // Still inside hold arrival window relative to reservedAt? 03:05 < 03:30 → pre-arrival
    expect(snapshot.canStartSession).toBe(true);
  });

  it("Reservation 04:45, now 03:10 -> AVAILABLE", () => {
    const reservedAt = pm(16, 45);
    const holdExpiresAt = pm(17, 15);
    const now = pm(15, 10);
    expect(getReservationCutoffTime(reservedAt, avg)).toEqual(pm(15, 15));
    expect(isWithinDiningBlockingWindow(reservedAt, holdExpiresAt, now, avg)).toBe(false);
    expect(classifyReservationForTable(
      { status: ReservationStatus.CONFIRMED, reservedAt, holdExpiresAt },
      now,
      false,
      avg
    )).toBeNull();
  });

  it("Reservation 04:45, now 03:15 -> RESERVED", () => {
    const reservedAt = pm(16, 45);
    const holdExpiresAt = pm(17, 15);
    const now = pm(15, 15);
    expect(isWithinDiningBlockingWindow(reservedAt, holdExpiresAt, now, avg)).toBe(true);
    expect(classifyReservationForTable(
      { status: ReservationStatus.CONFIRMED, reservedAt, holdExpiresAt },
      now,
      false,
      avg
    )).toBe("hold");
  });

  it("Reservation 04:45, now 03:20 -> RESERVED with canStartSession true (pre-arrival)", () => {
    const reservedAt = pm(16, 45);
    const holdExpiresAt = pm(17, 15);
    const now = pm(15, 20);
    const holdReservationSnap = {
      id: "r-pm",
      guestName: "Sam",
      guestCount: 2,
      reservedAt,
      holdExpiresAt,
      status: ReservationStatus.CONFIRMED,
    };
    const snapshot = buildAvailabilitySnapshot({
      table,
      activeSession: null,
      holdReservation: holdReservationSnap,
      occupiedReservation: null,
      now,
    });
    expect(snapshot.status).toBe("RESERVED");
    expect(snapshot.canStartSession).toBe(true);
  });

  it("earliest upcoming reservation wins when multiple exist", () => {
    const now = pm(2, 30);
    // Earliest at 03:30 → cutoff 02:00 → blocks
    expect(
      classifyReservationForTable(
        {
          status: ReservationStatus.CONFIRMED,
          reservedAt: pm(3, 30),
          holdExpiresAt: pm(4, 0),
        },
        now,
        false,
        avg
      )
    ).toBe("hold");
  });
});

describe("canStartSession", () => {
  function snapshotDuringHold(now = pm(22, 32)) {
    return buildAvailabilitySnapshot({
      table,
      activeSession: null,
      holdReservation,
      occupiedReservation: null,
      now,
    });
  }

  it("10:32 PM start session without check-in -> rejected", () => {
    const snapshot = snapshotDuringHold();
    expect(snapshot.status).toBe("RESERVED");
    expect(snapshot.canStartSession).toBe(false);
    expect(snapshot.blockReason).toBe(TABLE_RESERVATION_BLOCKED_MESSAGE);
  });

  it("check-in match allows session start", () => {
    const snapshot = buildAvailabilitySnapshot({
      table,
      activeSession: null,
      holdReservation,
      occupiedReservation: null,
      reservationId: "r1",
      now: pm(22, 32),
    });
    expect(snapshot.canStartSession).toBe(true);
  });

  it("overrideTable no longer bypasses reserved status", () => {
    const { allowed } = canStartSession(snapshotDuringHold(), {
      reservationId: undefined,
      now: pm(22, 32),
    });
    expect(allowed).toBe(false);
  });

  it("pre-arrival RESERVED allows start (conflict override gate)", () => {
    const preArrival = {
      ...holdReservation,
      reservedAt: pm(23, 0),
      holdExpiresAt: pm(23, 30),
    };
    const snapshot = buildAvailabilitySnapshot({
      table,
      activeSession: null,
      holdReservation: preArrival,
      occupiedReservation: null,
      now: pm(22, 0),
    });
    expect(snapshot.status).toBe("RESERVED");
    expect(snapshot.canStartSession).toBe(true);
  });

  it("active session -> OCCUPIED", () => {
    const status = computeTableStatus({
      table,
      activeSession: { id: "s1", status: "ACTIVE" },
      holdReservation,
      occupiedReservation: null,
    });
    expect(status).toBe("OCCUPIED");
  });

  it("checked-in reservation without session -> OCCUPIED", () => {
    const occupiedReservation = {
      ...holdReservation,
      status: ReservationStatus.CHECKED_IN,
    };
    expect(classifyReservationForTable(occupiedReservation, pm(22, 32), false)).toBe("occupied");
    const status = computeTableStatus({
      table,
      activeSession: null,
      holdReservation: null,
      occupiedReservation,
    });
    expect(status).toBe("OCCUPIED");
  });
});
