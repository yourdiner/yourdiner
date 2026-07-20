import { SubscriptionStatus } from "@prisma/client";

/** Pure subscription check — safe to import from edge-compatible modules. */
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

export function isSubscriptionSuspended(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.SUSPENDED;
}
