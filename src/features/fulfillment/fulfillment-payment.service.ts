import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { OrderPaymentStatus, OrderStatus, OrderType } from "@prisma/client";
import type { SessionPaymentMethod } from "@prisma/client";
import { sumCompletedPayments, syncOrderPaymentStatus } from "@/lib/order-payment-status";

export async function recordFulfillmentPayment(
  orderId: string,
  restaurantId: string,
  input: {
    amount: number;
    method: SessionPaymentMethod;
    notes?: string;
  }
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId,
      orderType: { in: [OrderType.TAKEAWAY, OrderType.DELIVERY] },
      status: { notIn: [OrderStatus.CANCELLED] },
    },
    select: {
      id: true,
      total: true,
      status: true,
      paymentStatus: true,
      payments: { where: { status: "COMPLETED" }, select: { amount: true } },
      diningSession: {
        select: {
          payments: { where: { status: "COMPLETED" }, select: { amount: true } },
        },
      },
    },
  });
  if (!order) throw new AppError("Order not found", "NOT_FOUND", 404);

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AppError("Payment amount must be greater than zero", "VALIDATION", 400);
  }

  const paid = sumCompletedPayments(order);
  const remaining = Math.max(0, order.total - paid);
  if (remaining <= 0) {
    throw new AppError("Order is already fully paid", "VALIDATION", 400);
  }

  const paymentAmount = Math.min(Math.round(input.amount), remaining);

  await prisma.orderPayment.create({
    data: {
      restaurantId,
      orderId,
      amount: paymentAmount,
      method: input.method,
      status: "COMPLETED",
      notes: input.notes,
    },
  });

  await syncOrderPaymentStatus(orderId);

  const refreshed = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });

  if (refreshed?.paymentStatus === OrderPaymentStatus.PAID) {
    const { enqueueAutoPrintBill } = await import("@/features/printing/printer.service");
    enqueueAutoPrintBill(restaurantId, orderId);
  }

  return refreshed;
}

export async function completeFulfillmentOrder(orderId: string, restaurantId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId,
      orderType: { in: [OrderType.TAKEAWAY, OrderType.DELIVERY] },
    },
  });
  if (!order) throw new AppError("Order not found", "NOT_FOUND", 404);

  await syncOrderPaymentStatus(orderId);
  const refreshed = await prisma.order.findUnique({ where: { id: orderId } });
  if (!refreshed) throw new AppError("Order not found", "NOT_FOUND", 404);

  if (refreshed.paymentStatus !== OrderPaymentStatus.PAID && refreshed.total > 0) {
    throw new AppError("Payment required before completing order", "VALIDATION", 400);
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.COMPLETED },
    include: { payments: true, deliveryDetails: true },
  });
}
