import { prisma } from "@/lib/db";
import {
  KitchenOrderStatus,
  OrderItemKitchenStatus,
  OrderType,
} from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  ACTIVE_KITCHEN_ITEM_STATUS_LIST,
  terminalOrderStatusFilter,
} from "@/lib/prisma-filters";

export type SerializedKitchenItem = {
  id: string;
  name: string;
  quantity: number;
  kitchenStatus: OrderItemKitchenStatus;
  kitchenSentAt: string;
  kitchenStatusUpdatedAt: string;
  variantNameSnapshot?: string | null;
  modifiers?: unknown;
  notes?: string | null;
  kitchenNotes?: string | null;
  orderId: string;
  orderNumber: number;
  orderType: OrderType;
  contextLabel: string;
  table: { name: string | null; number: number } | null;
  customerName: string | null;
};

const QUEUE_STATUSES: OrderItemKitchenStatus[] = [
  OrderItemKitchenStatus.SENT,
  OrderItemKitchenStatus.PREPARING,
  OrderItemKitchenStatus.READY,
];

const ADVANCE_MAP: Partial<Record<OrderItemKitchenStatus, OrderItemKitchenStatus>> = {
  [OrderItemKitchenStatus.SENT]: OrderItemKitchenStatus.PREPARING,
  [OrderItemKitchenStatus.PREPARING]: OrderItemKitchenStatus.READY,
  [OrderItemKitchenStatus.READY]: OrderItemKitchenStatus.SERVED,
};

function contextLabel(input: {
  orderType: OrderType;
  table: { name: string | null; number: number } | null;
  customerName: string | null;
  deliveryAddress: string | null;
}): string {
  const name = input.customerName ?? "Guest";
  if (input.orderType === OrderType.DINE_IN) {
    const table =
      input.table?.name || (input.table ? `Table ${input.table.number}` : "Table");
    return `Dine-In · ${table}`;
  }
  if (input.orderType === OrderType.TAKEAWAY) {
    return `Takeaway · ${name}`;
  }
  const addr = input.deliveryAddress ?? "";
  const snippet = addr.length > 24 ? `${addr.slice(0, 24)}…` : addr;
  return `Delivery · ${name}${snippet ? ` · ${snippet}` : ""}`;
}

function serializeItem(row: {
  id: string;
  name: string;
  quantity: number;
  kitchenStatus: OrderItemKitchenStatus;
  kitchenSentAt: Date | null;
  kitchenStatusUpdatedAt: Date | null;
  createdAt: Date;
  variantNameSnapshot: string | null;
  modifiers: unknown;
  notes: string | null;
  kitchenNotes: string | null;
  order: {
    id: string;
    orderNumber: number;
    orderType: OrderType;
    customerName: string | null;
    table: { name: string | null; number: number } | null;
    deliveryDetails: { address: string } | null;
    customer: { name: string } | null;
  };
}): SerializedKitchenItem {
  const sentAt = row.kitchenSentAt ?? row.createdAt;
  const updatedAt = row.kitchenStatusUpdatedAt ?? sentAt;
  const customerName = row.order.customer?.name ?? row.order.customerName;
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    kitchenStatus: row.kitchenStatus,
    kitchenSentAt: sentAt.toISOString(),
    kitchenStatusUpdatedAt: updatedAt.toISOString(),
    variantNameSnapshot: row.variantNameSnapshot,
    modifiers: row.modifiers,
    notes: row.notes,
    kitchenNotes: row.kitchenNotes,
    orderId: row.order.id,
    orderNumber: row.order.orderNumber,
    orderType: row.order.orderType,
    contextLabel: contextLabel({
      orderType: row.order.orderType,
      table: row.order.table,
      customerName,
      deliveryAddress: row.order.deliveryDetails?.address ?? null,
    }),
    table: row.order.table,
    customerName,
  };
}

const itemInclude = {
  order: {
    include: {
      table: { select: { name: true, number: true } },
      deliveryDetails: { select: { address: true } },
      customer: { select: { name: true } },
    },
  },
} as const;

export async function listKitchenQueueItems(
  restaurantId: string,
  options?: { since?: Date }
): Promise<{
  items: SerializedKitchenItem[];
  clearedIds: string[];
  serverTime: string;
}> {
  const since = options?.since;

  if (!since) {
    const rows = await prisma.orderItem.findMany({
      where: {
        kitchenStatus: { in: QUEUE_STATUSES },
        order: {
          restaurantId,
          ...terminalOrderStatusFilter(),
        },
      },
      include: itemInclude,
      orderBy: [{ kitchenSentAt: "asc" }, { createdAt: "asc" }],
    });

    return {
      items: rows.map(serializeItem),
      clearedIds: [],
      serverTime: new Date().toISOString(),
    };
  }

  const changed = await prisma.orderItem.findMany({
    where: {
      kitchenStatusUpdatedAt: { gt: since },
      order: {
        restaurantId,
        ...terminalOrderStatusFilter(),
      },
    },
    include: itemInclude,
    orderBy: [{ kitchenSentAt: "asc" }, { createdAt: "asc" }],
  });

  const items = changed
    .filter((row) => QUEUE_STATUSES.includes(row.kitchenStatus))
    .map(serializeItem);

  const clearedIds = changed
    .filter((row) => !QUEUE_STATUSES.includes(row.kitchenStatus))
    .map((row) => row.id);

  return {
    items,
    clearedIds,
    serverTime: new Date().toISOString(),
  };
}

async function syncKitchenOrderAggregate(orderId: string) {
  const kitchenOrder = await prisma.kitchenOrder.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
  if (!kitchenOrder) return;

  const items = await prisma.orderItem.findMany({
    where: {
      orderId,
      kitchenStatus: { in: [...ACTIVE_KITCHEN_ITEM_STATUS_LIST] },
    },
    select: { kitchenStatus: true },
  });

  if (items.length === 0) {
    // All active kitchen lines finished (served/cancelled)
    if (kitchenOrder.status !== KitchenOrderStatus.READY) {
      await prisma.kitchenOrder.update({
        where: { id: kitchenOrder.id },
        data: {
          status: KitchenOrderStatus.READY,
          readyAt: kitchenOrder.readyAt ?? new Date(),
        },
      });
    }
    return;
  }

  const allReady = items.every((i) => i.kitchenStatus === OrderItemKitchenStatus.READY);
  const anyPreparing = items.some(
    (i) =>
      i.kitchenStatus === OrderItemKitchenStatus.PREPARING ||
      i.kitchenStatus === OrderItemKitchenStatus.READY
  );

  if (allReady) {
    await prisma.kitchenOrder.update({
      where: { id: kitchenOrder.id },
      data: {
        status: KitchenOrderStatus.READY,
        readyAt: kitchenOrder.readyAt ?? new Date(),
        startedAt: kitchenOrder.startedAt ?? new Date(),
      },
    });
    return;
  }

  if (anyPreparing && kitchenOrder.status === KitchenOrderStatus.QUEUED) {
    await prisma.kitchenOrder.update({
      where: { id: kitchenOrder.id },
      data: {
        status: KitchenOrderStatus.COOKING,
        startedAt: kitchenOrder.startedAt ?? new Date(),
      },
    });
  }
}

export async function advanceOrderItemKitchenStatus(
  orderItemId: string,
  restaurantId: string,
  status: OrderItemKitchenStatus
) {
  const item = await prisma.orderItem.findFirst({
    where: {
      id: orderItemId,
      order: { restaurantId, ...terminalOrderStatusFilter() },
    },
    include: { order: { select: { id: true } } },
  });

  if (!item) {
    throw new AppError("Kitchen item not found", "NOT_FOUND", 404);
  }

  const expectedNext = ADVANCE_MAP[item.kitchenStatus];
  if (!expectedNext || expectedNext !== status) {
    throw new AppError(
      `Invalid transition from ${item.kitchenStatus} to ${status}`,
      "VALIDATION",
      400
    );
  }

  const now = new Date();
  const updated = await prisma.orderItem.update({
    where: { id: orderItemId },
    data: {
      kitchenStatus: status,
      kitchenStatusUpdatedAt: now,
      ...(item.kitchenSentAt ? {} : { kitchenSentAt: item.createdAt }),
    },
    include: itemInclude,
  });

  await syncKitchenOrderAggregate(item.orderId);

  return serializeItem(updated);
}

/** Compat: advance all active queue items on a kitchen ticket to the mapped item status. */
export async function advanceKitchenTicketItems(
  kitchenOrderId: string,
  restaurantId: string,
  ticketStatus: "COOKING" | "READY"
) {
  const ko = await prisma.kitchenOrder.findFirst({
    where: { id: kitchenOrderId, order: { restaurantId } },
  });
  if (!ko) {
    throw new AppError("Kitchen ticket not found", "NOT_FOUND", 404);
  }

  const targetItemStatus =
    ticketStatus === "COOKING"
      ? OrderItemKitchenStatus.PREPARING
      : OrderItemKitchenStatus.READY;

  const fromStatuses =
    ticketStatus === "COOKING"
      ? [OrderItemKitchenStatus.SENT]
      : [OrderItemKitchenStatus.SENT, OrderItemKitchenStatus.PREPARING];

  const now = new Date();
  const toAdvance = await prisma.orderItem.findMany({
    where: {
      orderId: ko.orderId,
      kitchenStatus: { in: fromStatuses },
    },
    select: { id: true, kitchenSentAt: true, createdAt: true },
  });

  await Promise.all(
    toAdvance.map((row) =>
      prisma.orderItem.update({
        where: { id: row.id },
        data: {
          kitchenStatus: targetItemStatus,
          kitchenStatusUpdatedAt: now,
          kitchenSentAt: row.kitchenSentAt ?? row.createdAt,
        },
      })
    )
  );

  await prisma.kitchenOrder.update({
    where: { id: kitchenOrderId },
    data: {
      status:
        ticketStatus === "COOKING" ? KitchenOrderStatus.COOKING : KitchenOrderStatus.READY,
      ...(ticketStatus === "COOKING" ? { startedAt: new Date() } : {}),
      ...(ticketStatus === "READY" ? { readyAt: new Date() } : {}),
    },
  });

  return true;
}

export { QUEUE_STATUSES };
