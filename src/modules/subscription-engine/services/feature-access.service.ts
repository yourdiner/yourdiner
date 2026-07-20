import { cache } from "react";
import { AppError } from "@/lib/errors";
import {
  findSubscriptionForFeatureAccess,
  type SubscriptionForFeatureAccess,
} from "../repositories/subscription.repository";
import {
  buildSubscriptionState,
  isSubscriptionActive,
} from "./lifecycle.service";

export function getEnabledFeatureCodes(
  subscription: SubscriptionForFeatureAccess
): Set<string> {
  const codes = new Set<string>();

  if (subscription.planVersion) {
    for (const pf of subscription.planVersion.planFeatures) {
      if (pf.enabled && pf.feature.isActive) {
        codes.add(pf.feature.code);
      }
    }
  }

  const planFeatures = subscription.plan.features;
  if (Array.isArray(planFeatures)) {
    for (const code of planFeatures) {
      if (typeof code === "string" && code.trim()) {
        codes.add(code);
      }
    }
  }

  return codes;
}

export const getEffectiveFeatures = cache(async function getEffectiveFeatures(
  restaurantId: string
): Promise<{ codes: Set<string>; state: ReturnType<typeof buildSubscriptionState> }> {
  const { getRestaurantStatusCached } = await import("@/lib/request-cache");
  const [subscription, restaurant] = await Promise.all([
    findSubscriptionForFeatureAccess(restaurantId),
    getRestaurantStatusCached(restaurantId),
  ]);

  if (!subscription) {
    return {
      codes: new Set(),
      state: buildSubscriptionState({
        status: "EXPIRED" as const,
        paymentStatus: "PENDING" as const,
        gracePeriodEndsAt: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        planSlug: "starter",
        planName: "Starter",
        planVersionNumber: null,
        billingCycle: "MONTHLY",
        pricePaid: 0,
        restaurantStatus: restaurant?.status,
      }),
    };
  }

  const state = buildSubscriptionState({
    status: subscription.status,
    paymentStatus: subscription.paymentStatus,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    planSlug: subscription.plan.slug,
    planName: subscription.plan.name,
    planVersionNumber: subscription.planVersion?.versionNumber ?? null,
    billingCycle: subscription.billingCycle,
    pricePaid: subscription.pricePaid,
    restaurantStatus: restaurant?.status,
  });

  const active = isSubscriptionActive(
    subscription.status,
    subscription.gracePeriodEndsAt,
    subscription.trialEndsAt
  );

  const codes = active ? getEnabledFeatureCodes(subscription) : new Set<string>();
  return { codes, state };
});

export async function requireFeature(
  restaurantId: string,
  featureCode: string
): Promise<void> {
  const { codes, state } = await getEffectiveFeatures(restaurantId);

  if (state.isReadOnly) {
    throw new AppError(
      "Your subscription has expired. Renew to continue.",
      "SUBSCRIPTION_SUSPENDED",
      403
    );
  }

  if (!state.isActive) {
    throw new AppError("Subscription expired", "SUBSCRIPTION_EXPIRED", 403);
  }

  if (!codes.has(featureCode)) {
    throw new AppError(
      `Feature '${featureCode}' is not available on your plan`,
      "FEATURE_NOT_AVAILABLE",
      403
    );
  }
}

export async function hasFeature(
  restaurantId: string,
  featureCode: string
): Promise<boolean> {
  try {
    await requireFeature(restaurantId, featureCode);
    return true;
  } catch {
    return false;
  }
}
