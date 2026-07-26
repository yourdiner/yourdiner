import { ReservationStatus, TableStatus } from "@prisma/client";
import { isDiningSessionActive } from "@/lib/dining-lifecycle";

export type TableAvailabilityStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "OCCUPIED"
  | "CLEANING"
  | "DISABLED";

export type BlockingReservationSnapshot = {
  id: string;
  guestName: string;
  guestCount: number;
  reservedAt: Date;
  holdExpiresAt: Date;
  status: ReservationStatus;
};

export type ActiveSessionSnapshot = {
  id: string;
  status: string;
};

export type TableRecordSnapshot = {
  id: string;
  isActive: boolean;
  status: TableStatus;
};

export type TableAvailabilitySnapshot = {
  tableId: string;
  status: TableAvailabilityStatus;
  activeSession: ActiveSessionSnapshot | null;
  blockingReservation: BlockingReservationSnapshot | null;
  canStartSession: boolean;
  blockReason: string | null;
};

/** @deprecated Use TableAvailabilityStatus */
export type ComputedTableStatus = Lowercase<TableAvailabilityStatus>;

export const TABLE_RESERVATION_BLOCKED_MESSAGE =
  "This table has a reservation scheduled and cannot be used until the reservation is checked in, cancelled, or marked as a no-show.";

export function isWithinHoldWindow(
  reservedAt: Date,
  holdExpiresAt: Date,
  now: Date
): boolean {
  const t = now.getTime();
  return t >= reservedAt.getTime() && t < holdExpiresAt.getTime();
}

/** When a walk-in can no longer finish before the reservation. */
export function getReservationCutoffTime(
  reservedAt: Date,
  averageDiningMinutes: number
): Date {
  const cutoff = new Date(reservedAt);
  cutoff.setMinutes(cutoff.getMinutes() - averageDiningMinutes);
  return cutoff;
}

/**
 * Dining-window + hold: RESERVED from cutoff until hold expires.
 * cutoff = reservedAt - averageDiningMinutes
 */
export function isWithinDiningBlockingWindow(
  reservedAt: Date,
  holdExpiresAt: Date,
  now: Date,
  averageDiningMinutes: number
): boolean {
  const t = now.getTime();
  const cutoff = getReservationCutoffTime(reservedAt, averageDiningMinutes);
  return t >= cutoff.getTime() && t < holdExpiresAt.getTime();
}

export function isHoldBlockingReservation(reservation: {
  status: ReservationStatus;
  reservedAt: Date;
  holdExpiresAt: Date;
}): boolean {
  return reservation.status === ReservationStatus.CONFIRMED;
}

export function isOccupiedByReservation(reservation: {
  status: ReservationStatus;
}): boolean {
  return (
    reservation.status === ReservationStatus.CHECKED_IN ||
    reservation.status === ReservationStatus.DINING
  );
}

export function classifyReservationForTable(
  reservation: {
    status: ReservationStatus;
    reservedAt: Date;
    holdExpiresAt: Date;
  },
  now: Date,
  hasActiveSession: boolean,
  averageDiningMinutes = 0
): "hold" | "occupied" | null {
  if (hasActiveSession) return null;

  if (isOccupiedByReservation(reservation)) {
    return "occupied";
  }

  if (
    isHoldBlockingReservation(reservation) &&
    isWithinDiningBlockingWindow(
      reservation.reservedAt,
      reservation.holdExpiresAt,
      now,
      averageDiningMinutes
    )
  ) {
    return "hold";
  }

  return null;
}

export function computeTableStatus(input: {
  table: TableRecordSnapshot;
  activeSession: ActiveSessionSnapshot | null;
  holdReservation: BlockingReservationSnapshot | null;
  occupiedReservation: BlockingReservationSnapshot | null;
}): TableAvailabilityStatus {
  const { table, activeSession, holdReservation, occupiedReservation } = input;

  if (!table.isActive || table.status === TableStatus.DISABLED) {
    return "DISABLED";
  }

  // Dining occupancy: open DiningSession only (ACTIVE | BILL_REQUESTED).
  // Kitchen/payment never influence this. occupiedReservation / QR-as-session
  // remain seating blocks so a walk-in cannot double-book — they are not
  // counted as Active DiningSession metrics (see dining-lifecycle helpers).
  if (isDiningSessionActive(activeSession?.status) || occupiedReservation) {
    return "OCCUPIED";
  }

  // QR TableSession may be passed as activeSession with non-dining status strings
  // (e.g. PENDING_APPROVAL). Treat any non-null activeSession without a closed
  // dining status as a seating block → OCCUPIED for availability, not metrics.
  if (activeSession) {
    return "OCCUPIED";
  }

  if (holdReservation) {
    return "RESERVED";
  }

  if (table.status === TableStatus.CLEANING) {
    return "CLEANING";
  }

  return "AVAILABLE";
}

export function canStartSession(
  snapshot: TableAvailabilitySnapshot,
  options: { reservationId?: string | null; now?: Date } = {}
): { allowed: boolean; reason: string | null } {
  const { reservationId } = options;
  const now = options.now ?? new Date();

  if (snapshot.status === "DISABLED") {
    return { allowed: false, reason: "Table is disabled" };
  }

  if (snapshot.status === "OCCUPIED" || snapshot.activeSession) {
    return { allowed: false, reason: "Table has an active session" };
  }

  if (snapshot.status === "RESERVED" || snapshot.blockingReservation) {
    if (reservationId && reservationId === snapshot.blockingReservation?.id) {
      return { allowed: true, reason: null };
    }

    const blocking = snapshot.blockingReservation;
    // Pre-arrival dining window: defer to conflict policy / override.
    if (blocking && blocking.reservedAt.getTime() > now.getTime()) {
      return { allowed: true, reason: null };
    }

    return { allowed: false, reason: TABLE_RESERVATION_BLOCKED_MESSAGE };
  }

  if (snapshot.status === "CLEANING") {
    return { allowed: false, reason: "Table is being cleaned" };
  }

  if (snapshot.status === "AVAILABLE") {
    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: "Table is not available" };
}

export function buildAvailabilitySnapshot(input: {
  table: TableRecordSnapshot;
  activeSession: ActiveSessionSnapshot | null;
  holdReservation: BlockingReservationSnapshot | null;
  occupiedReservation: BlockingReservationSnapshot | null;
  reservationId?: string | null;
  now?: Date;
}): TableAvailabilitySnapshot {
  const blockingReservation = input.holdReservation ?? input.occupiedReservation;
  const now = input.now ?? new Date();

  const status = computeTableStatus({
    table: input.table,
    activeSession: input.activeSession,
    holdReservation: input.holdReservation,
    occupiedReservation: input.occupiedReservation,
  });

  const { allowed, reason } = canStartSession(
    {
      tableId: input.table.id,
      status,
      activeSession: input.activeSession,
      blockingReservation,
      canStartSession: false,
      blockReason: null,
    },
    { reservationId: input.reservationId, now }
  );

  return {
    tableId: input.table.id,
    status,
    activeSession: input.activeSession,
    blockingReservation,
    canStartSession: allowed,
    blockReason: reason,
  };
}

/** Maps availability status for legacy UI that expects TableStatus enum strings. */
export function computedStatusToDisplayStatus(
  status: TableAvailabilityStatus
): TableAvailabilityStatus {
  return status;
}

export function toLegacyComputedStatus(
  status: TableAvailabilityStatus
): ComputedTableStatus {
  return status.toLowerCase() as ComputedTableStatus;
}
