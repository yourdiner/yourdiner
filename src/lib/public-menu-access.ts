import { SubscriptionStatus } from "@prisma/client";

type SubscriptionForMenuAccess = {
  status: SubscriptionStatus;
  plan: { features: unknown };
  planVersion?: {
    planFeatures: Array<{
      enabled: boolean;
      feature: { code: string; isActive: boolean };
    }>;
  } | null;
};

function planIncludesQrMenu(subscription: SubscriptionForMenuAccess): boolean {
  const legacy = subscription.plan.features;
  if (Array.isArray(legacy) && legacy.some((f) => f === "qr_menu")) {
    return true;
  }

  if (subscription.planVersion) {
    return subscription.planVersion.planFeatures.some(
      (pf) => pf.enabled && pf.feature.isActive && pf.feature.code === "qr_menu"
    );
  }

  return false;
}

/**
 * Whether the public browse-only menu should be shown to customers.
 * Gated on restaurant + plan feature (qr_menu), not full subscription billing
 * state — PAST_DUE / pending upgrade must not hide the menu when the plan
 * includes it. Hard blocks: restaurant not ACTIVE, subscription suspended/cancelled.
 */
export function canShowPublicMenu(restaurant: {
  status: string;
  subscription: SubscriptionForMenuAccess | null;
}): boolean {
  if (restaurant.status !== "ACTIVE") return false;
  if (!restaurant.subscription) return false;

  const { subscription } = restaurant;
  if (
    subscription.status === SubscriptionStatus.SUSPENDED ||
    subscription.status === SubscriptionStatus.CANCELLED
  ) {
    return false;
  }

  return planIncludesQrMenu(subscription);
}
