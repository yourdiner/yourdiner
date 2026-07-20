import { ReservationStatus, type TableStatus } from "@prisma/client";
import {
  buildAvailabilitySnapshot,
  classifyReservationForTable,
  type ActiveSessionSnapshot,
  type BlockingReservationSnapshot,
  type TableAvailabilitySnapshot,
  type TableRecordSnapshot,
} from "./table-availability.logic";

export type AvailabilityTableRow = TableRecordSnapshot;

export type AvailabilitySessionRow = {
  id: string;
  tableId: string;
  status: string;
};

export type AvailabilityReservationRow = {
  id: string;
  tableId: string | null;
  guestName: string;
  guestCount: number;
  reservedAt: Date;
  holdExpiresAt: Date;
  status: ReservationStatus;
};

function toReservationSnapshot(
  r: {
    id: string;
    guestName: string;
    guestCount: number;
    reservedAt: Date;
    holdExpiresAt: Date;
    status: ReservationStatus;
  } | null
): BlockingReservationSnapshot | null {
  if (!r) return null;
  return {
    id: r.id,
    guestName: r.guestName,
    guestCount: r.guestCount,
    reservedAt: r.reservedAt,
    holdExpiresAt: r.holdExpiresAt,
    status: r.status,
  };
}

export function classifyReservationsForTable(
  candidates: Array<{
    id: string;
    guestName: string;
    guestCount: number;
    reservedAt: Date;
    holdExpiresAt: Date;
    status: ReservationStatus;
  }>,
  now: Date,
  hasActiveSession: boolean,
  averageDiningMinutes = 0
): {
  holdReservation: BlockingReservationSnapshot | null;
  occupiedReservation: BlockingReservationSnapshot | null;
} {
  let holdReservation: BlockingReservationSnapshot | null = null;
  let occupiedReservation: BlockingReservationSnapshot | null = null;

  for (const r of candidates) {
    const kind = classifyReservationForTable(
      r,
      now,
      hasActiveSession,
      averageDiningMinutes
    );
    if (kind === "hold" && !holdReservation) {
      holdReservation = toReservationSnapshot(r);
    }
    if (kind === "occupied" && !occupiedReservation) {
      occupiedReservation = toReservationSnapshot(r);
    }
  }

  return { holdReservation, occupiedReservation };
}

/**
 * Pure builder: compose table availability from already-loaded rows.
 * Same classification rules as getRestaurantTablesAvailability.
 */
export function buildAvailabilityMap(input: {
  tables: AvailabilityTableRow[];
  sessions: AvailabilitySessionRow[];
  customerSessions: AvailabilitySessionRow[];
  reservations: AvailabilityReservationRow[];
  now: Date;
  averageDiningMinutes?: number;
}): Map<string, TableAvailabilitySnapshot> {
  const {
    tables,
    sessions,
    customerSessions,
    reservations,
    now,
    averageDiningMinutes = 0,
  } = input;

  const sessionByTable = new Map(sessions.map((s) => [s.tableId, s]));
  const customerSessionByTable = new Map<string, AvailabilitySessionRow>();
  for (const cs of customerSessions) {
    if (!customerSessionByTable.has(cs.tableId)) {
      customerSessionByTable.set(cs.tableId, cs);
    }
  }

  const reservationsByTable = new Map<string, AvailabilityReservationRow[]>();
  for (const r of reservations) {
    if (!r.tableId) continue;
    const list = reservationsByTable.get(r.tableId) ?? [];
    list.push(r);
    reservationsByTable.set(r.tableId, list);
  }

  const result = new Map<string, TableAvailabilitySnapshot>();
  for (const table of tables) {
    const session = sessionByTable.get(table.id);
    const customerSession = customerSessionByTable.get(table.id);
    const activeSession: ActiveSessionSnapshot | null = session
      ? { id: session.id, status: session.status }
      : customerSession
        ? { id: customerSession.id, status: customerSession.status }
        : null;
    const candidates = reservationsByTable.get(table.id) ?? [];
    const { holdReservation, occupiedReservation } = classifyReservationsForTable(
      candidates,
      now,
      Boolean(activeSession),
      averageDiningMinutes
    );

    result.set(
      table.id,
      buildAvailabilitySnapshot({
        table,
        activeSession,
        holdReservation,
        occupiedReservation,
        now,
      })
    );
  }

  return result;
}

/** Re-export for callers that only need the table status type from prisma. */
export type { TableStatus };
