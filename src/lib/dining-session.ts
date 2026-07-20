import { prisma } from "@/lib/db";
import { DiningSessionStatus } from "@prisma/client";
import {
  activeDiningSessionStatusFilter,
  blockingTableSessionStatusFilter,
  terminalOrderStatusFilter,
} from "@/lib/prisma-filters";

/** Legacy no-op — table availability is computed dynamically. */
export async function repairStaleTableOccupancy(_restaurantId: string) {}

export async function getActiveDiningSessionForTable(tableId: string) {
  return prisma.diningSession.findFirst({
    where: {
      tableId,
      ...activeDiningSessionStatusFilter(),
    },
    include: {
      staff: { select: { id: true, displayName: true } },
      customer: { select: { id: true, name: true, phone: true } },
      orders: {
        where: terminalOrderStatusFilter(),
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export function diningSessionStatusLabel(status: DiningSessionStatus): string {
  const labels: Record<DiningSessionStatus, string> = {
    ACTIVE: "Active",
    BILL_REQUESTED: "Bill requested",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
  };
  return labels[status];
}
