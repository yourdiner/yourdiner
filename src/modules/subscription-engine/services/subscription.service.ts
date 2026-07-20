import { prisma } from "@/lib/db";
import {
  BillingCycle,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import {
  findSubscriptionByRestaurantId,
  logSubscriptionEvent,
} from "../repositories/subscription.repository";
import { getLatestPlanVersion } from "./plan-version.service";
import {
  getEffectivePriceForVersion,
  getPriceForCycle,
} from "./pricing.service";
import type { RenewInput, SubscribeInput } from "../types";

function addPeriod(from: Date, cycle: BillingCycle): Date {
  const end = new Date(from);
  if (cycle === "YEARLY") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export async function assignLatestVersionOnRenewal(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!subscription) throw new Error("Subscription not found");

  const latestVersion = await getLatestPlanVersion(subscription.planId);
  if (!latestVersion) throw new Error("No plan version found");

  const pricing = await getEffectivePriceForVersion(latestVersion.id);
  const pricePaid = pricing
    ? getPriceForCycle(pricing, subscription.billingCycle)
    : subscription.pricePaid;

  let planId = subscription.planId;
  let planVersionId = latestVersion.id;

  if (
    subscription.scheduledPlanId &&
    subscription.scheduledChangeAt &&
    subscription.scheduledChangeAt <= new Date()
  ) {
    planId = subscription.scheduledPlanId;
    planVersionId =
      subscription.scheduledPlanVersionId ??
      (await getLatestPlanVersion(planId))?.id ??
      planVersionId;
    await logSubscriptionEvent(subscriptionId, "DOWNGRADE_APPLIED", {
      fromPlanId: subscription.planId,
      toPlanId: planId,
    });
  }

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId,
      planVersionId,
      pricePaid,
      scheduledPlanId: null,
      scheduledPlanVersionId: null,
      scheduledChangeAt: null,
      scheduledChangeType: null,
    },
  });
}

export async function activateSubscription(input: RenewInput) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: input.subscriptionId },
    include: { planVersion: true },
  });
  if (!subscription) throw new Error("Subscription not found");

  const paymentDate = input.paymentDate ?? new Date();
  const periodEnd = addPeriod(paymentDate, subscription.billingCycle);

  await assignLatestVersionOnRenewal(subscription.id);

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PAID,
      currentPeriodStart: paymentDate,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      nextPaymentAt: periodEnd,
      lastPaymentAt: paymentDate,
      gracePeriodEndsAt: null,
      trialEndsAt: null,
      pendingCheckout: false,
      pendingCheckoutUrl: null,
    },
    include: { plan: true, planVersion: true },
  });

  await prisma.restaurant.update({
    where: { id: subscription.restaurantId },
    data: { status: "ACTIVE" },
  });

  await logSubscriptionEvent(
    subscription.id,
    "RENEWED",
    { paymentDate: paymentDate.toISOString() },
    input.actorUserId
  );

  return updated;
}

export async function subscribeRestaurant(input: SubscribeInput) {
  const latestVersion = await getLatestPlanVersion(input.planId);
  if (!latestVersion) throw new Error("Plan has no version");

  const pricing = await getEffectivePriceForVersion(latestVersion.id);
  if (!pricing) throw new Error("Plan has no pricing");

  const pricePaid = getPriceForCycle(pricing, input.billingCycle);
  const now = new Date();
  const periodEnd = addPeriod(now, input.billingCycle);

  const existing = await findSubscriptionByRestaurantId(input.restaurantId);

  if (existing) {
    return prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planId: input.planId,
        planVersionId: latestVersion.id,
        billingCycle: input.billingCycle,
        pricePaid,
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        renewalDate: periodEnd,
        nextPaymentAt: periodEnd,
        lastPaymentAt: now,
        gracePeriodEndsAt: null,
      },
    });
  }

  return prisma.subscription.create({
    data: {
      restaurantId: input.restaurantId,
      planId: input.planId,
      planVersionId: latestVersion.id,
      billingCycle: input.billingCycle,
      pricePaid,
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PAID,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      nextPaymentAt: periodEnd,
      lastPaymentAt: now,
    },
  });
}

import { getDefaultTrialDays } from "./platform-settings.service";

export async function startTrial(restaurantId: string, planId: string) {
  const latestVersion = await getLatestPlanVersion(planId);
  if (!latestVersion) throw new Error("Plan has no version");

  const trialDays = await getDefaultTrialDays();
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + trialDays);

  return prisma.subscription.upsert({
    where: { restaurantId },
    create: {
      restaurantId,
      planId,
      planVersionId: latestVersion.id,
      status: SubscriptionStatus.TRIAL,
      trialEndsAt: trialEnds,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnds,
      renewalDate: trialEnds,
    },
    update: {
      planId,
      planVersionId: latestVersion.id,
      status: SubscriptionStatus.TRIAL,
      trialEndsAt: trialEnds,
    },
  });
}

export async function expireSubscription(
  subscriptionId: string,
  graceDays: number
) {
  const graceEnd = new Date();
  graceEnd.setDate(graceEnd.getDate() + graceDays);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.EXPIRED,
      gracePeriodEndsAt: graceEnd,
    },
  });

  await logSubscriptionEvent(subscriptionId, "GRACE_STARTED", {
    gracePeriodEndsAt: graceEnd.toISOString(),
  });

  return updated;
}

export async function suspendSubscription(subscriptionId: string) {
  const sub = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.SUSPENDED,
      gracePeriodEndsAt: null,
    },
  });

  await prisma.restaurant.update({
    where: { id: sub.restaurantId },
    data: { status: "SUSPENDED" },
  });

  await logSubscriptionEvent(subscriptionId, "SUSPENDED", {});
  return sub;
}

export async function inactivateRestaurantForBilling(
  subscriptionId: string,
  reason: "TRIAL_EXPIRED" | "GRACE_EXPIRED"
) {
  const sub = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.SUSPENDED,
      gracePeriodEndsAt: null,
    },
  });

  await prisma.restaurant.update({
    where: { id: sub.restaurantId },
    data: { status: "INACTIVE" },
  });

  await logSubscriptionEvent(
    subscriptionId,
    reason === "TRIAL_EXPIRED" ? "TRIAL_ENDED" : "SUSPENDED",
    { reason }
  );

  return sub;
}

export async function resumeSubscription(subscriptionId: string, actorUserId?: string) {
  const sub = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: SubscriptionStatus.ACTIVE },
  });

  await prisma.restaurant.update({
    where: { id: sub.restaurantId },
    data: { status: "ACTIVE" },
  });

  await logSubscriptionEvent(subscriptionId, "RESUMED", {}, actorUserId);
  return sub;
}

export async function extendSubscription(
  subscriptionId: string,
  days: number,
  actorUserId?: string
) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new Error("Subscription not found");

  const base = sub.currentPeriodEnd ?? new Date();
  const newEnd = new Date(base);
  newEnd.setDate(newEnd.getDate() + days);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      currentPeriodEnd: newEnd,
      renewalDate: newEnd,
      nextPaymentAt: newEnd,
      status: SubscriptionStatus.ACTIVE,
      gracePeriodEndsAt: null,
    },
  });

  await prisma.restaurant.update({
    where: { id: sub.restaurantId },
    data: { status: "ACTIVE" },
  });

  await logSubscriptionEvent(
    subscriptionId,
    days > 0 ? "FREE_DAYS_ADDED" : "EXTENDED",
    { days },
    actorUserId
  );

  return updated;
}

export async function cancelSubscriptionRecord(
  subscriptionId: string,
  options?: { actorUserId?: string; reason?: string }
) {
  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledByUserId: options?.actorUserId ?? null,
      cancellationReason: options?.reason ?? null,
    },
  });

  await logSubscriptionEvent(subscriptionId, "CANCELLED", { reason: options?.reason }, options?.actorUserId);
  return updated;
}

export async function getVisiblePlans() {
  const plans = await prisma.plan.findMany({
    where: { status: "ACTIVE", isVisible: true },
    orderBy: { displayOrder: "asc" },
    include: {
      versions: {
        where: { isLatest: true },
        include: {
          planFeatures: {
            where: { enabled: true },
            include: { feature: true },
          },
          pricing: {
            where: {
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
            },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return plans.map((plan) => {
    const version = plan.versions[0];
    const pricingRow = version?.pricing[0];
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      status: plan.status,
      displayOrder: plan.displayOrder,
      isVisible: plan.isVisible,
      latestVersion: version
        ? {
            id: version.id,
            versionNumber: version.versionNumber,
            trialDays: version.trialDays,
            graceDays: version.graceDays,
            features: version.planFeatures.map((pf) => ({
              code: pf.feature.code,
              name: pf.feature.name,
              enabled: pf.enabled,
            })),
            pricing: pricingRow
              ? {
                  priceMonthly: pricingRow.priceMonthly,
                  priceYearly: pricingRow.priceYearly,
                  currency: pricingRow.currency,
                  taxRate: pricingRow.taxRate,
                  discountPercent: pricingRow.discountPercent,
                }
              : null,
          }
        : null,
    };
  });
}
