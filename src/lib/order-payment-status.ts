import { prisma } from "@/lib/db";
import { OrderPaymentStatus, OrderStatus } from "@prisma/client";

type PaymentSlice = {
  paymentStatus: OrderPaymentStatus;
  total: number;
  status: OrderStatus;
  payments: { amount: number }[];
  diningSession?: { payments: { amount: number }[] } | null;
};

export function sumCompletedPayments(order: PaymentSlice): number {
  const orderPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
  const sessionPaid =
    order.diningSession?.payments.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  return orderPaid + sessionPaid;
}

export function resolveOrderPaymentStatus(order: PaymentSlice): OrderPaymentStatus {
  const paid = sumCompletedPayments(order);

  if (order.total <= 0 && order.status === OrderStatus.COMPLETED) {
    return OrderPaymentStatus.PAID;
  }
  if (paid >= order.total && order.total > 0) {
    return OrderPaymentStatus.PAID;
  }
  if (paid > 0) {
    return OrderPaymentStatus.PARTIAL;
  }
  return order.paymentStatus;
}

export async function syncOrderPaymentStatus(orderId: string): Promise<OrderPaymentStatus> {
  if (!orderId) return OrderPaymentStatus.PENDING;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
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

  if (!order) return OrderPaymentStatus.PENDING;

  const next = resolveOrderPaymentStatus(order);
  if (next !== order.paymentStatus) {
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: next },
    });
  }
  return next;
}
