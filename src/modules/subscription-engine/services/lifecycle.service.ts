import { SubscriptionStatus, type RestaurantStatus } from "@prisma/client";
import type { SubscriptionBanner, SubscriptionState } from "../types";

export function isSubscriptionActive(
  status: SubscriptionStatus,
  gracePeriodEndsAt: Date | null,
  trialEndsAt: Date | null
): boolean {
  const now = new Date();
  if (status === SubscriptionStatus.ACTIVE) return true;
  if (status === SubscriptionStatus.TRIAL) {
    return !trialEndsAt || trialEndsAt > now;
  }
  if (
    status === SubscriptionStatus.PAST_DUE ||
    status === SubscriptionStatus.EXPIRED
  ) {
    return !!gracePeriodEndsAt && gracePeriodEndsAt > now;
  }
  return false;
}

export function isGracePeriod(
  status: SubscriptionStatus,
  gracePeriodEndsAt: Date | null
): boolean {
  const now = new Date();
  return (
    (status === SubscriptionStatus.EXPIRED ||
      status === SubscriptionStatus.PAST_DUE) &&
    !!gracePeriodEndsAt &&
    gracePeriodEndsAt > now
  );
}

export function getGraceDaysLeft(gracePeriodEndsAt: Date | null): number | null {
  if (!gracePeriodEndsAt) return null;
  const now = new Date();
  if (gracePeriodEndsAt <= now) return 0;
  return Math.ceil(
    (gracePeriodEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
}

export function buildGraceBanner(
  gracePeriodEndsAt: Date,
  currentPeriodEnd: Date | null
): SubscriptionBanner {
  const daysRemaining = getGraceDaysLeft(gracePeriodEndsAt) ?? 0;
  const expiredOn = currentPeriodEnd ?? gracePeriodEndsAt;
  const formatted = expiredOn.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dayLabel = daysRemaining === 1 ? "1 day" : `${daysRemaining} days`;
  return {
    message: `Your subscription expired on ${formatted}. Your restaurant will stop working in ${dayLabel}. Renew now to continue uninterrupted.`,
    daysRemaining,
    expiredOn,
    variant: daysRemaining <= 2 ? "destructive" : "warning",
  };
}

export function buildSubscriptionState(input: {
  status: SubscriptionStatus;
  paymentStatus: import("@prisma/client").PaymentStatus;
  gracePeriodEndsAt: Date | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  planSlug: string;
  planName: string;
  planVersionNumber: number | null;
  billingCycle: import("@prisma/client").BillingCycle;
  pricePaid: number;
  restaurantStatus?: RestaurantStatus;
}): SubscriptionState {
  const now = new Date();
  const active = isSubscriptionActive(
    input.status,
    input.gracePeriodEndsAt,
    input.trialEndsAt
  );
  const grace = isGracePeriod(input.status, input.gracePeriodEndsAt);
  const trialExpired =
    input.status === SubscriptionStatus.TRIAL &&
    !!input.trialEndsAt &&
    input.trialEndsAt <= now;
  const restaurantInactive =
    input.restaurantStatus === "INACTIVE" ||
    input.restaurantStatus === "SUSPENDED" ||
    input.restaurantStatus === "DELETED";
  const suspended =
    input.status === SubscriptionStatus.SUSPENDED ||
    restaurantInactive ||
    trialExpired;
  const graceDaysLeft = grace ? getGraceDaysLeft(input.gracePeriodEndsAt) : null;

  let banner: SubscriptionBanner | null = null;
  if (grace && input.gracePeriodEndsAt) {
    banner = buildGraceBanner(input.gracePeriodEndsAt, input.currentPeriodEnd);
  } else if (
    input.status === SubscriptionStatus.TRIAL &&
    input.trialEndsAt &&
    input.trialEndsAt > now
  ) {
    const daysLeft = Math.ceil(
      (input.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    if (daysLeft <= 3) {
      banner = {
        message: `Your trial ends in ${daysLeft === 1 ? "1 day" : `${daysLeft} days`}. Purchase a plan to keep your restaurant running.`,
        daysRemaining: daysLeft,
        expiredOn: input.trialEndsAt,
        variant: daysLeft <= 1 ? "destructive" : "warning",
      };
    }
  } else if (trialExpired) {
    banner = {
      message:
        "Your trial has ended. Purchase a plan to restore access to your restaurant.",
      daysRemaining: 0,
      expiredOn: input.trialEndsAt ?? now,
      variant: "destructive",
    };
  } else if (suspended) {
    const message =
      input.restaurantStatus === "DELETED"
        ? "This restaurant is no longer active."
        : input.restaurantStatus === "SUSPENDED"
          ? "This restaurant has been suspended."
          : "Your restaurant is inactive. Purchase or renew a plan to restore access.";
    banner = {
      message,
      daysRemaining: 0,
      expiredOn: input.trialEndsAt ?? input.currentPeriodEnd ?? now,
      variant: "destructive",
    };
  }

  return {
    status: input.status,
    paymentStatus: input.paymentStatus,
    isActive: active && !restaurantInactive && !trialExpired,
    isGracePeriod: grace,
    isSuspended: suspended,
    isReadOnly: suspended,
    graceDaysLeft,
    gracePeriodEndsAt: input.gracePeriodEndsAt,
    currentPeriodEnd: input.currentPeriodEnd,
    trialEndsAt: input.trialEndsAt,
    planSlug: input.planSlug,
    planName: input.planName,
    planVersionNumber: input.planVersionNumber,
    billingCycle: input.billingCycle,
    pricePaid: input.pricePaid,
    banner,
  };
}
