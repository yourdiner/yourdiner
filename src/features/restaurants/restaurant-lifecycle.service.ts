import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  BillingRecordType,
  DiningSessionStatus,
  OrderStatus,
  RestaurantStatus,
  SubscriptionStatus,
  TableSessionStatus,
} from "@prisma/client";
import { cancelRazorpaySubscription } from "@/lib/payments/razorpay";
import { cancelSubscriptionRecord } from "@/modules/subscription-engine/services/subscription.service";
import { logBillingAction } from "@/modules/subscription-engine/services/billing-audit.service";
import { BLOCKING_TABLE_SESSION_STATUSES } from "@/lib/table-sessions";
import { terminalOrderStatusFilter } from "@/lib/prisma-filters";

function toArchivePayload(value: unknown): object {
  return JSON.parse(JSON.stringify(value)) as object;
}

export type LifecycleActor = {
  userId: string;
  email?: string;
};

export type PermanentDeletePreview = {
  restaurantId: string;
  name: string;
  orders: number;
  customers: number;
  reservations: number;
  payments: number;
  invoices: number;
  staff: number;
  menuItems: number;
};

async function cancelRestaurantSubscription(
  restaurantId: string,
  actor: LifecycleActor,
  reason: string
) {
  const subscription = await prisma.subscription.findUnique({
    where: { restaurantId },
  });

  if (!subscription || subscription.status === SubscriptionStatus.CANCELLED) {
    return subscription;
  }

  if (subscription.razorpaySubscriptionId) {
    try {
      await cancelRazorpaySubscription(subscription.razorpaySubscriptionId);
    } catch {
      // Best-effort Razorpay cancel; local record still updated
    }
  }

  const updated = await cancelSubscriptionRecord(subscription.id, {
    actorUserId: actor.userId,
    reason,
  });

  await logBillingAction({
    action: "SUBSCRIPTION_CANCELLED",
    entityType: "subscription",
    entityId: subscription.id,
    restaurantId,
    actorUserId: actor.userId,
    metadata: { reason },
  });

  return updated;
}

async function shutdownOperationalSessions(restaurantId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.staffSession.updateMany({
      where: { restaurantId, isActive: true },
      data: { isActive: false },
    });

    await tx.tableSession.updateMany({
      where: {
        restaurantId,
        status: { in: BLOCKING_TABLE_SESSION_STATUSES },
        isActive: true,
      },
      data: {
        status: TableSessionStatus.CLOSED,
        isActive: false,
        endedAt: new Date(),
      },
    });

    const activeDiningSessions = await tx.diningSession.findMany({
      where: {
        restaurantId,
        status: { in: [DiningSessionStatus.ACTIVE, DiningSessionStatus.BILL_REQUESTED] },
      },
      select: { id: true },
    });

    if (activeDiningSessions.length > 0) {
      const sessionIds = activeDiningSessions.map((s) => s.id);
      await tx.diningSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: DiningSessionStatus.CLOSED, closedAt: new Date() },
      });
      await tx.order.updateMany({
        where: {
          diningSessionId: { in: sessionIds },
          NOT: terminalOrderStatusFilter(),
        },
        data: { status: OrderStatus.CANCELLED },
      });
    }
  });
}

async function logLifecycleActivity(
  restaurantId: string,
  actor: LifecycleActor,
  action: "DELETE" | "RESTORE" | "PERMANENT_DELETE",
  metadata: Record<string, unknown>
) {
  await prisma.activityLog.create({
    data: {
      restaurantId: action === "PERMANENT_DELETE" ? null : restaurantId,
      userId: actor.userId,
      action,
      entity: "restaurant",
      entityId: restaurantId,
      metadata: metadata as object,
    },
  });
}

export async function softDeleteRestaurant(
  restaurantId: string,
  actor: LifecycleActor,
  reason?: string
) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { subscription: true },
  });

  if (!restaurant) {
    throw new AppError("Restaurant not found", "NOT_FOUND", 404);
  }

  if (restaurant.status === RestaurantStatus.DELETED) {
    throw new AppError("Restaurant is already deleted", "ALREADY_DELETED", 400);
  }

  const deleteReason = reason?.trim() || "Deleted by super admin";

  await cancelRestaurantSubscription(restaurantId, actor, deleteReason);
  await shutdownOperationalSessions(restaurantId);

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      status: RestaurantStatus.DELETED,
      deletedAt: new Date(),
      deletedBy: actor.userId,
      deleteReason,
    },
  });

  await logLifecycleActivity(restaurantId, actor, "DELETE", {
    reason: deleteReason,
    deletedBy: actor.userId,
    subscriptionStatus: restaurant.subscription?.status ?? null,
  });

  await logBillingAction({
    action: "RESTAURANT_DELETED",
    entityType: "restaurant",
    entityId: restaurantId,
    restaurantId,
    actorUserId: actor.userId,
    metadata: { reason: deleteReason, subdomain: restaurant.subdomain },
  });

  await logBillingAction({
    action: "SUBDOMAIN_DISABLED",
    entityType: "restaurant",
    entityId: restaurantId,
    restaurantId,
    actorUserId: actor.userId,
    metadata: { subdomain: restaurant.subdomain },
  });

  return updated;
}

export async function restoreRestaurant(restaurantId: string, actor: LifecycleActor) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new AppError("Restaurant not found", "NOT_FOUND", 404);
  }

  if (restaurant.status !== RestaurantStatus.DELETED) {
    throw new AppError("Only deleted restaurants can be restored", "INVALID_STATUS", 400);
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      status: RestaurantStatus.ACTIVE,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
    },
  });

  await logLifecycleActivity(restaurantId, actor, "RESTORE", {
    restoredBy: actor.userId,
  });

  await logBillingAction({
    action: "RESTAURANT_RESTORED",
    entityType: "restaurant",
    entityId: restaurantId,
    restaurantId,
    actorUserId: actor.userId,
    metadata: { subdomain: restaurant.subdomain },
  });

  return updated;
}

export async function getPermanentDeletePreview(
  restaurantId: string
): Promise<PermanentDeletePreview> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      subscription: {
        include: {
          _count: { select: { invoices: true, payments: true } },
        },
      },
      _count: {
        select: {
          orders: true,
          customers: true,
          reservations: true,
          staff: true,
          products: true,
        },
      },
    },
  });

  if (!restaurant) {
    throw new AppError("Restaurant not found", "NOT_FOUND", 404);
  }

  if (restaurant.status !== RestaurantStatus.DELETED) {
    throw new AppError(
      "Restaurant must be soft-deleted before permanent deletion",
      "INVALID_STATUS",
      400
    );
  }

  return {
    restaurantId: restaurant.id,
    name: restaurant.name,
    orders: restaurant._count.orders,
    customers: restaurant._count.customers,
    reservations: restaurant._count.reservations,
    payments: restaurant.subscription?._count.payments ?? 0,
    invoices: restaurant.subscription?._count.invoices ?? 0,
    staff: restaurant._count.staff,
    menuItems: restaurant._count.products,
  };
}

export async function permanentlyDeleteRestaurant(
  restaurantId: string,
  actor: LifecycleActor,
  reason?: string
) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      subscription: {
        include: {
          invoices: true,
          payments: true,
          events: true,
        },
      },
      _count: {
        select: {
          orders: true,
          customers: true,
          reservations: true,
          staff: true,
          products: true,
        },
      },
    },
  });

  if (!restaurant) {
    throw new AppError("Restaurant not found", "NOT_FOUND", 404);
  }

  if (restaurant.status !== RestaurantStatus.DELETED) {
    throw new AppError(
      "Restaurant must be soft-deleted before permanent deletion",
      "INVALID_STATUS",
      400
    );
  }

  const deleteReason = reason?.trim() || restaurant.deleteReason || "Permanently deleted by super admin";

  await cancelRestaurantSubscription(restaurantId, actor, deleteReason);

  const subscription = restaurant.subscription;
  const billingRecords: Array<{
    recordType: BillingRecordType;
    sourceId?: string;
    amount?: number;
    currency?: string;
    status?: string;
    invoiceNumber?: string;
    razorpayPaymentId?: string;
    razorpayInvoiceId?: string;
    razorpaySubscriptionId?: string;
    paidAt?: Date | null;
    billingPeriodStart?: Date | null;
    billingPeriodEnd?: Date | null;
    rawPayload: object;
  }> = [];

  if (subscription) {
    billingRecords.push({
      recordType: BillingRecordType.SUBSCRIPTION,
      sourceId: subscription.id,
      amount: subscription.pricePaid,
      currency: "INR",
      status: subscription.status,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId ?? undefined,
      rawPayload: toArchivePayload(subscription),
    });

    for (const invoice of subscription.invoices) {
      billingRecords.push({
        recordType: BillingRecordType.INVOICE,
        sourceId: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        invoiceNumber: invoice.invoiceNumber ?? undefined,
        razorpayInvoiceId: invoice.razorpayInvoiceId ?? undefined,
        razorpayPaymentId: invoice.razorpayPaymentId ?? undefined,
        paidAt: invoice.paidAt,
        billingPeriodStart: invoice.billingPeriodStart,
        billingPeriodEnd: invoice.billingPeriodEnd,
        rawPayload: toArchivePayload(invoice),
      });
    }

    for (const payment of subscription.payments) {
      billingRecords.push({
        recordType: BillingRecordType.PAYMENT,
        sourceId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        razorpayPaymentId: payment.razorpayPaymentId ?? undefined,
        paidAt: payment.paidAt,
        rawPayload: toArchivePayload(payment),
      });
    }

    for (const event of subscription.events) {
      billingRecords.push({
        recordType: BillingRecordType.SUBSCRIPTION_EVENT,
        sourceId: event.id,
        status: event.type,
        rawPayload: toArchivePayload(event),
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.restaurantArchive.create({
      data: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        subdomain: restaurant.subdomain,
        permanentlyDeletedBy: actor.userId,
        deleteReason,
        softDeletedAt: restaurant.deletedAt,
        softDeletedBy: restaurant.deletedBy,
        subscriptionStatusAtDeletion: subscription?.status ?? null,
        razorpaySubscriptionId: subscription?.razorpaySubscriptionId ?? null,
        orderCount: restaurant._count.orders,
        customerCount: restaurant._count.customers,
        reservationCount: restaurant._count.reservations,
        staffCount: restaurant._count.staff,
        menuItemCount: restaurant._count.products,
        invoiceCount: subscription?.invoices.length ?? 0,
        paymentCount: subscription?.payments.length ?? 0,
        billingRecords: {
          create: billingRecords.map((record) => ({
            recordType: record.recordType,
            restaurantNameSnapshot: restaurant.name,
            restaurantSubdomainSnapshot: restaurant.subdomain,
            sourceId: record.sourceId,
            amount: record.amount,
            currency: record.currency ?? "INR",
            status: record.status,
            invoiceNumber: record.invoiceNumber,
            razorpayPaymentId: record.razorpayPaymentId,
            razorpayInvoiceId: record.razorpayInvoiceId,
            razorpaySubscriptionId: record.razorpaySubscriptionId,
            paidAt: record.paidAt,
            billingPeriodStart: record.billingPeriodStart,
            billingPeriodEnd: record.billingPeriodEnd,
            rawPayload: record.rawPayload,
          })),
        },
      },
    });

    await tx.restaurant.delete({ where: { id: restaurantId } });
  });

  await logLifecycleActivity(restaurantId, actor, "PERMANENT_DELETE", {
    reason: deleteReason,
    deletedBy: actor.userId,
    orderCount: restaurant._count.orders,
    customerCount: restaurant._count.customers,
    billingRecordsArchived: billingRecords.length,
  });

  await logBillingAction({
    action: "RESTAURANT_PERMANENTLY_DELETED",
    entityType: "restaurant_archive",
    entityId: restaurantId,
    restaurantId,
    actorUserId: actor.userId,
    metadata: {
      reason: deleteReason,
      name: restaurant.name,
      subdomain: restaurant.subdomain,
      billingRecordsArchived: billingRecords.length,
    },
  });

  return { archiveId: restaurantId };
}
