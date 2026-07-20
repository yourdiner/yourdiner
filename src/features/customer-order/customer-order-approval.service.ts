import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getRestaurantOrderSettings } from "@/lib/order-settings";
import { submitOrderToKitchenService } from "@/features/dining-session/order.service";
import { appendSessionEvent } from "@/features/dining-session/timeline.service";
import type { OrderActor } from "@/features/dining-session/auth";
import { OrderItemKitchenStatus, OrderStatus } from "@prisma/client";

export async function getPendingFirstCustomerOrders(restaurantId: string) {
  return prisma.order.findMany({
    where: {
      restaurantId,
      awaitingCustomerOrderApproval: true,
      status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
    },
    include: {
      diningSession: {
        include: {
          customer: { select: { name: true, phone: true } },
          table: { select: { number: true, name: true } },
          customerTableSession: { select: { id: true } },
        },
      },
      items: { where: { kitchenStatus: OrderItemKitchenStatus.PENDING } },
    },
    orderBy: { updatedAt: "asc" },
  });
}

export async function approveFirstCustomerOrder(
  orderId: string,
  restaurantId: string,
  actor: OrderActor
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId,
      awaitingCustomerOrderApproval: true,
    },
    include: {
      diningSession: {
        include: { customerTableSession: true },
      },
    },
  });

  if (!order?.diningSessionId) {
    throw new AppError("Order not found", "NOT_FOUND", 404);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { awaitingCustomerOrderApproval: false },
  });

  const tableSessionId = order.diningSession?.customerTableSession?.id;
  if (tableSessionId) {
    await prisma.tableSession.update({
      where: { id: tableSessionId },
      data: { firstOrderApprovedAt: new Date() },
    });
  }

  await submitOrderToKitchenService(order.diningSessionId, restaurantId, actor, undefined, {
    skipFirstOrderGate: true,
  });

  await appendSessionEvent({
    diningSessionId: order.diningSessionId,
    type: "CUSTOMER_ORDER_APPROVED",
    message: "First customer order approved and sent to kitchen",
    actor,
  });
}

export async function rejectFirstCustomerOrder(
  orderId: string,
  restaurantId: string,
  actor: OrderActor
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId,
      awaitingCustomerOrderApproval: true,
    },
    include: { items: true },
  });

  if (!order?.diningSessionId) {
    throw new AppError("Order not found", "NOT_FOUND", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({
      where: { orderId, kitchenStatus: OrderItemKitchenStatus.PENDING },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { awaitingCustomerOrderApproval: false },
    });
  });

  await appendSessionEvent({
    diningSessionId: order.diningSessionId,
    type: "CUSTOMER_ORDER_REJECTED",
    message: "First customer order rejected by staff",
    actor,
  });
}
