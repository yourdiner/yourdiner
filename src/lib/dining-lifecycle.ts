/**
 * Single source of truth for dining-floor state predicates.
 *
 * Rules (domain):
 * - A DiningSession is "active/open" while status is ACTIVE or BILL_REQUESTED.
 *   BILL_REQUESTED is still live dining (guest at table awaiting payment) — not closed.
 * - A table is occupied *by dining* only when an open DiningSession exists on it.
 *   Kitchen status and payment status never determine occupancy.
 * - An order is "active" when it is not COMPLETED and not CANCELLED.
 *
 * Seating availability (QR pending, reservation holds) is separate and lives in
 * table-availability — it may block starting a new session without counting as
 * an Active DiningSession metric.
 */

import { DiningSessionStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ACTIVE_DINING_SESSION_STATUS_LIST,
  TERMINAL_ORDER_STATUS_LIST,
  activeDiningSessionStatusFilter,
  terminalOrderStatusFilter,
} from "@/lib/prisma-filters";

const OPEN_SESSION = new Set<string>(ACTIVE_DINING_SESSION_STATUS_LIST);
const TERMINAL_ORDER = new Set<string>(TERMINAL_ORDER_STATUS_LIST);

/** True when the DiningSession is still live on the floor (ACTIVE or BILL_REQUESTED). */
export function isDiningSessionActive(
  status: DiningSessionStatus | string | null | undefined
): boolean {
  if (!status) return false;
  return OPEN_SESSION.has(status);
}

/** True when the order is not completed/cancelled. */
export function isOrderActive(
  status: OrderStatus | string | null | undefined
): boolean {
  if (!status) return false;
  return !TERMINAL_ORDER.has(status);
}

/**
 * Table occupied by dining — DiningSession is the only source of truth.
 * Kitchen / payment statuses must not be passed here.
 */
export function isTableOccupiedByDiningSession(
  session: { status: string } | null | undefined
): boolean {
  return isDiningSessionActive(session?.status);
}

/** Prisma where-fragment for open dining sessions (shared). */
export function openDiningSessionWhere(restaurantId?: string) {
  return {
    ...(restaurantId ? { restaurantId } : {}),
    ...activeDiningSessionStatusFilter(),
  };
}

/** Prisma where-fragment for non-terminal orders (shared). */
export function activeOrderWhere(restaurantId?: string) {
  return {
    ...(restaurantId ? { restaurantId } : {}),
    ...terminalOrderStatusFilter(),
  };
}

/** Count of open DiningSession records — Dashboard / Floor "Active sessions". */
export async function countActiveDiningSessions(restaurantId: string): Promise<number> {
  return prisma.diningSession.count({
    where: openDiningSessionWhere(restaurantId),
  });
}

/** Count of orders that are not completed/cancelled — Dashboard "Active Orders". */
export async function countActiveOrders(restaurantId: string): Promise<number> {
  return prisma.order.count({
    where: activeOrderWhere(restaurantId),
  });
}

/**
 * Tables occupied by an open DiningSession / total active tables.
 * Does not use Table.status column (stale) or kitchen/payment.
 */
export async function getDiningSessionOccupancy(restaurantId: string): Promise<{
  totalTables: number;
  occupiedTables: number;
  occupancyPct: number;
  activeSessions: number;
}> {
  const [totalTables, activeSessions, occupiedGrouped] = await Promise.all([
    prisma.table.count({
      where: { restaurantId, isActive: true },
    }),
    countActiveDiningSessions(restaurantId),
    prisma.diningSession.groupBy({
      by: ["tableId"],
      where: openDiningSessionWhere(restaurantId),
    }),
  ]);

  const occupiedTables = occupiedGrouped.length;
  const occupancyPct =
    totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;

  return { totalTables, occupiedTables, occupancyPct, activeSessions };
}
