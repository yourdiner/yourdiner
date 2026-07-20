import { ReservationStatus } from "@prisma/client";
import { formatTime } from "@/lib/utils";
import type { ReservationConflictPolicy } from "@/lib/reservation-settings";

export type ConflictReservationCandidate = {
  id: string;
  reservedAt: Date;
  holdExpiresAt: Date;
  status: ReservationStatus;
  guestName?: string;
};

export type SessionReservationConflictDenied = {
  allowed: false;
  code: "RESERVATION_OVERLAP" | "RESERVATION_ACTIVE";
  message: string;
  reservationId: string;
  reservedAt: Date;
  now: Date;
  expectedFinish: Date;
};

export type SessionReservationConflictResult =
  | { allowed: true }
  | SessionReservationConflictDenied;

export type ConflictPolicyDecision =
  | { decision: "ALLOW" }
  | {
      decision: "ALLOW_WITH_OVERRIDE";
      conflict: SessionReservationConflictDenied;
    }
  | {
      decision: "BLOCK";
      conflict: SessionReservationConflictDenied;
      canOverride: false;
    }
  | {
      decision: "WARN";
      conflict: SessionReservationConflictDenied;
      canOverride: true;
    };

export function computeExpectedFinishTime(
  now: Date,
  averageDiningMinutes: number,
  cleaningBufferMinutes: number
): Date {
  const finish = new Date(now);
  finish.setMinutes(
    finish.getMinutes() + averageDiningMinutes + cleaningBufferMinutes
  );
  return finish;
}

export function formatReservationOverlapMessage(reservedAt: Date): string {
  return `This table has a reservation at ${formatTime(reservedAt)}. Based on the restaurant's average dining time, starting a new session would overlap with the reservation.`;
}

export function formatReservationActiveMessage(reservedAt: Date): string {
  return `This table has an active reservation at ${formatTime(reservedAt)}. Starting a new dining session is not allowed.`;
}

/**
 * Pure eligibility check: a walk-in session may not overrun the next CONFIRMED reservation.
 * Table display status (AVAILABLE) is independent of this eligibility decision.
 */
export function evaluateSessionReservationConflict(input: {
  now: Date;
  averageDiningMinutes: number;
  cleaningBufferMinutes: number;
  reservations: ConflictReservationCandidate[];
  excludeReservationId?: string | null;
}): SessionReservationConflictResult {
  const {
    now,
    averageDiningMinutes,
    cleaningBufferMinutes,
    reservations,
    excludeReservationId,
  } = input;

  const candidates = reservations.filter(
    (r) => !excludeReservationId || r.id !== excludeReservationId
  );

  const expectedFinish = computeExpectedFinishTime(
    now,
    averageDiningMinutes,
    cleaningBufferMinutes
  );

  // Already-active reservation holds / dining states block walk-ins immediately.
  const activeHold = candidates.find(
    (r) =>
      r.status === ReservationStatus.CONFIRMED &&
      r.reservedAt.getTime() <= now.getTime() &&
      now.getTime() < r.holdExpiresAt.getTime()
  );
  if (activeHold) {
    return {
      allowed: false,
      code: "RESERVATION_ACTIVE",
      message: formatReservationActiveMessage(activeHold.reservedAt),
      reservationId: activeHold.id,
      reservedAt: activeHold.reservedAt,
      now,
      expectedFinish,
    };
  }

  const activeDining = candidates.find(
    (r) =>
      r.status === ReservationStatus.CHECKED_IN ||
      r.status === ReservationStatus.DINING
  );
  if (activeDining) {
    return {
      allowed: false,
      code: "RESERVATION_ACTIVE",
      message: formatReservationActiveMessage(activeDining.reservedAt),
      reservationId: activeDining.id,
      reservedAt: activeDining.reservedAt,
      now,
      expectedFinish,
    };
  }

  // Earliest future CONFIRMED reservation (expired holds are ignored).
  const upcoming = candidates
    .filter(
      (r) =>
        r.status === ReservationStatus.CONFIRMED &&
        r.reservedAt.getTime() > now.getTime()
    )
    .sort((a, b) => a.reservedAt.getTime() - b.reservedAt.getTime())[0];

  if (!upcoming) {
    return { allowed: true };
  }

  if (expectedFinish.getTime() > upcoming.reservedAt.getTime()) {
    return {
      allowed: false,
      code: "RESERVATION_OVERLAP",
      message: formatReservationOverlapMessage(upcoming.reservedAt),
      reservationId: upcoming.id,
      reservedAt: upcoming.reservedAt,
      now,
      expectedFinish,
    };
  }

  return { allowed: true };
}

/**
 * Apply restaurant conflict policy. Active holds are never overridable.
 * WARN overlaps require `overrideAcknowledged` to proceed.
 */
export function resolveConflictWithPolicy(input: {
  conflict: SessionReservationConflictResult;
  policy: ReservationConflictPolicy;
  overrideAcknowledged?: boolean;
}): ConflictPolicyDecision {
  const { conflict, policy, overrideAcknowledged } = input;

  if (conflict.allowed) {
    return { decision: "ALLOW" };
  }

  if (conflict.code === "RESERVATION_ACTIVE") {
    return { decision: "BLOCK", conflict, canOverride: false };
  }

  if (policy === "BLOCK") {
    return { decision: "BLOCK", conflict, canOverride: false };
  }

  if (overrideAcknowledged) {
    return { decision: "ALLOW_WITH_OVERRIDE", conflict };
  }

  return { decision: "WARN", conflict, canOverride: true };
}
