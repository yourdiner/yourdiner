import { describe, expect, it } from "vitest";
import { ReservationStatus } from "@prisma/client";
import {
  computeExpectedFinishTime,
  evaluateSessionReservationConflict,
  formatReservationOverlapMessage,
  resolveConflictWithPolicy,
} from "./reservation-conflict.logic";

function at(hour: number, minute = 0) {
  return new Date(2026, 6, 12, hour, minute, 0, 0);
}

const baseReservation = {
  id: "res-1",
  guestName: "Alex",
  holdExpiresAt: at(17, 0),
  status: ReservationStatus.CONFIRMED as ReservationStatus,
};

const overlapConflictInput = {
  now: at(15, 40),
  averageDiningMinutes: 90,
  cleaningBufferMinutes: 0,
  reservations: [{ ...baseReservation, reservedAt: at(16, 30) }],
};

describe("computeExpectedFinishTime", () => {
  it("adds average dining + cleaning buffer", () => {
    const finish = computeExpectedFinishTime(at(15, 40), 90, 0);
    expect(finish.getTime()).toBe(at(17, 10).getTime());
  });

  it("includes cleaning buffer minutes", () => {
    const finish = computeExpectedFinishTime(at(15, 40), 90, 15);
    expect(finish.getTime()).toBe(at(17, 25).getTime());
  });
});

describe("evaluateSessionReservationConflict", () => {
  it("allows session when no upcoming reservation exists", () => {
    const result = evaluateSessionReservationConflict({
      now: at(15, 40),
      averageDiningMinutes: 90,
      cleaningBufferMinutes: 0,
      reservations: [],
    });
    expect(result).toEqual({ allowed: true });
  });

  it("allows session when it finishes before the next reservation", () => {
    const result = evaluateSessionReservationConflict({
      now: at(15, 40),
      averageDiningMinutes: 30,
      cleaningBufferMinutes: 0,
      reservations: [{ ...baseReservation, reservedAt: at(16, 30) }],
    });
    expect(result).toEqual({ allowed: true });
  });

  it("rejects session when expected finish overlaps the next reservation", () => {
    const result = evaluateSessionReservationConflict(overlapConflictInput);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("RESERVATION_OVERLAP");
      expect(result.message).toBe(formatReservationOverlapMessage(at(16, 30)));
      expect(result.reservationId).toBe("res-1");
      expect(result.expectedFinish.getTime()).toBe(at(17, 10).getTime());
    }
  });

  it("rejects when a reservation hold is already active", () => {
    const reservedAt = at(15, 30);
    const result = evaluateSessionReservationConflict({
      now: at(15, 40),
      averageDiningMinutes: 90,
      cleaningBufferMinutes: 0,
      reservations: [
        {
          ...baseReservation,
          reservedAt,
          holdExpiresAt: at(16, 0),
          status: ReservationStatus.CONFIRMED,
        },
      ],
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("RESERVATION_ACTIVE");
    }
  });

  it("rejects when reservation is already checked in / dining", () => {
    const result = evaluateSessionReservationConflict({
      now: at(15, 40),
      averageDiningMinutes: 30,
      cleaningBufferMinutes: 0,
      reservations: [
        {
          ...baseReservation,
          reservedAt: at(15, 0),
          holdExpiresAt: at(15, 30),
          status: ReservationStatus.DINING,
        },
      ],
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("RESERVATION_ACTIVE");
    }
  });

  it("allows when the reservation hold has expired", () => {
    const result = evaluateSessionReservationConflict({
      now: at(16, 10),
      averageDiningMinutes: 30,
      cleaningBufferMinutes: 0,
      reservations: [
        {
          ...baseReservation,
          reservedAt: at(15, 30),
          holdExpiresAt: at(16, 0),
          status: ReservationStatus.CONFIRMED,
        },
      ],
    });
    expect(result).toEqual({ allowed: true });
  });

  it("ignores the reservation being checked in via excludeReservationId", () => {
    const result = evaluateSessionReservationConflict({
      now: at(16, 30),
      averageDiningMinutes: 90,
      cleaningBufferMinutes: 0,
      reservations: [{ ...baseReservation, reservedAt: at(16, 30), holdExpiresAt: at(17, 0) }],
      excludeReservationId: "res-1",
    });
    expect(result).toEqual({ allowed: true });
  });

  it("uses the earliest upcoming reservation when multiple exist", () => {
    const result = evaluateSessionReservationConflict({
      now: at(15, 40),
      averageDiningMinutes: 90,
      cleaningBufferMinutes: 0,
      reservations: [
        { ...baseReservation, id: "later", reservedAt: at(18, 0), holdExpiresAt: at(18, 30) },
        { ...baseReservation, id: "soon", reservedAt: at(16, 30), holdExpiresAt: at(17, 0) },
      ],
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reservationId).toBe("soon");
    }
  });

  it("allows when expected finish equals reservation start", () => {
    const result = evaluateSessionReservationConflict({
      now: at(15, 40),
      averageDiningMinutes: 50,
      cleaningBufferMinutes: 0,
      reservations: [{ ...baseReservation, reservedAt: at(16, 30) }],
    });
    expect(result).toEqual({ allowed: true });
  });
});

describe("resolveConflictWithPolicy", () => {
  const conflict = evaluateSessionReservationConflict(overlapConflictInput);
  if (conflict.allowed) throw new Error("expected overlap conflict");

  it("BLOCK rejects overlapping sessions", () => {
    const resolved = resolveConflictWithPolicy({
      conflict,
      policy: "BLOCK",
    });
    expect(resolved.decision).toBe("BLOCK");
    if (resolved.decision === "BLOCK") {
      expect(resolved.canOverride).toBe(false);
    }
  });

  it("WARN without acknowledgment returns first warning", () => {
    const resolved = resolveConflictWithPolicy({
      conflict,
      policy: "WARN",
    });
    expect(resolved.decision).toBe("WARN");
    if (resolved.decision === "WARN") {
      expect(resolved.canOverride).toBe(true);
    }
  });

  it("WARN cancel path leaves session uncreated (no ALLOW without override)", () => {
    const resolved = resolveConflictWithPolicy({
      conflict,
      policy: "WARN",
      overrideAcknowledged: false,
    });
    expect(resolved.decision).toBe("WARN");
  });

  it("WARN with override acknowledgment allows session", () => {
    const resolved = resolveConflictWithPolicy({
      conflict,
      policy: "WARN",
      overrideAcknowledged: true,
    });
    expect(resolved.decision).toBe("ALLOW_WITH_OVERRIDE");
  });

  it("never allows override for active reservation holds", () => {
    const active = evaluateSessionReservationConflict({
      now: at(15, 40),
      averageDiningMinutes: 30,
      cleaningBufferMinutes: 0,
      reservations: [
        {
          ...baseReservation,
          reservedAt: at(15, 30),
          holdExpiresAt: at(16, 0),
          status: ReservationStatus.CONFIRMED,
        },
      ],
    });
    expect(active.allowed).toBe(false);
    if (active.allowed) return;

    const resolved = resolveConflictWithPolicy({
      conflict: active,
      policy: "WARN",
      overrideAcknowledged: true,
    });
    expect(resolved.decision).toBe("BLOCK");
  });

  it("allows when there is no conflict regardless of policy", () => {
    expect(
      resolveConflictWithPolicy({
        conflict: { allowed: true },
        policy: "BLOCK",
      }).decision
    ).toBe("ALLOW");
  });
});
