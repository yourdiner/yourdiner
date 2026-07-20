"use server";

import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { AppError } from "@/lib/errors";
import {
  verifyPaymentSignature,
  isRazorpayConfigured,
  getPublicRazorpayKeyId,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
} from "@/lib/payments/razorpay";
import { revalidatePath } from "next/cache";
import { BillingCycle, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";
import {
  getVisiblePlans,
  findSubscriptionByRestaurantId,
  getLatestPlanVersion,
  getEffectivePriceForVersion,
  getPriceForCycle,
  subscribeRestaurant,
  cancelSubscriptionRecord,
  logSubscriptionEvent,
  scheduleDowngrade,
  handlePaymentSuccess,
} from "@/lib/subscription";
import { requireWritableSubscription } from "@/lib/permissions";
import { syncInvoicesForSubscription } from "@/modules/subscription-engine/services/invoice-sync.service";
import { getPaymentProvider } from "@/modules/subscription-engine/providers/razorpay-payment-provider";
import {
  getRazorpayPlanIdForVersion,
  syncRazorpayPlansForVersion,
} from "@/modules/subscription-engine/services/razorpay-plan-sync.service";
import { initiateUpgradeCheckout } from "@/modules/subscription-engine/services/upgrade-downgrade.service";
import {
  applyLocalCheckoutUrlFromInvoices,
  findLocalPayableInvoiceUrl,
  persistPendingCheckoutUrl,
  resolveSubscriptionCheckoutUrl,
} from "@/modules/subscription-engine/services/checkout-url.service";
import { logBillingAction } from "@/modules/subscription-engine/services/billing-audit.service";
import { isBillingSkipPaymentEnabled } from "@/lib/production-env";

const subscribeSchema = z.object({
  planSlug: z.string().min(1),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
});

const billingSkipPayment = isBillingSkipPaymentEnabled();

async function resolveRenewalAmount(subscription: {
  planVersionId: string | null;
  planId: string;
  pricePaid: number | null;
  billingCycle: BillingCycle;
}): Promise<number> {
  const pricing = subscription.planVersionId
    ? await getEffectivePriceForVersion(subscription.planVersionId)
    : null;
  if (pricing) return getPriceForCycle(pricing, subscription.billingCycle);
  if (subscription.pricePaid) return subscription.pricePaid;
  const latest = await getLatestPlanVersion(subscription.planId);
  if (!latest) return 0;
  const fallbackPricing = await getEffectivePriceForVersion(latest.id);
  return fallbackPricing ? getPriceForCycle(fallbackPricing, subscription.billingCycle) : 0;
}

async function clearPendingCheckout(restaurantId: string) {
  await prisma.subscription.updateMany({
    where: { restaurantId, pendingCheckout: true },
    data: { pendingCheckout: false, pendingCheckoutUrl: null },
  });
}

export async function getPlans() {
  return getVisiblePlans();
}

const RECONCILE_COOLDOWN_MS = 30_000;
const lastReconcileAt = new Map<string, number>();

export async function getSubscription() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);

  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  if (!subscription) return null;

  // Webhook-independent fallback: finalize a pending upgrade/checkout if the
  // payment already succeeded on Razorpay but no webhook reached us (common in
  // local dev, or a missed webhook in production).
  if (subscription.pendingCheckout || subscription.pendingUpgradePlanId) {
    const now = Date.now();
    const lastReconcile = lastReconcileAt.get(subscription.id) ?? 0;
    if (now - lastReconcile >= RECONCILE_COOLDOWN_MS) {
      try {
        const { reconcilePendingCheckout } = await import(
          "@/modules/subscription-engine/services/billing-sync.service"
        );
        lastReconcileAt.set(subscription.id, now);
        const changed = await reconcilePendingCheckout(subscription.id);
        if (changed) {
          const refreshed = await findSubscriptionByRestaurantId(tenant.restaurantId);
          if (refreshed) return refreshed;
        }
      } catch {
        // best-effort reconciliation
      }
    }
  }

  const synced = await syncInvoicesForSubscription(subscription.id);
  const result = synced ?? subscription;

  if (result.pendingCheckout && result.razorpaySubscriptionId) {
    const checkoutUrl = await applyLocalCheckoutUrlFromInvoices(
      result.id,
      result.invoices ?? [],
      result.pendingCheckoutUrl
    );
    if (checkoutUrl && checkoutUrl !== result.pendingCheckoutUrl) {
      return { ...result, pendingCheckoutUrl: checkoutUrl };
    }
  }

  return result;
}

export async function subscribeToPlan(input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);
  const { planSlug, billingCycle } = subscribeSchema.parse(input);

  const plan = await prisma.plan.findUnique({
    where: { slug: planSlug, status: "ACTIVE" },
  });
  if (!plan) throw new AppError("Plan not found", "NOT_FOUND", 404);

  let latestVersion = await getLatestPlanVersion(plan.id);
  if (!latestVersion) throw new AppError("Plan not configured", "NOT_FOUND", 404);

  const pricing = await getEffectivePriceForVersion(latestVersion.id);
  if (!pricing) throw new AppError("Plan pricing not configured", "NOT_FOUND", 404);

  const pricePaid = getPriceForCycle(pricing, billingCycle as BillingCycle);

  if (!staff.userId) throw new AppError("User not found", "NOT_FOUND", 404);
  const user = await prisma.user.findUnique({ where: { id: staff.userId } });
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  const provider = getPaymentProvider();

  if (billingSkipPayment) {
    await subscribeRestaurant({
      restaurantId: tenant.restaurantId,
      planId: plan.id,
      billingCycle: billingCycle as BillingCycle,
      actorUserId: staff.userId,
    });

    const updated = await findSubscriptionByRestaurantId(tenant.restaurantId);
    if (updated) {
      await logSubscriptionEvent(updated.id, "CREATED", { planSlug, billingCycle }, staff.userId);
    }

    revalidatePath("/admin/subscription");
    revalidatePath("/dashboard/subscription");
    return { success: true, checkoutUrl: null, orderId: null };
  }

  if (!provider.isConfigured()) {
    throw new AppError("Payment gateway not configured", "PAYMENT_UNAVAILABLE", 503);
  }

  if (subscription?.pendingCheckout) {
    throw new AppError(
      "A checkout is already in progress. Complete or wait for it to expire.",
      "CHECKOUT_PENDING",
      409
    );
  }

  if (
    subscription?.razorpaySubscriptionId &&
    subscription.status === SubscriptionStatus.PAST_DUE &&
    subscription.pendingCheckout
  ) {
    throw new AppError("Subscription checkout already pending", "CHECKOUT_PENDING", 409);
  }

  let razorpayPlanId = getRazorpayPlanIdForVersion(latestVersion, billingCycle as BillingCycle);
  if (!razorpayPlanId) {
    await syncRazorpayPlansForVersion(latestVersion.id);
    latestVersion = await getLatestPlanVersion(plan.id);
    if (!latestVersion) throw new AppError("Plan not configured", "NOT_FOUND", 404);
    razorpayPlanId = getRazorpayPlanIdForVersion(latestVersion, billingCycle as BillingCycle);
  }

  if (!razorpayPlanId) {
    throw new AppError("Plan not synced with payment provider", "PLAN_NOT_SYNCED", 503);
  }

  if (subscription) {
    const claimed = await prisma.subscription.updateMany({
      where: { restaurantId: tenant.restaurantId, pendingCheckout: false },
      data: { pendingCheckout: true },
    });
    if (claimed.count === 0) {
      throw new AppError(
        "A checkout is already in progress. Complete or wait for it to expire.",
        "CHECKOUT_PENDING",
        409
      );
    }
  } else {
    try {
      await prisma.subscription.create({
        data: {
          restaurantId: tenant.restaurantId,
          planId: plan.id,
          planVersionId: latestVersion.id,
          billingCycle: billingCycle as BillingCycle,
          pricePaid,
          status: SubscriptionStatus.PAST_DUE,
          pendingCheckout: true,
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        throw new AppError(
          "A checkout is already in progress. Complete or wait for it to expire.",
          "CHECKOUT_PENDING",
          409
        );
      }
      throw error;
    }
  }

  try {
  let customerId = subscription?.razorpayCustomerId;
  if (!customerId) {
    const branding = await prisma.restaurantBranding.findUnique({
      where: { restaurantId: tenant.restaurantId },
    });
    const contact = branding?.phone ?? staff.mobile ?? undefined;
    const customer = await provider.createCustomer(user.name, user.email, contact);
    customerId = customer.id;
  }

  const razorpaySub = await provider.createSubscription({
    planId: razorpayPlanId,
    customerId,
    totalCount: 120,
    notes: { restaurantId: tenant.restaurantId, planSlug, billingCycle },
  });

  const checkoutUrl =
    (await resolveSubscriptionCheckoutUrl({
      razorpaySubscriptionId: razorpaySub.id,
      subscriptionShortUrl: razorpaySub.shortUrl,
      refresh: true,
      retryInvoiceFetch: true,
    })) ??
    razorpaySub.shortUrl ??
    null;

  await prisma.subscription.update({
    where: { restaurantId: tenant.restaurantId },
    data: {
      planId: plan.id,
      planVersionId: latestVersion.id,
      billingCycle: billingCycle as BillingCycle,
      pricePaid,
      razorpayCustomerId: customerId,
      razorpayPlanId,
      razorpaySubscriptionId: razorpaySub.id,
      status: SubscriptionStatus.PAST_DUE,
      pendingCheckout: true,
      pendingCheckoutUrl: checkoutUrl,
    },
  });

  await logBillingAction({
    action: "RESTAURANT_PURCHASED",
    entityType: "Subscription",
    restaurantId: tenant.restaurantId,
    actorUserId: staff.userId,
    metadata: { planSlug, billingCycle, razorpaySubscriptionId: razorpaySub.id },
  });

  revalidatePath("/admin/subscription");
  revalidatePath("/dashboard/subscription");
  return {
    success: true,
    checkoutUrl,
    subscriptionId: razorpaySub.id,
  };
  } catch (error) {
    if (subscription) {
      await clearPendingCheckout(tenant.restaurantId);
    } else {
      await prisma.subscription.deleteMany({
        where: {
          restaurantId: tenant.restaurantId,
          pendingCheckout: true,
          razorpaySubscriptionId: null,
        },
      });
    }
    throw error;
  }
}

export async function renewSubscription() {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);
  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  if (!subscription) throw new AppError("No subscription", "NOT_FOUND", 404);

  const amount = await resolveRenewalAmount(subscription);

  const provider = getPaymentProvider();

  if (billingSkipPayment) {
    const { handlePaymentSuccess } = await import("@/lib/subscription");
    await handlePaymentSuccess({
      subscriptionId: subscription.id,
      amount,
      paymentDate: new Date(),
    });
    revalidatePath("/admin/subscription");
    revalidatePath("/dashboard/subscription");
    return { success: true, devMode: true };
  }

  if (!provider.isConfigured()) {
    throw new AppError("Payment gateway not configured", "PAYMENT_UNAVAILABLE", 503);
  }

  const order = await provider.createOrder({
    amount,
    currency: "INR",
    receipt: `renew_${subscription.id.slice(-8)}_${Date.now()}`,
    notes: { restaurantId: tenant.restaurantId, type: "renewal" },
  });

  await logSubscriptionEvent(subscription.id, "RENEWED", { orderId: order.id }, staff.userId ?? undefined);
  revalidatePath("/admin/subscription");
  revalidatePath("/dashboard/subscription");

  return {
    success: true,
    orderId: order.id,
    amount,
    currency: "INR",
    keyId: getPublicRazorpayKeyId(),
  };
}

export async function verifyRenewalPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);

  if (
    !verifyPaymentSignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature
    )
  ) {
    throw new AppError("Invalid payment signature", "PAYMENT_INVALID", 400);
  }

  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  if (!subscription) throw new AppError("No subscription", "NOT_FOUND", 404);

  const expectedAmount = await resolveRenewalAmount(subscription);
  const [order, payment] = await Promise.all([
    fetchRazorpayOrder(input.razorpayOrderId),
    fetchRazorpayPayment(input.razorpayPaymentId),
  ]);

  const notes = order.notes ?? {};
  if (notes.restaurantId !== tenant.restaurantId || notes.type !== "renewal") {
    throw new AppError("Payment does not match this restaurant", "PAYMENT_INVALID", 400);
  }
  if (payment.order_id !== order.id) {
    throw new AppError("Payment does not match order", "PAYMENT_INVALID", 400);
  }
  if (payment.status !== "captured" && payment.status !== "authorized") {
    throw new AppError("Payment not captured", "PAYMENT_INVALID", 400);
  }
  if (order.amount !== expectedAmount || payment.amount !== expectedAmount) {
    throw new AppError("Payment amount mismatch", "PAYMENT_INVALID", 400);
  }

  const existingPayment = await prisma.subscriptionPayment.findFirst({
    where: { razorpayPaymentId: input.razorpayPaymentId },
  });

  if (!existingPayment) {
    await handlePaymentSuccess({
      subscriptionId: subscription.id,
      amount: expectedAmount,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpayOrderId: input.razorpayOrderId,
      paymentDate: new Date(),
    });
  }

  await syncInvoicesForSubscription(subscription.id);
  revalidatePath("/admin/subscription");
  revalidatePath("/dashboard/subscription");
  return {
    success: true,
    activated: true,
    message: "Payment received. Your subscription is now active.",
  };
}

export async function getPendingUpgradeCheckout() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);

  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  if (!subscription?.pendingCheckout) {
    throw new AppError("No pending checkout", "NOT_FOUND", 404);
  }

  if (!subscription.razorpaySubscriptionId) {
    throw new AppError("Checkout not available", "NOT_FOUND", 404);
  }

  const localUrl = await findLocalPayableInvoiceUrl(subscription.id);
  if (localUrl) {
    return { checkoutUrl: localUrl };
  }

  try {
    const checkoutUrl = await persistPendingCheckoutUrl(
      subscription.id,
      subscription.razorpaySubscriptionId,
      subscription.pendingCheckoutUrl,
      { refresh: true }
    );

    if (checkoutUrl) {
      return { checkoutUrl };
    }
  } catch {
    // fall through to stored URL
  }

  if (subscription.pendingCheckoutUrl) {
    return { checkoutUrl: subscription.pendingCheckoutUrl };
  }

  throw new AppError("Checkout URL not available. Contact support.", "NOT_FOUND", 404);
}

export async function cancelSubscription() {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);

  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  if (!subscription) throw new AppError("No subscription", "NOT_FOUND", 404);

  const provider = getPaymentProvider();
  if (subscription.razorpaySubscriptionId && provider.isConfigured()) {
    await provider.cancelSubscription(subscription.razorpaySubscriptionId);
  }

  await cancelSubscriptionRecord(subscription.id, { actorUserId: staff.userId ?? undefined });
  revalidatePath("/admin/subscription");
  revalidatePath("/dashboard/subscription");
  return subscription;
}

export async function upgradePlan(input: { planSlug: string; billingCycle?: BillingCycle }) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);
  await requireWritableSubscription(tenant.restaurantId);

  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  if (!subscription) throw new AppError("No subscription", "NOT_FOUND", 404);

  const plan = await prisma.plan.findUnique({ where: { slug: input.planSlug } });
  if (!plan) throw new AppError("Plan not found", "NOT_FOUND", 404);

  const result = await initiateUpgradeCheckout(
    subscription.id,
    plan.id,
    input.billingCycle ?? subscription.billingCycle,
    staff.userId ?? undefined
  );

  revalidatePath("/admin/subscription");
  revalidatePath("/dashboard/subscription");

  if (result.requiresPayment && result.checkoutUrl) {
    return {
      requiresPayment: true,
      checkoutUrl: result.checkoutUrl,
      subscriptionId: result.subscriptionId,
      chargeAmount: result.chargeAmount,
    };
  }

  throw new AppError("Failed to start Razorpay checkout", "PAYMENT_UNAVAILABLE", 503);
}

export async function downgradePlan(input: { planSlug: string }) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);

  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  if (!subscription) throw new AppError("No subscription", "NOT_FOUND", 404);

  const plan = await prisma.plan.findUnique({ where: { slug: input.planSlug } });
  if (!plan) throw new AppError("Plan not found", "NOT_FOUND", 404);

  await scheduleDowngrade(subscription.id, plan.id, staff.userId ?? undefined);
  revalidatePath("/admin/subscription");
  revalidatePath("/dashboard/subscription");
  return { success: true };
}

export async function getAllSubscriptions() {
  const { requireSuperAdmin } = await import("@/lib/tenancy");
  await requireSuperAdmin();

  return prisma.subscription.findMany({
    where: { restaurant: { status: { not: "DELETED" } } },
    include: {
      plan: true,
      planVersion: true,
      restaurant: { select: { id: true, name: true, subdomain: true, status: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
      events: { orderBy: { createdAt: "desc" }, take: 10 },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProrationPreview(planSlug: string) {
  const tenant = await requireTenantContext();
  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  if (!subscription) return null;

  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) return null;

  const version = await getLatestPlanVersion(plan.id);
  if (!version) return null;

  const pricing = await getEffectivePriceForVersion(version.id);
  if (!pricing) return null;

  const newPrice = getPriceForCycle(pricing, subscription.billingCycle);
  return {
    chargeAmount: newPrice,
    fullPlanPrice: true,
    message: "Full plan price due on payment. New billing cycle starts when payment succeeds.",
  };
}

export async function getInvoices() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);

  const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
  if (!subscription) return [];

  return prisma.invoice.findMany({
    where: { subscriptionId: subscription.id },
    orderBy: { createdAt: "desc" },
  });
}
