import { prisma } from "@/lib/db";
import { PaymentStatus, RefundStatus } from "@prisma/client";
import { logSubscriptionEvent } from "../repositories/subscription.repository";
import { activateSubscription } from "./subscription.service";

export async function recordPayment(input: {
  subscriptionId: string;
  amount: number;
  currency?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  invoiceId?: string;
  invoiceUrl?: string;
  receiptUrl?: string;
  taxAmount?: number;
  paymentMethod?: string;
  paidAt?: Date;
}) {
  return prisma.subscriptionPayment.create({
    data: {
      subscriptionId: input.subscriptionId,
      amount: input.amount,
      taxAmount: input.taxAmount ?? 0,
      currency: input.currency ?? "INR",
      status: PaymentStatus.PAID,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpayOrderId: input.razorpayOrderId,
      invoiceId: input.invoiceId,
      invoiceUrl: input.invoiceUrl,
      receiptUrl: input.receiptUrl,
      paymentMethod: input.paymentMethod,
      paidAt: input.paidAt ?? new Date(),
    },
  });
}

export async function handlePaymentSuccess(input: {
  subscriptionId: string;
  amount: number;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  paymentDate?: Date;
  paymentMethod?: string;
  taxAmount?: number;
}) {
  if (input.razorpayPaymentId) {
    const existing = await prisma.subscriptionPayment.findFirst({
      where: { razorpayPaymentId: input.razorpayPaymentId },
    });
    if (existing) return prisma.subscription.findUnique({ where: { id: input.subscriptionId } });
  }

  await recordPayment({
    subscriptionId: input.subscriptionId,
    amount: input.amount,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpayOrderId: input.razorpayOrderId,
    paymentMethod: input.paymentMethod,
    taxAmount: input.taxAmount,
    paidAt: input.paymentDate,
  });

  const subscription = await activateSubscription({
    subscriptionId: input.subscriptionId,
    paymentDate: input.paymentDate,
  });

  await logSubscriptionEvent(input.subscriptionId, "PAYMENT_SUCCEEDED", {
    amount: input.amount,
    razorpayPaymentId: input.razorpayPaymentId,
  });

  return subscription;
}

export async function handlePaymentFailed(subscriptionId: string) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { paymentStatus: PaymentStatus.FAILED },
  });
  await logSubscriptionEvent(subscriptionId, "PAYMENT_FAILED", {});
}

export async function initiateRefund(paymentId: string) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) throw new Error("Payment not found");

  return prisma.subscriptionPayment.update({
    where: { id: paymentId },
    data: { refundStatus: RefundStatus.PENDING },
  });
}

export async function isWebhookProcessed(razorpayEventId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { razorpayEventId },
  });
  return !!existing?.processedAt;
}

/** Atomically claim a webhook event ID. Returns false if already claimed/processed. */
export async function tryClaimWebhookEvent(
  razorpayEventId: string,
  eventType: string,
  payload: unknown
): Promise<"claimed" | "duplicate" | "in_flight"> {
  try {
    await prisma.webhookEvent.create({
      data: {
        razorpayEventId,
        eventType,
        payload: payload as object,
        processedAt: null,
      },
    });
    return "claimed";
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const existing = await prisma.webhookEvent.findUnique({
        where: { razorpayEventId },
        select: { processedAt: true },
      });
      return existing?.processedAt ? "duplicate" : "in_flight";
    }
    throw error;
  }
}

export async function markWebhookProcessed(
  razorpayEventId: string,
  eventType: string,
  payload: unknown
) {
  return prisma.webhookEvent.upsert({
    where: { razorpayEventId },
    create: {
      razorpayEventId,
      eventType,
      payload: payload as object,
      processedAt: new Date(),
    },
    update: { processedAt: new Date(), eventType, payload: payload as object },
  });
}

export async function releaseWebhookClaim(razorpayEventId: string): Promise<void> {
  await prisma.webhookEvent.deleteMany({
    where: { razorpayEventId, processedAt: null },
  });
}
