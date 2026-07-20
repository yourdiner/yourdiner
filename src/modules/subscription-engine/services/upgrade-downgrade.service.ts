import { prisma } from "@/lib/db";
import {
  BillingCycle,
  MandateStatus,
  PaymentStatus,
  ScheduledChangeType,
  SubscriptionStatus,
} from "@prisma/client";
import { logSubscriptionEvent } from "../repositories/subscription.repository";
import { getLatestPlanVersion } from "./plan-version.service";
import { getEffectivePriceForVersion, getPriceForCycle } from "./pricing.service";
import { subscribeRestaurant } from "./subscription.service";
import { getPaymentProvider } from "../providers/razorpay-payment-provider";
import {
  getRazorpayPlanIdForVersion,
  syncRazorpayPlansForVersion,
} from "./razorpay-plan-sync.service";
import { logBillingAction } from "./billing-audit.service";
import { recordPayment } from "./payment.service";
import { notifyRestaurantOwner } from "./notification.service";
import { persistPendingCheckoutUrl, resolveSubscriptionCheckoutUrl } from "./checkout-url.service";

function addPeriod(from: Date, cycle: BillingCycle): Date {
  const end = new Date(from);
  if (cycle === "YEARLY") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

function deriveBillingCycleFromPlanId(
  version: { razorpayPlanIdMonthly: string | null; razorpayPlanIdYearly: string | null },
  razorpayPlanId: string | null,
  fallback: BillingCycle
): BillingCycle {
  if (razorpayPlanId && razorpayPlanId === version.razorpayPlanIdYearly) {
    return "YEARLY";
  }
  if (razorpayPlanId && razorpayPlanId === version.razorpayPlanIdMonthly) {
    return "MONTHLY";
  }
  return fallback;
}

export async function cancelPreviousRazorpaySubscription(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { previousRazorpaySubscriptionId: true },
  });
  if (!subscription?.previousRazorpaySubscriptionId) return;

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) return;

  try {
    await provider.cancelSubscription(subscription.previousRazorpaySubscriptionId);
  } catch {
    // Previous subscription may already be cancelled in Razorpay.
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { previousRazorpaySubscriptionId: null },
  });
}

export async function finalizePlanUpgrade(
  subscriptionId: string,
  actorUserId?: string,
  paymentDate: Date = new Date()
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!subscription?.pendingUpgradePlanId) return null;

  const newPlanId = subscription.pendingUpgradePlanId;
  const latestVersion = await getLatestPlanVersion(newPlanId);
  if (!latestVersion) throw new Error("Target plan has no version");

  const pricing = await getEffectivePriceForVersion(latestVersion.id);
  if (!pricing) throw new Error("Target plan has no pricing");

  const billingCycle = deriveBillingCycleFromPlanId(
    latestVersion,
    subscription.razorpayPlanId,
    subscription.billingCycle
  );
  const newPlanPrice = getPriceForCycle(pricing, billingCycle);
  const periodEnd = addPeriod(paymentDate, billingCycle);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId: newPlanId,
      planVersionId: latestVersion.id,
      billingCycle,
      pricePaid: newPlanPrice,
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PAID,
      currentPeriodStart: paymentDate,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      nextPaymentAt: periodEnd,
      lastPaymentAt: paymentDate,
      gracePeriodEndsAt: null,
      scheduledPlanId: null,
      scheduledPlanVersionId: null,
      scheduledChangeAt: null,
      scheduledChangeType: null,
      pendingUpgradePlanId: null,
      pendingUpgradeAmount: null,
      pendingCheckoutUrl: null,
      pendingCheckout: false,
      mandateStatus: MandateStatus.ACTIVE,
      autoDebitEnabled: true,
    },
    include: { plan: true, planVersion: true },
  });

  await prisma.restaurant.update({
    where: { id: subscription.restaurantId },
    data: { status: "ACTIVE" },
  });

  await cancelPreviousRazorpaySubscription(subscriptionId);

  await logSubscriptionEvent(
    subscriptionId,
    "UPGRADED",
    { fromPlanId: subscription.planId, toPlanId: newPlanId },
    actorUserId
  );

  await logBillingAction({
    action: "UPGRADED",
    entityType: "Subscription",
    entityId: subscriptionId,
    restaurantId: subscription.restaurantId,
    actorUserId,
    metadata: { fromPlanId: subscription.planId, toPlanId: newPlanId },
  });

  return updated;
}

export async function initiateUpgradeCheckout(
  subscriptionId: string,
  newPlanId: string,
  billingCycle: BillingCycle,
  actorUserId?: string
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, planVersion: true },
  });
  if (!subscription) throw new Error("Subscription not found");

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    throw new Error("Payment gateway not configured");
  }

  if (subscription.pendingCheckout) {
    throw new Error("A checkout is already in progress. Complete or wait for it to expire.");
  }

  const claimed = await prisma.subscription.updateMany({
    where: { id: subscriptionId, pendingCheckout: false },
    data: { pendingCheckout: true },
  });
  if (claimed.count === 0) {
    throw new Error("A checkout is already in progress. Complete or wait for it to expire.");
  }

  const latestVersion = await getLatestPlanVersion(newPlanId);
  if (!latestVersion) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { pendingCheckout: false },
    });
    throw new Error("Target plan has no version");
  }

  const pricing = await getEffectivePriceForVersion(latestVersion.id);
  if (!pricing) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { pendingCheckout: false },
    });
    throw new Error("Target plan has no pricing");
  }

  const newPlanPrice = getPriceForCycle(pricing, billingCycle);

  try {
  if (
    !latestVersion.razorpayPlanIdMonthly &&
    !latestVersion.razorpayPlanIdYearly
  ) {
    await syncRazorpayPlansForVersion(latestVersion.id, actorUserId);
  }

  const refreshedVersion = await getLatestPlanVersion(newPlanId);
  if (!refreshedVersion) throw new Error("Target plan has no version");

  const razorpayPlanId = getRazorpayPlanIdForVersion(refreshedVersion, billingCycle);
  if (!razorpayPlanId) {
    throw new Error("Plan not synced with payment provider");
  }

  let customerId = subscription.razorpayCustomerId;
  if (!customerId) {
    if (!actorUserId) {
      throw new Error("Billing customer not configured");
    }
    const user = await prisma.user.findUnique({ where: { id: actorUserId } });
    if (!user) throw new Error("User not found");

    const staff = await prisma.staff.findFirst({
      where: { userId: actorUserId, restaurantId: subscription.restaurantId },
    });
    const branding = await prisma.restaurantBranding.findUnique({
      where: { restaurantId: subscription.restaurantId },
    });
    const contact = branding?.phone ?? staff?.mobile ?? undefined;
    const customer = await provider.createCustomer(user.name, user.email, contact);
    customerId = customer.id;
  }

  const targetPlan = await prisma.plan.findUnique({
    where: { id: newPlanId },
    select: { name: true },
  });

  const razorpaySub = await provider.createSubscription({
    planId: razorpayPlanId,
    customerId,
    totalCount: 120,
    notes: {
      restaurantId: subscription.restaurantId,
      type: "upgrade",
      targetPlanId: newPlanId,
      billingCycle,
    },
  });

  if (!razorpaySub.shortUrl) {
    throw new Error("Razorpay did not return a checkout URL");
  }

  const checkoutUrl =
    (await resolveSubscriptionCheckoutUrl({
      razorpaySubscriptionId: razorpaySub.id,
      subscriptionShortUrl: razorpaySub.shortUrl,
      subscriptionId,
      refresh: true,
      retryInvoiceFetch: true,
    })) ?? razorpaySub.shortUrl;

  const oldRazorpaySubId = subscription.razorpaySubscriptionId;

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      pendingUpgradePlanId: newPlanId,
      pendingUpgradeAmount: newPlanPrice,
      pendingCheckoutUrl: checkoutUrl,
      previousRazorpaySubscriptionId: oldRazorpaySubId ?? undefined,
      razorpayCustomerId: customerId,
      razorpayPlanId,
      razorpaySubscriptionId: razorpaySub.id,
      pendingCheckout: true,
    },
  });

  await logSubscriptionEvent(
    subscriptionId,
    "UPGRADED",
    {
      targetPlanId: newPlanId,
      chargeAmount: newPlanPrice,
      pending: true,
      razorpaySubscriptionId: razorpaySub.id,
      targetPlanName: targetPlan?.name,
    },
    actorUserId
  );

  await notifyRestaurantOwner({
    restaurantId: subscription.restaurantId,
    title: "Plan upgrade pending payment",
    body: `Complete payment to switch to ${targetPlan?.name ?? "the new plan"}. Your current plan stays active until payment succeeds.`,
    emailSubject: `Complete payment for ${targetPlan?.name ?? "plan upgrade"}`,
    emailHtml: `<p>Payment is required to upgrade to <strong>${targetPlan?.name ?? "your new plan"}</strong>. Use the billing page to complete checkout.</p>`,
  });

  return {
    requiresPayment: true,
    checkoutUrl,
    subscriptionId: razorpaySub.id,
    chargeAmount: newPlanPrice,
  };
  } catch (error) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        pendingCheckout: false,
        pendingCheckoutUrl: null,
        pendingUpgradePlanId: null,
        pendingUpgradeAmount: null,
      },
    });
    throw error;
  }
}

export async function applyUpgradeAfterPayment(
  subscriptionId: string,
  payment: {
    razorpayPaymentId: string;
    razorpayOrderId?: string;
    amount: number;
    paymentMethod?: string;
  }
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!subscription?.pendingUpgradePlanId) {
    throw new Error("No pending upgrade");
  }

  const paidAt = new Date();

  await recordPayment({
    subscriptionId,
    amount: payment.amount,
    razorpayPaymentId: payment.razorpayPaymentId,
    razorpayOrderId: payment.razorpayOrderId,
    paymentMethod: payment.paymentMethod,
    paidAt,
  });

  return finalizePlanUpgrade(subscriptionId, undefined, paidAt);
}

async function applyUpgrade(
  subscriptionId: string,
  newPlanId: string,
  billingCycle: BillingCycle,
  actorUserId?: string
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!subscription) throw new Error("Subscription not found");

  const latestVersion = await getLatestPlanVersion(newPlanId);
  if (!latestVersion) throw new Error("Target plan has no version");

  if (
    !latestVersion.razorpayPlanIdMonthly &&
    !latestVersion.razorpayPlanIdYearly
  ) {
    await syncRazorpayPlansForVersion(latestVersion.id, actorUserId);
  }

  const refreshedVersion = await getLatestPlanVersion(newPlanId);
  if (!refreshedVersion) throw new Error("Target plan has no version");

  const pricing = await getEffectivePriceForVersion(refreshedVersion.id);
  if (!pricing) throw new Error("Target plan has no pricing");

  const newPlanPrice = getPriceForCycle(pricing, billingCycle);
  const provider = getPaymentProvider();

  if (subscription.razorpaySubscriptionId && provider.isConfigured()) {
    await provider.cancelSubscription(subscription.razorpaySubscriptionId);
  }

  const razorpayPlanId = getRazorpayPlanIdForVersion(refreshedVersion, billingCycle);
  let newRazorpaySubId: string | null = null;

  if (razorpayPlanId && subscription.razorpayCustomerId && provider.isConfigured()) {
    const rzSub = await provider.createSubscription({
      planId: razorpayPlanId,
      customerId: subscription.razorpayCustomerId,
      totalCount: 120,
      notes: { restaurantId: subscription.restaurantId, type: "upgrade" },
    });
    newRazorpaySubId = rzSub.id;
  }

  const now = new Date();
  const periodEnd = addPeriod(now, billingCycle);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId: newPlanId,
      planVersionId: refreshedVersion.id,
      billingCycle,
      pricePaid: newPlanPrice,
      razorpayPlanId: razorpayPlanId,
      razorpaySubscriptionId: newRazorpaySubId ?? subscription.razorpaySubscriptionId,
      scheduledPlanId: null,
      scheduledPlanVersionId: null,
      scheduledChangeAt: null,
      scheduledChangeType: null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      nextPaymentAt: periodEnd,
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PAID,
      gracePeriodEndsAt: null,
      pendingUpgradePlanId: null,
      pendingUpgradeAmount: null,
      previousRazorpaySubscriptionId: null,
    },
    include: { plan: true, planVersion: true },
  });

  await logSubscriptionEvent(
    subscriptionId,
    "UPGRADED",
    { fromPlanId: subscription.planId, toPlanId: newPlanId },
    actorUserId
  );

  await logBillingAction({
    action: "UPGRADED",
    entityType: "Subscription",
    entityId: subscriptionId,
    restaurantId: subscription.restaurantId,
    actorUserId,
    metadata: { fromPlanId: subscription.planId, toPlanId: newPlanId },
  });

  return { subscription: updated };
}

export async function upgradeSubscription(
  subscriptionId: string,
  newPlanId: string,
  billingCycle: BillingCycle,
  actorUserId?: string
) {
  return applyUpgrade(subscriptionId, newPlanId, billingCycle, actorUserId);
}

export async function schedulePlanChange(
  subscriptionId: string,
  newPlanId: string,
  actorUserId?: string
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!subscription) throw new Error("Subscription not found");
  if (!subscription.currentPeriodEnd) {
    throw new Error("Subscription has no period end");
  }

  const latestVersion = await getLatestPlanVersion(newPlanId);
  if (!latestVersion) throw new Error("Target plan has no version");

  const [currentPlan, targetPlan] = await Promise.all([
    prisma.plan.findUnique({
      where: { id: subscription.planId },
      select: { displayOrder: true },
    }),
    prisma.plan.findUnique({
      where: { id: newPlanId },
      select: { name: true, displayOrder: true },
    }),
  ]);

  const isDowngrade =
    subscription.planId !== newPlanId &&
    (targetPlan?.displayOrder ?? 0) < (currentPlan?.displayOrder ?? 0);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      scheduledPlanId: newPlanId,
      scheduledPlanVersionId: latestVersion.id,
      scheduledChangeAt: subscription.currentPeriodEnd,
      scheduledChangeType: isDowngrade ? ScheduledChangeType.DOWNGRADE : ScheduledChangeType.PLAN_CHANGE,
    },
  });

  await logSubscriptionEvent(
    subscriptionId,
    "DOWNGRADE_SCHEDULED",
    {
      targetPlanId: newPlanId,
      targetPlanName: targetPlan?.name,
      effectiveAt: subscription.currentPeriodEnd.toISOString(),
      changeType: "NEXT_RENEWAL",
    },
    actorUserId
  );

  await logBillingAction({
    action: "DOWNGRADE_SCHEDULED",
    entityType: "Subscription",
    entityId: subscriptionId,
    restaurantId: subscription.restaurantId,
    actorUserId,
    metadata: { targetPlanId: newPlanId, effective: "NEXT_RENEWAL" },
  });

  return updated;
}

export async function scheduleDowngrade(
  subscriptionId: string,
  newPlanId: string,
  actorUserId?: string
) {
  return schedulePlanChange(subscriptionId, newPlanId, actorUserId);
}

export async function changePlanImmediate(
  subscriptionId: string,
  newPlanId: string,
  billingCycle: BillingCycle,
  actorUserId?: string
) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new Error("Subscription not found");

  await subscribeRestaurant({
    restaurantId: sub.restaurantId,
    planId: newPlanId,
    billingCycle,
    actorUserId,
  });

  await logSubscriptionEvent(
    subscriptionId,
    "PLAN_CHANGED",
    { newPlanId, billingCycle },
    actorUserId
  );
}
