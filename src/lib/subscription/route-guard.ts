import { AppError } from "@/lib/errors";

export function featureAccessDeniedResponse(feature: string) {
  return {
    ok: false as const,
    error: `Feature '${feature}' not available on your plan`,
    code: "FEATURE_NOT_AVAILABLE" as const,
    upgradeUrl: "/admin/subscription",
  };
}

export function subscriptionExpiredResponse() {
  return {
    ok: false as const,
    error: "Subscription expired",
    code: "SUBSCRIPTION_EXPIRED" as const,
    upgradeUrl: "/admin/subscription",
  };
}

export function subscriptionSuspendedResponse() {
  return {
    ok: false as const,
    error: "Your subscription has expired. Renew to continue.",
    code: "SUBSCRIPTION_SUSPENDED" as const,
    upgradeUrl: "/admin/subscription",
  };
}

export function mapSubscriptionError(error: unknown) {
  if (error instanceof AppError) {
    if (error.code === "FEATURE_NOT_AVAILABLE") {
      return { status: 403, body: featureAccessDeniedResponse(error.message) };
    }
    if (error.code === "SUBSCRIPTION_EXPIRED") {
      return { status: 403, body: subscriptionExpiredResponse() };
    }
    if (error.code === "SUBSCRIPTION_SUSPENDED") {
      return { status: 403, body: subscriptionSuspendedResponse() };
    }
  }
  return null;
}
