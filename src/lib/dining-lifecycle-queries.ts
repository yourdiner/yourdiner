import "server-only";

import { prisma } from "@/lib/db";
import { activeOrderWhere, openDiningSessionWhere } from "@/lib/dining-lifecycle";

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
