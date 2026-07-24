import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  computeOrderTotal,
  computeTaxAmount,
  getRestaurantTaxSettings,
} from "@/lib/tax-settings";
import { getRestaurantOrderSettings } from "@/lib/order-settings";
import {
  OrderItemKitchenStatus,
  OrderStatus,
  OrderType,
  type OrderPaymentStatus,
  type Prisma,
} from "@prisma/client";
import {
  findOrCreateCustomer,
} from "@/features/dining-session/customer.service";
import type { OrderActor } from "@/features/dining-session/auth";
import { resolveOrderItemFromProduct } from "@/features/product-config/server-order";
import { findOrIncrementPendingOrderItem } from "@/features/product-config/merge-pending-order-item";

async function nextOrderNumber(restaurantId: string) {
  const last = await prisma.order.findFirst({
    where: { restaurantId },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  return (last?.orderNumber ?? 1000) + 1;
}

async function recalculateOrder(orderId: string, extraCharges = 0) {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { deliveryDetails: true },
  });
  if (!order) throw new AppError("Order not found", "NOT_FOUND", 404);

  const deliveryCharges = order.deliveryDetails?.deliveryCharges ?? 0;
  const taxSettings = await getRestaurantTaxSettings(order.restaurantId);
  const taxableSubtotal = subtotal + deliveryCharges + extraCharges;
  const taxAmount = computeTaxAmount(
    taxableSubtotal,
    taxSettings.taxPercent,
    taxSettings.taxInclusive
  );
  const total = computeOrderTotal(
    taxableSubtotal,
    taxAmount,
    order.discountAmount ?? 0,
    taxSettings.taxInclusive
  );

  return prisma.order.update({
    where: { id: orderId },
    data: { subtotal, taxAmount, total },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 5 },
      deliveryDetails: true,
      customer: { select: { id: true, name: true, phone: true } },
      kitchenOrders: true,
      payments: true,
    },
  });
}

async function assertFulfillmentOrder(orderId: string, restaurantId: string, type?: OrderType) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId,
      orderType: type ? type : { in: [OrderType.TAKEAWAY, OrderType.DELIVERY] },
      status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
    },
  });
  if (!order) throw new AppError("Order not found", "NOT_FOUND", 404);
  return order;
}

export async function createTakeawayOrder(
  restaurantId: string,
  input: {
    phone: string;
    name: string;
    pickupTime?: Date | null;
    notes?: string;
    staffId?: string;
  }
) {
  const normalizedPhone = input.phone.replace(/\D/g, "").slice(-10);
  const customer = await findOrCreateCustomer(restaurantId, normalizedPhone, input.name);

  const order = await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: await nextOrderNumber(restaurantId),
      orderType: OrderType.TAKEAWAY,
      customerId: customer?.id,
      customerName: customer?.name ?? input.name.trim(),
      staffId: input.staffId,
      pickupTime: input.pickupTime ?? null,
      orderNotes: input.notes?.trim() || null,
      status: OrderStatus.PENDING,
      isHeld: true,
    },
  });

  return order;
}

export async function createDeliveryOrder(
  restaurantId: string,
  input: {
    phone: string;
    name: string;
    address: string;
    landmark?: string;
    instructions?: string;
    deliveryCharges?: number;
    estimatedDeliveryAt?: Date | null;
    deliveryPartner?: string;
    notes?: string;
    staffId?: string;
  }
) {
  const normalizedPhone = input.phone.replace(/\D/g, "").slice(-10);
  const customer = await findOrCreateCustomer(restaurantId, normalizedPhone, input.name);
  const deliveryChargesPaise = Math.round((input.deliveryCharges ?? 0) * 100);

  const order = await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: await nextOrderNumber(restaurantId),
      orderType: OrderType.DELIVERY,
      customerId: customer?.id,
      customerName: customer?.name ?? input.name.trim(),
      staffId: input.staffId,
      orderNotes: input.notes?.trim() || null,
      status: OrderStatus.PENDING,
      isHeld: true,
      deliveryDetails: {
        create: {
          address: input.address.trim(),
          landmark: input.landmark?.trim() || null,
          instructions: input.instructions?.trim() || null,
          deliveryCharges: deliveryChargesPaise,
          estimatedDeliveryAt: input.estimatedDeliveryAt ?? null,
          deliveryPartner: input.deliveryPartner?.trim() || null,
        },
      },
    },
    include: { deliveryDetails: true },
  });

  await recalculateOrder(order.id);
  return prisma.order.findUnique({
    where: { id: order.id },
    include: { deliveryDetails: true },
  });
}

export async function getFulfillmentOrderContext(orderId: string, restaurantId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId,
      orderType: { in: [OrderType.TAKEAWAY, OrderType.DELIVERY] },
    },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 5 },
      deliveryDetails: true,
      customer: { select: { id: true, name: true, phone: true } },
      kitchenOrders: true,
      payments: true,
    },
  });
  if (!order) throw new AppError("Order not found", "NOT_FOUND", 404);

  const categories = await prisma.category.findMany({
    where: { restaurantId, isActive: true, isHidden: false },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  const orderSettings = await getRestaurantOrderSettings(restaurantId);
  return { order, categories, orderSettings };
}

export async function addItemToFulfillmentOrder(
  orderId: string,
  restaurantId: string,
  productId: string,
  quantity: number,
  options?: {
    variantId?: string | null;
    modifierIds?: string[];
    kitchenNotes?: string;
    notes?: string;
    staffId?: string;
  }
) {
  await assertFulfillmentOrder(orderId, restaurantId);

  const snapshots = await resolveOrderItemFromProduct(productId, restaurantId, {
    variantId: options?.variantId,
    modifierIds: options?.modifierIds,
    quantity,
    notes: options?.notes,
    kitchenNotes: options?.kitchenNotes,
  });

  await findOrIncrementPendingOrderItem({
    orderId,
    productId,
    quantity,
    snapshots,
  });

  if (options?.staffId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { staffId: options.staffId },
    });
  }

  return recalculateOrder(orderId);
}

export async function updateFulfillmentItemConfig(
  orderId: string,
  restaurantId: string,
  itemId: string,
  input: {
    variantId?: string | null;
    modifierIds?: string[];
    quantity?: number;
    notes?: string;
    kitchenNotes?: string;
  }
) {
  await assertFulfillmentOrder(orderId, restaurantId);

  const item = await prisma.orderItem.findFirst({
    where: { id: itemId, orderId, order: { restaurantId } },
  });
  if (!item) throw new AppError("Item not found", "NOT_FOUND", 404);
  if (item.kitchenStatus !== OrderItemKitchenStatus.PENDING) {
    throw new AppError("Cannot modify item already sent to kitchen", "FORBIDDEN", 403);
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
      totalPrice: snapshots.totalPrice,
      modifiers: snapshots.modifiers as unknown as Prisma.InputJsonValue,
      notes: snapshots.notes,
      kitchenNotes: snapshots.kitchenNotes,
    },
  });

  return recalculateOrder(orderId);
}

export async function updateFulfillmentItemQty(
  orderId: string,
  restaurantId: string,
  itemId: string,
  quantity: number
) {
  await assertFulfillmentOrder(orderId, restaurantId);
  if (quantity < 1) throw new AppError("Quantity must be at least 1", "VALIDATION", 400);

  const item = await prisma.orderItem.findFirst({
    where: { id: itemId, orderId, order: { restaurantId } },
  });
  if (!item) throw new AppError("Item not found", "NOT_FOUND", 404);
  if (item.kitchenStatus !== OrderItemKitchenStatus.PENDING) {
    throw new AppError("Cannot modify item already sent to kitchen", "FORBIDDEN", 403);
  }

  await prisma.orderItem.update({
    where: { id: itemId },
    data: { quantity, totalPrice: item.unitPrice * quantity },
  });

  return recalculateOrder(orderId);
}

export async function removeFulfillmentItem(
  orderId: string,
  restaurantId: string,
  itemId: string
) {
  await assertFulfillmentOrder(orderId, restaurantId);

  const item = await prisma.orderItem.findFirst({
    where: { id: itemId, orderId, order: { restaurantId } },
  });
  if (!item) throw new AppError("Item not found", "NOT_FOUND", 404);
  if (item.kitchenStatus !== OrderItemKitchenStatus.PENDING) {
    throw new AppError("Cannot remove item already sent to kitchen", "FORBIDDEN", 403);
  }

  await prisma.orderItem.delete({ where: { id: itemId } });
  return recalculateOrder(orderId);
}

export async function submitFulfillmentToKitchen(
  orderId: string,
  restaurantId: string,
  staffId?: string
) {
  const order = await assertFulfillmentOrder(orderId, restaurantId);

  const fullOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true, revisions: true },
  });
  if (!fullOrder) throw new AppError("Order not found", "NOT_FOUND", 404);

  const pendingItems = fullOrder.items.filter(
    (i) => i.kitchenStatus === OrderItemKitchenStatus.PENDING
  );
  if (pendingItems.length === 0) {
    throw new AppError("No new items to send", "VALIDATION", 400);
  }

  const settings = await getRestaurantOrderSettings(restaurantId);
  const nextRevision = (fullOrder.revisions[0]?.revisionNumber ?? 0) + 1;
  if (settings.maxRevisions && nextRevision > settings.maxRevisions) {
    throw new AppError("Maximum revisions reached", "LIMIT", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderRevision.create({
      data: {
        orderId: fullOrder.id,
        revisionNumber: nextRevision,
        submittedByStaffId: staffId,
        notes: JSON.stringify({
          itemCount: pendingItems.length,
          items: pendingItems.map((i) => ({ id: i.id, name: i.name, qty: i.quantity })),
        }),
      },
    });

    await tx.orderItem.updateMany({
      where: { orderId: fullOrder.id, kitchenStatus: OrderItemKitchenStatus.PENDING },
      data: {
        kitchenStatus: OrderItemKitchenStatus.SENT,
        revisionNumber: nextRevision,
        kitchenSentAt: new Date(),
        kitchenStatusUpdatedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: fullOrder.id },
      data: { isHeld: false, status: OrderStatus.PREPARING },
    });

    const existingKitchen = await tx.kitchenOrder.findFirst({
      where: { orderId: fullOrder.id },
    });
    if (!existingKitchen) {
      await tx.kitchenOrder.create({ data: { orderId: fullOrder.id, status: "QUEUED" } });
    }
  });

  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 5 },
      deliveryDetails: true,
      kitchenOrders: true,
    },
  });
}

export async function transitionFulfillmentStatus(
  orderId: string,
  restaurantId: string,
  nextStatus: OrderStatus
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId,
      orderType: { in: [OrderType.TAKEAWAY, OrderType.DELIVERY] },
    },
  });
  if (!order) throw new AppError("Order not found", "NOT_FOUND", 404);

  const takeawayFlow: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP],
    [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.PICKED_UP],
    [OrderStatus.PICKED_UP]: [OrderStatus.COMPLETED],
  };

  const deliveryFlow: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [OrderStatus.PREPARING]: [OrderStatus.READY],
    [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY],
    [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
  };

  const allowed =
    order.orderType === OrderType.TAKEAWAY
      ? takeawayFlow[order.status]
      : deliveryFlow[order.status];

  if (!allowed?.includes(nextStatus)) {
    throw new AppError(`Cannot transition from ${order.status} to ${nextStatus}`, "VALIDATION", 400);
  }

  const kitchenUpdate =
    nextStatus === OrderStatus.READY_FOR_PICKUP || nextStatus === OrderStatus.READY
      ? { status: "READY" as const, readyAt: new Date() }
      : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
    });
    if (kitchenUpdate) {
      await tx.kitchenOrder.updateMany({
        where: { orderId },
        data: kitchenUpdate,
      });
    }
    if (nextStatus === OrderStatus.COMPLETED) {
      await tx.kitchenOrder.updateMany({
        where: { orderId },
        data: { status: "SERVED" },
      });
    }
  });

  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      deliveryDetails: true,
      payments: true,
      kitchenOrders: true,
    },
  });
}

export async function cancelFulfillmentOrder(orderId: string, restaurantId: string) {
  await assertFulfillmentOrder(orderId, restaurantId);
  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED },
  });
}

export async function setFulfillmentPaymentStatus(
  orderId: string,
  restaurantId: string,
  paymentStatus: OrderPaymentStatus
) {
  await assertFulfillmentOrder(orderId, restaurantId);
  return prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type FulfillmentActor = OrderActor;
