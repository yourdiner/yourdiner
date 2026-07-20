import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@prisma/client";
import {
  fetchRazorpayInvoices,
  fetchRazorpaySubscription,
  isRazorpayConfigured,
} from "@/lib/payments/razorpay";

function mapRazorpayInvoiceStatus(status: string): InvoiceStatus {
  switch (status) {
    case "paid":
      return InvoiceStatus.PAID;
    case "issued":
    case "partially_paid":
      return InvoiceStatus.PENDING;
    case "expired":
    case "cancelled":
      return InvoiceStatus.FAILED;
    default:
      return InvoiceStatus.DRAFT;
  }
}

export async function upsertInvoiceFromPayment(input: {
  subscriptionId: string;
  amount: number;
  razorpayPaymentId: string;
  razorpayInvoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceUrl?: string | null;
  paidAt?: Date;
}) {
  const status = InvoiceStatus.PAID;
  const paidAt = input.paidAt ?? new Date();

  if (input.razorpayInvoiceId) {
    return prisma.invoice.upsert({
      where: { razorpayInvoiceId: input.razorpayInvoiceId },
      create: {
        subscriptionId: input.subscriptionId,
        razorpayInvoiceId: input.razorpayInvoiceId,
        razorpayPaymentId: input.razorpayPaymentId,
        invoiceNumber: input.invoiceNumber ?? undefined,
        invoiceUrl: input.invoiceUrl ?? undefined,
        amount: input.amount,
        status,
        paidAt,
      },
      update: {
        razorpayPaymentId: input.razorpayPaymentId,
        invoiceNumber: input.invoiceNumber ?? undefined,
        invoiceUrl: input.invoiceUrl ?? undefined,
        amount: input.amount,
        status,
        paidAt,
      },
    });
  }

  const existing = await prisma.invoice.findFirst({
    where: {
      subscriptionId: input.subscriptionId,
      razorpayPaymentId: input.razorpayPaymentId,
    },
  });

  if (existing) {
    return prisma.invoice.update({
      where: { id: existing.id },
      data: {
        amount: input.amount,
        status,
        paidAt,
        invoiceNumber: input.invoiceNumber ?? undefined,
        invoiceUrl: input.invoiceUrl ?? undefined,
      },
    });
  }

  return prisma.invoice.create({
    data: {
      subscriptionId: input.subscriptionId,
      razorpayPaymentId: input.razorpayPaymentId,
      invoiceNumber: input.invoiceNumber ?? undefined,
      invoiceUrl: input.invoiceUrl ?? undefined,
      amount: input.amount,
      status,
      paidAt,
    },
  });
}

const SYNC_COOLDOWN_MS = 60_000;
const lastInvoiceSyncAt = new Map<string, number>();

export async function syncInvoicesForSubscription(
  subscriptionId: string,
  options?: { force?: boolean }
) {
  if (!isRazorpayConfigured()) return null;

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!subscription) return null;

  const now = Date.now();
  const lastSync = lastInvoiceSyncAt.get(subscriptionId) ?? 0;
  if (!options?.force && now - lastSync < SYNC_COOLDOWN_MS) {
    return findSubscriptionWithInvoices(subscriptionId);
  }

  try {
    const invoices = await fetchRazorpayInvoices({
      subscriptionId: subscription.razorpaySubscriptionId ?? undefined,
      customerId: subscription.razorpayCustomerId ?? undefined,
    });
    lastInvoiceSyncAt.set(subscriptionId, Date.now());

    for (const inv of invoices) {
      const paidAt = inv.paid_at ? new Date(inv.paid_at * 1000) : undefined;
      await prisma.invoice.upsert({
        where: { razorpayInvoiceId: inv.id },
        create: {
          subscriptionId,
          razorpayInvoiceId: inv.id,
          amount: inv.amount,
          currency: inv.currency ?? "INR",
          status: mapRazorpayInvoiceStatus(inv.status),
          invoiceNumber: inv.invoice_number ?? undefined,
          invoiceUrl: inv.short_url ?? undefined,
          paidAt,
        },
        update: {
          amount: inv.amount,
          status: mapRazorpayInvoiceStatus(inv.status),
          invoiceNumber: inv.invoice_number ?? undefined,
          invoiceUrl: inv.short_url ?? undefined,
          paidAt,
        },
      });
    }

    if (subscription.razorpaySubscriptionId) {
      const rzSub = await fetchRazorpaySubscription(subscription.razorpaySubscriptionId);
      if (rzSub?.current_end) {
        const nextPaymentAt = new Date(rzSub.current_end * 1000);
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { nextPaymentAt },
        });
      } else if (rzSub?.charge_at) {
        const nextPaymentAt = new Date(rzSub.charge_at * 1000);
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { nextPaymentAt },
        });
      }
    }
  } catch (error) {
    console.error("Invoice sync failed:", error);
  }

  return findSubscriptionWithInvoices(subscriptionId);
}

async function findSubscriptionWithInvoices(subscriptionId: string) {
  return prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      planVersion: {
        include: {
          planFeatures: { include: { feature: true } },
          pricing: { orderBy: { effectiveFrom: "desc" }, take: 5 },
        },
      },
      scheduledPlan: true,
      scheduledPlanVersion: true,
      payments: { orderBy: { createdAt: "desc" }, take: 20 },
      invoices: { orderBy: { createdAt: "desc" }, take: 20 },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}
