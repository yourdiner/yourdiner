import { prisma } from "@/lib/db";
import {
  computeOrderTotal,
  computeTaxAmount,
  getRestaurantTaxSettings,
} from "@/lib/tax-settings";
import { getRestaurantOrderSettings } from "@/lib/order-settings";
import { AppError } from "@/lib/errors";
import {
  DiningSessionStatus,
  OrderItemKitchenStatus,
  OrderStatus,
  type Prisma,
} from "@prisma/client";
import type { OrderActor } from "./auth";
import { appendSessionEvent } from "./timeline.service";
import { canVoidSentItems } from "./permissions";
import { assertSessionStaffAccess } from "./session-access.service";
import { resolveOrderItemFromProduct } from "@/features/product-config/server-order";
import { findOrIncrementPendingOrderItem } from "@/features/product-config/merge-pending-order-item";

export type OrderItemConfigInput = {
  variantId?: string | null;
  modifierIds?: string[];
  quantity?: number;
  notes?: string;
  kitchenNotes?: string;
};

const OPEN_ORDER_STATUSES = {
  notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] as OrderStatus[],
};

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true; revisions: true };
}>;

function pickPrimaryOpenOrder(orders: OrderWithItems[]): OrderWithItems {
  const statusRank = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.SERVED:
        return 5;
      case OrderStatus.READY:
        return 4;
      case OrderStatus.PREPARING:
        return 3;
      case OrderStatus.CONFIRMED:
        return 2;
      default:
        return 1;
    }
  };

  return [...orders].sort((a, b) => {
    const byStatus = statusRank(b.status) - statusRank(a.status);
    if (byStatus !== 0) return byStatus;
    const byItems = b.items.length - a.items.length;
    if (byItems !== 0) return byItems;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0]!;
}

/**
 * Concurrent addItem calls used to race in getOrCreateActiveOrder and create
 * 2–3 open Order rows for one dining session (same orderNumber, split items,
 * inflated floor totals). Fold extras into one primary order.
 */
export async function consolidateOpenOrdersForSession(
  sessionId: string,
  restaurantId: string
): Promise<OrderWithItems | null> {
  const openOrders = await prisma.order.findMany({
    where: {
      diningSessionId: sessionId,
      restaurantId,
      status: OPEN_ORDER_STATUSES,
    },
    include: { items: true, revisions: true },
    orderBy: { createdAt: "asc" },
  });

  if (openOrders.length === 0) return null;

  let primaryId = openOrders[0]!.id;

  if (openOrders.length > 1) {
    const primary = pickPrimaryOpenOrder(openOrders);
    primaryId = primary.id;
    const duplicates = openOrders.filter((o) => o.id !== primary.id);

    await prisma.$transaction(async (tx) => {
      for (const dup of duplicates) {
        if (dup.items.length > 0) {
          await tx.orderItem.updateMany({
            where: { orderId: dup.id },
            data: { orderId: primary.id },
          });
        }

        // Revisions stay on the cancelled shell to avoid @@unique(orderId, revisionNumber) clashes.
        await tx.kitchenOrder.deleteMany({ where: { orderId: dup.id } });
        await tx.order.update({
          where: { id: dup.id },
          data: {
            status: OrderStatus.CANCELLED,
            subtotal: 0,
            taxAmount: 0,
            total: 0,
          },
        });
      }
    });
  }

  await dedupeOrderLines(primaryId);
  // Always refresh billable totals (PENDING drafts are excluded from subtotal/total).
  return recalculateOrder(primaryId);
}

/** Merge lines that share configuration + kitchen status + ticket (from race duplicates). */
async function dedupeOrderLines(orderId: string): Promise<boolean> {
  const items = await prisma.orderItem.findMany({
    where: {
      orderId,
      kitchenStatus: { not: OrderItemKitchenStatus.CANCELLED },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = `${item.configurationKey ?? item.productId}:${item.kitchenStatus}:${item.revisionNumber}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  let changed = false;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    changed = true;
    const [keep, ...extras] = group;
    const quantity = group.reduce((sum, i) => sum + i.quantity, 0);
    await prisma.orderItem.update({
      where: { id: keep.id },
      data: {
        quantity,
        totalPrice: keep.unitPrice * quantity,
      },
    });
    await prisma.orderItem.deleteMany({
      where: { id: { in: extras.map((i) => i.id) } },
    });
  }
  return changed;
}

export async function getOrCreateActiveOrder(
  sessionId: string,
  staffId: string | undefined,
  restaurantId: string
) {
  // Serialize creates for the same session (Postgres advisory lock).
  const { order, didConsolidate } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dining-order:${sessionId}`}))`;

    const openOrders = await tx.order.findMany({
      where: {
        diningSessionId: sessionId,
        restaurantId,
        status: OPEN_ORDER_STATUSES,
      },
      include: { items: true, revisions: true },
      orderBy: { createdAt: "asc" },
    });

    if (openOrders.length > 1) {
      const primary = pickPrimaryOpenOrder(openOrders);
      for (const dup of openOrders) {
        if (dup.id === primary.id) continue;
        if (dup.items.length > 0) {
          await tx.orderItem.updateMany({
            where: { orderId: dup.id },
            data: { orderId: primary.id },
          });
        }
        await tx.kitchenOrder.deleteMany({ where: { orderId: dup.id } });
        await tx.order.update({
          where: { id: dup.id },
          data: {
            status: OrderStatus.CANCELLED,
            subtotal: 0,
            taxAmount: 0,
            total: 0,
          },
        });
      }
      const merged = await tx.order.findUniqueOrThrow({
        where: { id: primary.id },
        include: { items: true, revisions: true },
      });
      return { order: merged, didConsolidate: true };
    }

    if (openOrders.length === 1) {
      return { order: openOrders[0], didConsolidate: false };
    }

    const diningSession = await tx.diningSession.findFirst({
      where: { id: sessionId, restaurantId },
      include: { customer: true, table: true },
    });
    if (!diningSession) throw new AppError("Session not found", "NOT_FOUND", 404);

    const lastOrder = await tx.order.findFirst({
      where: { restaurantId },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });

    const created = await tx.order.create({
      data: {
        restaurantId,
        diningSessionId: sessionId,
        tableId: diningSession.tableId,
        customerId: diningSession.customerId,
        staffId: staffId ?? diningSession.staffId ?? undefined,
        orderNumber: (lastOrder?.orderNumber ?? 1000) + 1,
        status: OrderStatus.PENDING,
        customerName: diningSession.customer?.name ?? diningSession.guestName,
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        isHeld: true,
      },
      include: { items: true, revisions: true },
    });
    return { order: created, didConsolidate: false };
  });

  if (didConsolidate) {
    await dedupeOrderLines(order.id);
    return recalculateOrder(order.id);
  }
  return order;
}

async function recalculateOrder(orderId: string) {
  // Billable total = items already ticketed to kitchen only.
  // PENDING draft lines stay on the waiter/customer cart until "Send to Kitchen".
  const items = await prisma.orderItem.findMany({
    where: {
      orderId,
      kitchenStatus: {
        in: [
          OrderItemKitchenStatus.SENT,
          OrderItemKitchenStatus.PREPARING,
          OrderItemKitchenStatus.READY,
          OrderItemKitchenStatus.SERVED,
        ],
      },
    },
  });
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", "NOT_FOUND", 404);

  const taxSettings = await getRestaurantTaxSettings(order.restaurantId);
  const taxAmount = computeTaxAmount(subtotal, taxSettings.taxPercent, taxSettings.taxInclusive);
  const total = computeOrderTotal(
    subtotal,
    taxAmount,
    order.discountAmount ?? 0,
    taxSettings.taxInclusive
  );

  return prisma.order.update({
    where: { id: orderId },
    data: { subtotal, taxAmount, total },
    include: { items: true, revisions: true },
  });
}

/** Public wrapper used by checkout after voiding unsent drafts. */
export async function refreshBillableOrderTotal(orderId: string) {
  return recalculateOrder(orderId);
}

export async function getOrderContext(
  sessionId: string,
  restaurantId: string,
  actor: OrderActor
) {
  await assertSessionStaffAccess(sessionId, restaurantId, actor);

  const diningSession = await prisma.diningSession.findFirst({
    where: { id: sessionId, restaurantId },
    include: {
      table: true,
      customer: { select: { name: true, phone: true } },
    },
  });
  if (!diningSession) throw new AppError("Session not found", "NOT_FOUND", 404);
  if (
    diningSession.status !== DiningSessionStatus.ACTIVE &&
    diningSession.status !== DiningSessionStatus.BILL_REQUESTED
  ) {
    throw new AppError("Session is closed", "SESSION_CLOSED", 400);
  }

  const consolidated = await consolidateOpenOrdersForSession(sessionId, restaurantId);

  const [categories, activeOrder, orderSettings] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId, isActive: true, isHidden: false },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
      },
    }),
    consolidated
      ? prisma.order.findFirst({
          where: { id: consolidated.id },
          include: {
            items: { orderBy: { createdAt: "asc" } },
            revisions: { orderBy: { revisionNumber: "desc" }, take: 5 },
          },
        })
      : Promise.resolve(null),
    getRestaurantOrderSettings(restaurantId),
  ]);

  return { diningSession, categories, activeOrder, orderSettings };
}

export async function addItemToOrderService(
  sessionId: string,
  restaurantId: string,
  productId: string,
  quantity: number,
  actor: OrderActor,
  options?: OrderItemConfigInput & { staffId?: string }
) {
  await assertSessionStaffAccess(sessionId, restaurantId, actor);
  const staffId = options?.staffId ?? (actor.type === "staff" ? actor.staffId : undefined);
  const order = await getOrCreateActiveOrder(sessionId, staffId, restaurantId);

  const snapshots = await resolveOrderItemFromProduct(productId, restaurantId, {
    variantId: options?.variantId,
    modifierIds: options?.modifierIds,
    quantity,
    notes: options?.notes,
    kitchenNotes: options?.kitchenNotes,
  });

  const { itemId, merged } = await findOrIncrementPendingOrderItem({
    orderId: order.id,
    productId,
    quantity,
    snapshots,
  });

  await recalculateOrder(order.id);

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "ITEM_ADDED",
    message: `${snapshots.name} ×${quantity} added`,
    metadata: { productId, quantity, itemId, merged },
    actor,
  });
}

export async function updateOrderItemConfigService(
  sessionId: string,
  restaurantId: string,
  itemId: string,
  input: OrderItemConfigInput,
  actor: OrderActor
) {
  await assertSessionStaffAccess(sessionId, restaurantId, actor);
  const item = await prisma.orderItem.findFirst({
    where: {
      id: itemId,
      order: { diningSessionId: sessionId, restaurantId },
    },
  });
  if (!item) throw new AppError("Item not found", "NOT_FOUND", 404);

  if (item.kitchenStatus !== OrderItemKitchenStatus.PENDING) {
    // Floor waiters may never change items already ticketed to kitchen.
    if (actor.type === "staff" || !canVoidSentItems(actor)) {
      throw new AppError("Cannot modify item already sent to kitchen", "FORBIDDEN", 403);
    }
  }

  const quantity = input.quantity ?? item.quantity;
  const snapshots = await resolveOrderItemFromProduct(item.productId, restaurantId, {
    variantId: input.variantId ?? item.variantId,
    modifierIds: input.modifierIds,
    quantity,
    notes: input.notes ?? item.notes ?? undefined,
    kitchenNotes: input.kitchenNotes ?? item.kitchenNotes ?? undefined,
  });

  await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      variantId: snapshots.variantId,
      name: snapshots.name,
      variantNameSnapshot: snapshots.variantNameSnapshot,
      variantPriceSnapshot: snapshots.variantPriceSnapshot,
      basePriceSnapshot: snapshots.basePriceSnapshot,
      configurationKey: snapshots.configurationKey,
      quantity,
      unitPrice: snapshots.unitPrice,
      totalPrice: snapshots.unitPrice * quantity,
      modifiers: snapshots.modifiers as unknown as Prisma.InputJsonValue,
      notes: snapshots.notes,
      kitchenNotes: snapshots.kitchenNotes,
    },
  });

  await recalculateOrder(item.orderId);
}

export async function updateOrderItemQuantityService(
  sessionId: string,
  restaurantId: string,
  itemId: string,
  quantity: number,
  actor: OrderActor
) {
  await assertSessionStaffAccess(sessionId, restaurantId, actor);
  if (quantity < 1) throw new AppError("Quantity must be at least 1", "VALIDATION", 400);

  const item = await prisma.orderItem.findFirst({
    where: {
      id: itemId,
      order: { diningSessionId: sessionId, restaurantId },
    },
  });
  if (!item) throw new AppError("Item not found", "NOT_FOUND", 404);

  if (item.kitchenStatus !== OrderItemKitchenStatus.PENDING) {
    // Floor waiters may never change quantity on items already ticketed to kitchen.
    if (actor.type === "staff" || !canVoidSentItems(actor)) {
      throw new AppError("Cannot modify item already sent to kitchen", "FORBIDDEN", 403);
    }
    const previousQty = item.quantity;
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { quantity, totalPrice: item.unitPrice * quantity },
    });
    await recalculateOrder(item.orderId);
    await appendSessionEvent({
      diningSessionId: sessionId,
      type: "ITEM_VOIDED",
      message: `${item.name} quantity reduced from ${previousQty} to ${quantity}`,
      metadata: { itemId, previousQty, quantity },
      actor,
    });
    return;
  }

  await prisma.orderItem.update({
    where: { id: itemId },
    data: { quantity, totalPrice: item.unitPrice * quantity },
  });

  await recalculateOrder(item.orderId);
}

export async function removeOrderItemService(
  sessionId: string,
  restaurantId: string,
  itemId: string,
  actor: OrderActor
) {
  await assertSessionStaffAccess(sessionId, restaurantId, actor);
  const item = await prisma.orderItem.findFirst({
    where: {
      id: itemId,
      order: { diningSessionId: sessionId, restaurantId },
    },
  });
  if (!item) throw new AppError("Item not found", "NOT_FOUND", 404);

  if (item.kitchenStatus !== OrderItemKitchenStatus.PENDING) {
    // Floor waiters may never void items already ticketed to kitchen.
    if (actor.type === "staff" || !canVoidSentItems(actor)) {
      throw new AppError("Cannot remove item already sent to kitchen", "FORBIDDEN", 403);
    }
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { kitchenStatus: OrderItemKitchenStatus.CANCELLED },
    });
    await appendSessionEvent({
      diningSessionId: sessionId,
      type: "ITEM_VOIDED",
      message: `${item.name} voided`,
      metadata: { itemId },
      actor,
    });
  } else {
    await prisma.orderItem.delete({ where: { id: itemId } });
    await appendSessionEvent({
      diningSessionId: sessionId,
      type: "ITEM_REMOVED",
      message: `${item.name} removed`,
      metadata: { itemId },
      actor,
    });
  }

  await recalculateOrder(item.orderId);
}

export async function submitOrderToKitchenService(
  sessionId: string,
  restaurantId: string,
  actor: OrderActor,
  staffId?: string,
  options?: { skipFirstOrderGate?: boolean }
): Promise<{ awaitingApproval?: boolean } | void> {
  await assertSessionStaffAccess(sessionId, restaurantId, actor);
  const order = await prisma.order.findFirst({
    where: {
      diningSessionId: sessionId,
      restaurantId,
      status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
    },
    include: {
      items: true,
      revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
    },
  });
  if (!order) throw new AppError("No active order", "NOT_FOUND", 404);

  const pendingItems = order.items.filter(
    (i) => i.kitchenStatus === OrderItemKitchenStatus.PENDING
  );
  if (pendingItems.length === 0) {
    throw new AppError("No new items to send", "VALIDATION", 400);
  }

  const settings = await getRestaurantOrderSettings(restaurantId);
  const nextRevision = (order.revisions[0]?.revisionNumber ?? 0) + 1;

  if (settings.maxRevisions && nextRevision > settings.maxRevisions) {
    throw new AppError("Maximum revisions reached", "LIMIT", 400);
  }

  if (
    !options?.skipFirstOrderGate &&
    actor.type === "customer" &&
    settings.requireFirstOrderApproval === true
  ) {
    const tableSession = await prisma.tableSession.findFirst({
      where: { diningSessionId: sessionId, restaurantId },
      select: { firstOrderApprovedAt: true, approvedAt: true },
    });

    // Table-session approval already unlocks ordering; do not double-gate.
    if (!tableSession?.firstOrderApprovedAt && !tableSession?.approvedAt) {
      await prisma.order.update({
        where: { id: order.id },
        data: { awaitingCustomerOrderApproval: true },
      });

      await appendSessionEvent({
        diningSessionId: sessionId,
        type: "CUSTOMER_ORDER_PENDING_APPROVAL",
        message: `Customer order awaiting staff approval (${pendingItems.length} items)`,
        metadata: { orderId: order.id, itemCount: pendingItems.length },
        actor,
      });

      return { awaitingApproval: true };
    }
  }

  const submitStaffId = staffId ?? (actor.type === "staff" ? actor.staffId : undefined);

  await prisma.$transaction(async (tx) => {
    await tx.orderRevision.create({
      data: {
        orderId: order.id,
        revisionNumber: nextRevision,
        submittedByStaffId: submitStaffId,
        notes: JSON.stringify({
          itemCount: pendingItems.length,
          items: pendingItems.map((i) => ({ id: i.id, name: i.name, qty: i.quantity })),
        }),
      },
    });

    await tx.orderItem.updateMany({
      where: { orderId: order.id, kitchenStatus: OrderItemKitchenStatus.PENDING },
      data: {
        kitchenStatus: OrderItemKitchenStatus.SENT,
        revisionNumber: nextRevision,
        kitchenSentAt: new Date(),
        kitchenStatusUpdatedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { isHeld: false, status: OrderStatus.PREPARING },
    });

    const existingKitchen = await tx.kitchenOrder.findFirst({ where: { orderId: order.id } });
    if (!existingKitchen) {
      await tx.kitchenOrder.create({ data: { orderId: order.id, status: "QUEUED" } });
    }
  });

  await recalculateOrder(order.id);

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "SENT_TO_KITCHEN",
    message: `Ticket #${nextRevision} sent to kitchen (${pendingItems.length} items)`,
    metadata: { revisionNumber: nextRevision, itemCount: pendingItems.length },
    actor,
  });
}

export async function holdOrderService(sessionId: string, restaurantId: string) {
  await prisma.order.updateMany({
    where: {
      diningSessionId: sessionId,
      restaurantId,
      status: OrderStatus.PENDING,
    },
    data: { isHeld: true },
  });
}

export function searchProducts(
  _categories: Awaited<ReturnType<typeof getOrderContext>>["categories"],
  _query: string
) {
  // Product search is client-side via /api/menu/catalog after progressive loading.
  return [] as Array<{ id: string; name: string; price: number; categoryName: string }>;
}
