import { prisma } from "@/lib/db";
import { InvoiceStatus, MandateStatus, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import {
  findSubscriptionByRazorpayId,
  logSubscriptionEvent,
} from "../repositories/subscription.repository";
import { assignLatestVersionOnRenewal, activateSubscription } from "../services/subscription.service";
import { handlePaymentSuccess, handlePaymentFailed, recordPayment } from "../services/payment.service";
import { upsertInvoiceFromPayment, syncInvoicesForSubscription } from "../services/invoice-sync.service";
import { logBillingAction } from "../services/billing-audit.service";
import { getGlobalGraceDays } from "../services/platform-settings.service";
import { notifyRestaurantOwner } from "../services/notification.service";
import {
  finalizePlanUpgrade,
  applyUpgradeAfterPayment,
} from "../services/upgrade-downgrade.service";

type WebhookPayload = {
  subscription?: { entity?: Record<string, unknown> };
  payment?: { entity?: Record<string, unknown> };
  invoice?: { entity?: Record<string, unknown> };
};

function getEntity(payload: WebhookPayload, key: keyof WebhookPayload) {
  return payload[key]?.entity as Record<string, unknown> | undefined;
}

export async function handleSubscriptionAuthenticated(payload: WebhookPayload) {
  const entity = getEntity(payload, "subscription");
  const subId = entity?.id as string | undefined;
  if (!subId) return;

  const subscription = await findSubscriptionByRazorpayId(subId);
  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      mandateStatus: MandateStatus.ACTIVE,
      autoDebitEnabled: true,
    },
  });

  await logSubscriptionEvent(subscription.id, "MANDATE_CREATED", { razorpaySubscriptionId: subId });
  await logBillingAction({
    action: "MANDATE_CREATED",
    entityType: "Subscription",
    entityId: subscription.id,
    restaurantId: subscription.restaurantId,
    metadata: { razorpaySubscriptionId: subId },
  });
}

export async function handleSubscriptionActivated(payload: WebhookPayload) {
  const entity = getEntity(payload, "subscription");
  const subId = entity?.id as string | undefined;
  if (!subId) return;

  const subscription = await findSubscriptionByRazorpayId(subId);
  if (!subscription) return;

  if (subscription.pendingUpgradePlanId) {
    const paidAt = entity?.current_start
      ? new Date((entity.current_start as number) * 1000)
      : new Date();
    await finalizePlanUpgrade(subscription.id, undefined, paidAt);
    await syncInvoicesForSubscription(subscription.id);
    await logBillingAction({
      action: "UPGRADED",
      entityType: "Subscription",
      entityId: subscription.id,
      restaurantId: subscription.restaurantId,
    });
    return;
  }

  const periodStart = entity?.current_start
    ? new Date((entity.current_start as number) * 1000)
    : new Date();
  const periodEnd = entity?.current_end
    ? new Date((entity.current_end as number) * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PAID,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      nextPaymentAt: periodEnd,
      lastPaymentAt: new Date(),
      gracePeriodEndsAt: null,
      pendingCheckout: false,
      pendingCheckoutUrl: null,
      mandateStatus: MandateStatus.ACTIVE,
      autoDebitEnabled: true,
    },
  });

  await prisma.restaurant.update({
    where: { id: subscription.restaurantId },
    data: { status: "ACTIVE" },
  });

  await logSubscriptionEvent(subscription.id, "CREATED", { activated: true });
  await logBillingAction({
    action: "SUBSCRIPTION_ACTIVATED",
    entityType: "Subscription",
    entityId: subscription.id,
    restaurantId: subscription.restaurantId,
  });
}

export async function handleSubscriptionCharged(payload: WebhookPayload) {
  const entity = getEntity(payload, "subscription");
  const subId = entity?.id as string | undefined;
  const subscription = subId ? await findSubscriptionByRazorpayId(subId) : null;
  if (!subscription) return;

  if (subscription.pendingUpgradePlanId) {
    const paidAt = entity?.current_start
      ? new Date((entity.current_start as number) * 1000)
      : new Date();
    await finalizePlanUpgrade(subscription.id, undefined, paidAt);
    await syncInvoicesForSubscription(subscription.id);

    const payment = getEntity(payload, "payment");
    if (payment) {
      const existingPayment = payment.id
        ? await prisma.subscriptionPayment.findFirst({
            where: { razorpayPaymentId: payment.id as string },
          })
        : null;
      if (!existingPayment) {
        await recordPayment({
          subscriptionId: subscription.id,
          amount: payment.amount as number,
          razorpayPaymentId: payment.id as string,
          razorpayOrderId: (payment.order_id as string) ?? undefined,
          paymentMethod: (payment.method as string) ?? undefined,
          paidAt,
        });
      }
      await upsertInvoiceFromPayment({
        subscriptionId: subscription.id,
        amount: payment.amount as number,
        razorpayPaymentId: payment.id as string,
        razorpayInvoiceId: (payment.invoice_id as string) ?? null,
        paidAt,
      });
    }

    await logBillingAction({
      action: "UPGRADED",
      entityType: "Subscription",
      entityId: subscription.id,
      restaurantId: subscription.restaurantId,
    });
    return;
  }

  await assignLatestVersionOnRenewal(subscription.id);

  const periodStart = entity?.current_start
    ? new Date((entity.current_start as number) * 1000)
    : new Date();
  const periodEnd = entity?.current_end
    ? new Date((entity.current_end as number) * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      nextPaymentAt: periodEnd,
      lastPaymentAt: new Date(),
      gracePeriodEndsAt: null,
      pendingCheckout: false,
      pendingCheckoutUrl: null,
      paymentStatus: PaymentStatus.PAID,
    },
  });

  await prisma.restaurant.update({
    where: { id: subscription.restaurantId },
    data: { status: "ACTIVE" },
  });

  const payment = getEntity(payload, "payment");
  if (payment) {
    await handlePaymentSuccess({
      subscriptionId: subscription.id,
      amount: payment.amount as number,
      razorpayPaymentId: payment.id as string,
      razorpayOrderId: (payment.order_id as string) ?? undefined,
      paymentDate: new Date(),
    });

    await upsertInvoiceFromPayment({
      subscriptionId: subscription.id,
      amount: payment.amount as number,
      razorpayPaymentId: payment.id as string,
      razorpayInvoiceId: (payment.invoice_id as string) ?? null,
      paidAt: new Date(),
    });
  }

  await logBillingAction({
    action: "RENEWED",
    entityType: "Subscription",
    entityId: subscription.id,
    restaurantId: subscription.restaurantId,
  });
}

export async function handleSubscriptionCompleted(payload: WebhookPayload) {
  const entity = getEntity(payload, "subscription");
  const subId = entity?.id as string | undefined;
  const subscription = subId ? await findSubscriptionByRazorpayId(subId) : null;
  if (!subscription) return;

  const globalGraceDays = await getGlobalGraceDays();
  const graceEnd = new Date();
  graceEnd.setDate(graceEnd.getDate() + globalGraceDays);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.EXPIRED,
      gracePeriodEndsAt: graceEnd,
      autoDebitEnabled: false,
    },
  });

  await logSubscriptionEvent(subscription.id, "GRACE_STARTED", {
    gracePeriodEndsAt: graceEnd.toISOString(),
  });
}

export async function handleSubscriptionCancelled(payload: WebhookPayload) {
  const entity = getEntity(payload, "subscription");
  const subId = entity?.id as string | undefined;
  const subscription = subId ? await findSubscriptionByRazorpayId(subId) : null;
  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
      autoDebitEnabled: false,
      mandateStatus: MandateStatus.NONE,
      pendingCheckout: false,
    },
  });

  await logSubscriptionEvent(subscription.id, "CANCELLED", {});
  await logBillingAction({
    action: "CANCELLED",
    entityType: "Subscription",
    entityId: subscription.id,
    restaurantId: subscription.restaurantId,
  });
}

export async function handlePaymentCaptured(payload: WebhookPayload) {
  const payment = getEntity(payload, "payment");
  if (!payment) return;

  const notes = (payment.notes as Record<string, string>) ?? {};
  let subscription = notes.restaurantId
    ? await prisma.subscription.findUnique({ where: { restaurantId: notes.restaurantId } })
    : null;

  if (!subscription && payment.subscription_id) {
    subscription = await findSubscriptionByRazorpayId(payment.subscription_id as string);
  }

  if (!subscription) return;

  const existingPayment = payment.id
    ? await prisma.subscriptionPayment.findFirst({
        where: { razorpayPaymentId: payment.id as string },
      })
    : null;

  if (existingPayment) return;

  if (notes.type === "upgrade" && subscription.pendingUpgradePlanId) {
    await applyUpgradeAfterPayment(subscription.id, {
      razorpayPaymentId: payment.id as string,
      razorpayOrderId: (payment.order_id as string) ?? undefined,
      amount: payment.amount as number,
      paymentMethod: (payment.method as string) ?? undefined,
    });
    return;
  }

  await handlePaymentSuccess({
    subscriptionId: subscription.id,
    amount: payment.amount as number,
    razorpayPaymentId: payment.id as string,
    razorpayOrderId: (payment.order_id as string) ?? undefined,
    paymentDate: new Date(),
  });

  await upsertInvoiceFromPayment({
    subscriptionId: subscription.id,
    amount: payment.amount as number,
    razorpayPaymentId: payment.id as string,
    razorpayInvoiceId: (payment.invoice_id as string) ?? null,
    paidAt: new Date(),
  });

  await logBillingAction({
    action: "PAYMENT_CAPTURED",
    entityType: "Subscription",
    entityId: subscription.id,
    restaurantId: subscription.restaurantId,
    metadata: { razorpayPaymentId: payment.id },
  });
}

export async function handlePaymentFailedEvent(payload: WebhookPayload) {
  const payment = getEntity(payload, "payment");
  const subId =
    (payment?.subscription_id as string) ||
    (getEntity(payload, "subscription")?.id as string | undefined);
  const subscription = subId ? await findSubscriptionByRazorpayId(subId) : null;
  if (!subscription) return;

  const globalGraceDays = await getGlobalGraceDays();
  const graceEnd = new Date();
  graceEnd.setDate(graceEnd.getDate() + globalGraceDays);

  await handlePaymentFailed(subscription.id);
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.PAST_DUE,
      gracePeriodEndsAt: graceEnd,
      paymentStatus: PaymentStatus.FAILED,
    },
  });

  await notifyRestaurantOwner({
    restaurantId: subscription.restaurantId,
    title: "Payment failed",
    body: "Your subscription payment failed. Please update your payment method.",
    emailSubject: "Payment failed",
    emailHtml: "<p>Your subscription payment failed. Please retry from the billing page.</p>",
  });

  await logBillingAction({
    action: "PAYMENT_FAILED",
    entityType: "Subscription",
    entityId: subscription.id,
    restaurantId: subscription.restaurantId,
  });
}

export async function handleInvoiceCreated(payload: WebhookPayload) {
  const invoice = getEntity(payload, "invoice");
  if (!invoice) return;

  const subId = invoice.subscription_id as string | undefined;
  const subscription = subId ? await findSubscriptionByRazorpayId(subId) : null;
  if (!subscription) return;

  await prisma.invoice.upsert({
    where: { razorpayInvoiceId: invoice.id as string },
    create: {
      subscriptionId: subscription.id,
      razorpayInvoiceId: invoice.id as string,
      amount: invoice.amount as number,
      currency: (invoice.currency as string) ?? "INR",
      status: InvoiceStatus.PENDING,
      invoiceNumber: (invoice.invoice_number as string) ?? undefined,
      invoiceUrl: (invoice.short_url as string) ?? undefined,
    },
    update: {
      amount: invoice.amount as number,
      status: InvoiceStatus.PENDING,
      invoiceNumber: (invoice.invoice_number as string) ?? undefined,
      invoiceUrl: (invoice.short_url as string) ?? undefined,
    },
  });

  await logBillingAction({
    action: "INVOICE_GENERATED",
    entityType: "Invoice",
    entityId: invoice.id as string,
    restaurantId: subscription.restaurantId,
  });
}

export async function handleInvoicePaid(payload: WebhookPayload) {
  const invoice = getEntity(payload, "invoice");
  if (!invoice) return;

  const subId = invoice.subscription_id as string | undefined;
  const subscription = subId ? await findSubscriptionByRazorpayId(subId) : null;
  if (!subscription) return;

  const paidAt = invoice.paid_at
    ? new Date((invoice.paid_at as number) * 1000)
    : new Date();

  const localInvoice = await prisma.invoice.upsert({
    where: { razorpayInvoiceId: invoice.id as string },
    create: {
      subscriptionId: subscription.id,
      razorpayInvoiceId: invoice.id as string,
      amount: invoice.amount as number,
      currency: (invoice.currency as string) ?? "INR",
      status: InvoiceStatus.PAID,
      invoiceNumber: (invoice.invoice_number as string) ?? undefined,
      invoiceUrl: (invoice.short_url as string) ?? undefined,
      paidAt,
    },
    update: {
      status: InvoiceStatus.PAID,
      paidAt,
      invoiceUrl: (invoice.short_url as string) ?? undefined,
    },
  });

  if (subscription.pendingUpgradePlanId) {
    await finalizePlanUpgrade(subscription.id, undefined, paidAt);
    await syncInvoicesForSubscription(subscription.id);
    await logBillingAction({
      action: "UPGRADED",
      entityType: "Invoice",
      entityId: localInvoice.id,
      restaurantId: subscription.restaurantId,
    });
    return;
  }

  if (invoice.payment_id) {
    const existing = await prisma.subscriptionPayment.findFirst({
      where: { razorpayPaymentId: invoice.payment_id as string },
    });
    if (!existing) {
      await recordPayment({
        subscriptionId: subscription.id,
        amount: invoice.amount as number,
        razorpayPaymentId: invoice.payment_id as string,
        paidAt,
      });
    }
  }

  await activateSubscription({
    subscriptionId: subscription.id,
    paymentDate: paidAt,
  });

  await syncInvoicesForSubscription(subscription.id);

  await logBillingAction({
    action: "PAYMENT_CAPTURED",
    entityType: "Invoice",
    entityId: localInvoice.id,
    restaurantId: subscription.restaurantId,
  });
}

export async function handleInvoiceExpired(payload: WebhookPayload) {
  const invoice = getEntity(payload, "invoice");
  if (!invoice?.id) return;

  await prisma.invoice.updateMany({
    where: { razorpayInvoiceId: invoice.id as string },
    data: { status: InvoiceStatus.FAILED },
  });
}

export async function handleSubscriptionHaltedOrPending(payload: WebhookPayload) {
  const entity = getEntity(payload, "subscription");
  const subId = entity?.id as string | undefined;
  const subscription = subId ? await findSubscriptionByRazorpayId(subId) : null;
  if (!subscription) return;

  const globalGraceDays = await getGlobalGraceDays();
  const graceEnd = new Date();
  graceEnd.setDate(graceEnd.getDate() + globalGraceDays);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.PAST_DUE,
      gracePeriodEndsAt: graceEnd,
      mandateStatus: MandateStatus.FAILED,
    },
  });
}
