import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getRestaurantReservationSettings } from "@/lib/reservation-settings";
import { formatTime } from "@/lib/utils";
import { ReservationStatus } from "@prisma/client";
import type { OrderActor } from "@/features/dining-session/auth";
import { actorDisplayName, actorUserId } from "@/features/dining-session/auth-helpers";
import {
  evaluateSessionReservationConflict,
  resolveConflictWithPolicy,
  type ConflictReservationCandidate,
  type SessionReservationConflictDenied,
  type SessionReservationConflictResult,
} from "./reservation-conflict.logic";

export {
  computeExpectedFinishTime,
  evaluateSessionReservationConflict,
  formatReservationOverlapMessage,
  resolveConflictWithPolicy,
  type SessionReservationConflictResult,
  type SessionReservationConflictDenied,
  type ConflictPolicyDecision,
} from "./reservation-conflict.logic";

export type ReservationConflictPayload = {
  code: "RESERVATION_OVERLAP" | "RESERVATION_ACTIVE";
  policy: "BLOCK" | "WARN";
  canOverride: boolean;
  reservationId: string;
  reservedAt: string;
  currentTime: string;
  expectedFinish: string;
  reservedAtLabel: string;
  currentTimeLabel: string;
  expectedFinishLabel: string;
  message: string;
};

async function loadConflictCandidates(
  tableId: string
): Promise<ConflictReservationCandidate[]> {
  return prisma.reservation.findMany({
    where: {
      tableId,
      status: {
        in: [
          ReservationStatus.CONFIRMED,
          ReservationStatus.CHECKED_IN,
          ReservationStatus.DINING,
        ],
      },
    },
    select: {
      id: true,
      reservedAt: true,
      holdExpiresAt: true,
      status: true,
      guestName: true,
    },
    orderBy: { reservedAt: "asc" },
  });
}

function toConflictPayload(
  conflict: SessionReservationConflictDenied,
  policy: "BLOCK" | "WARN",
  canOverride: boolean
): ReservationConflictPayload {
  return {
    code: conflict.code,
    policy,
    canOverride,
    reservationId: conflict.reservationId,
    reservedAt: conflict.reservedAt.toISOString(),
    currentTime: conflict.now.toISOString(),
    expectedFinish: conflict.expectedFinish.toISOString(),
    reservedAtLabel: formatTime(conflict.reservedAt),
    currentTimeLabel: formatTime(conflict.now),
    expectedFinishLabel: formatTime(conflict.expectedFinish),
    message: conflict.message,
  };
}

function auditRoleLabel(actor: OrderActor): "Admin" | "Waiter" {
  return actor.type === "staff" ? "Waiter" : "Admin";
}

export async function logReservationOverride(input: {
  restaurantId: string;
  tableId: string;
  actor: OrderActor;
  conflict: SessionReservationConflictDenied;
}): Promise<void> {
  const userId = actorUserId(input.actor) ?? null;
  await prisma.activityLog.create({
    data: {
      restaurantId: input.restaurantId,
      userId,
      action: "CREATE",
      entity: "reservation_conflict_override",
      entityId: input.conflict.reservationId,
      metadata: {
        reason: "Reservation Override",
        restaurantId: input.restaurantId,
        tableId: input.tableId,
        reservationId: input.conflict.reservationId,
        reservationTime: input.conflict.reservedAt.toISOString(),
        currentTime: input.conflict.now.toISOString(),
        expectedEndTime: input.conflict.expectedFinish.toISOString(),
        userId,
        userName: actorDisplayName(input.actor),
        role: auditRoleLabel(input.actor),
      },
    },
  });
}

/**
 * Shared gate for every dine-in session create path.
 * Status may still be AVAILABLE; eligibility can still fail.
 */
export async function checkSessionReservationConflict(input: {
  restaurantId: string;
  tableId: string;
  now?: Date;
  excludeReservationId?: string | null;
}): Promise<SessionReservationConflictResult> {
  const now = input.now ?? new Date();
  const settings = await getRestaurantReservationSettings(input.restaurantId);
  const reservations = await loadConflictCandidates(input.tableId);

  return evaluateSessionReservationConflict({
    now,
    averageDiningMinutes: settings.averageDiningMinutes,
    cleaningBufferMinutes: settings.cleaningBufferMinutes,
    reservations,
    excludeReservationId: input.excludeReservationId,
  });
}

export type AssertSessionReservationResult =
  | { allowed: true; overridden: false }
  | {
      allowed: true;
      overridden: true;
      conflict: SessionReservationConflictDenied;
    };

/**
 * Enforces restaurant conflict policy. WARN overlaps require
 * `overrideAcknowledged: true` after the double-confirm UI.
 */
export async function assertSessionReservationAllowed(input: {
  restaurantId: string;
  tableId: string;
  now?: Date;
  excludeReservationId?: string | null;
  overrideAcknowledged?: boolean;
}): Promise<AssertSessionReservationResult> {
  const now = input.now ?? new Date();
  const settings = await getRestaurantReservationSettings(input.restaurantId);
  const reservations = await loadConflictCandidates(input.tableId);

  const conflict = evaluateSessionReservationConflict({
    now,
    averageDiningMinutes: settings.averageDiningMinutes,
    cleaningBufferMinutes: settings.cleaningBufferMinutes,
    reservations,
    excludeReservationId: input.excludeReservationId,
  });

  const resolved = resolveConflictWithPolicy({
    conflict,
    policy: settings.reservationConflictPolicy,
    overrideAcknowledged: input.overrideAcknowledged,
  });

  if (resolved.decision === "ALLOW") {
    return { allowed: true, overridden: false };
  }

  if (resolved.decision === "ALLOW_WITH_OVERRIDE") {
    return {
      allowed: true,
      overridden: true,
      conflict: resolved.conflict,
    };
  }

  const canOverride = resolved.decision === "WARN";
  const policy = settings.reservationConflictPolicy;
  throw new AppError(
    resolved.conflict.message,
    resolved.conflict.code,
    409,
    toConflictPayload(resolved.conflict, policy, canOverride) as unknown as Record<
      string,
      unknown
    >
  );
}

/** @deprecated Prefer assertSessionReservationAllowed — kept for callers without override flow. */
export async function assertNoSessionReservationConflict(input: {
  restaurantId: string;
  tableId: string;
  now?: Date;
  excludeReservationId?: string | null;
}): Promise<void> {
  await assertSessionReservationAllowed(input);
}

export function conflictPayloadFromError(
  error: unknown
): ReservationConflictPayload | null {
  if (!(error instanceof AppError) || !error.details) return null;
  const d = error.details;
  if (
    typeof d.reservationId !== "string" ||
    typeof d.canOverride !== "boolean" ||
    (d.policy !== "BLOCK" && d.policy !== "WARN")
  ) {
    return null;
  }
  return d as unknown as ReservationConflictPayload;
}

/** Alias matching the requested service name. */
export const ReservationConflictService = {
  check: checkSessionReservationConflict,
  assert: assertSessionReservationAllowed,
  logOverride: logReservationOverride,
};
