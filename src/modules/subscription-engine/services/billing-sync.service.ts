import { prisma } from "@/lib/db";
import { MandateStatus, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { getPaymentProvider } from "../providers/razorpay-payment-provider";
import { syncInvoicesForSubscription } from "./invoice-sync.service";
import { assignLatestVersionOnRenewal, activateSubscription } from "./subscription.service";
import { handlePaymentSuccess } from "./payment.service";
import { logBillingAction } from "./billing-audit.service";
import { findSubscriptionByRazorpayId } from "../repositories/subscription.repository";

function mapRazorpayMandateStatus(status: string): MandateStatus {
  switch (status) {
    case "active":
    case "authenticated":
      return MandateStatus.ACTIVE;
    case "pending":
      return MandateStatus.PENDING;
    case "paused":
      return MandateStatus.PAUSED;
    case "halted":
      return MandateStatus.FAILED;
    default:
      return MandateStatus.NONE;
  }
}

function mapRazorpaySubscriptionStatus(status: string): SubscriptionStatus | null {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "authenticated":
    case "created":
      return SubscriptionStatus.PAST_DUE;
    case "halted":
    case "pending":
      return SubscriptionStatus.PAST_DUE;
    case "cancelled":
      return SubscriptionStatus.CANCELLED;
    case "completed":
      return SubscriptionStatus.EXPIRED;
    default:
      return null;
  }
}

export async function syncSubscriptionFromRazorpay(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!subscription?.razorpaySubscriptionId) return false;

  if (subscription.pendingUpgradePlanId) {
    await syncInvoicesForSubscription(subscriptionId);
    return true;
  }

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) return false;

  const rzSub = await provider.fetchSubscription(subscription.razorpaySubscriptionId);
  if (!rzSub) return false;

  const mappedStatus = mapRazorpaySubscriptionStatus(rzSub.status);
  const periodEnd = rzSub.current_end
    ? new Date(rzSub.current_end * 1000)
    : subscription.currentPeriodEnd;
  const periodStart = rzSub.current_start
    ? new Date(rzSub.current_start * 1000)
    : subscription.currentPeriodStart;

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      ...(mappedStatus ? { status: mappedStatus } : {}),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      nextPaymentAt: periodEnd,
      mandateStatus: mapRazorpayMandateStatus(rzSub.status),
      autoDebitEnabled: ["active", "authenticated"].includes(rzSub.status),
    },
  });

  await syncInvoicesForSubscription(subscriptionId);
  return true;
}

export async function applyScheduledChangesFallback() {
  const now = new Date();
  const due = await prisma.subscription.findMany({
    where: {
      scheduledChangeAt: { lte: now },
      scheduledPlanId: { not: null },
    },
  });

  for (const sub of due) {
    await assignLatestVersionOnRenewal(sub.id);
  }

  return due.length;
}

/**
 * Reconciles a single subscription against the live Razorpay state. Used as a
 * webhook-independent fallback (e.g. local dev where webhooks can't reach the
 * server, or if a webhook was missed) so a captured payment still finalizes
 * the pending upgrade / activation. Returns true if it changed anything.
 */
export async function reconcilePendingCheckout(subscriptionId: string): Promise<boolean> {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) return false;

  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub?.razorpaySubscriptionId) return false;
  if (!sub.pendingCheckout && !sub.pendingUpgradePlanId) return false;

  const rzSub = await provider.fetchSubscription(sub.razorpaySubscriptionId);
  if (!rzSub) return false;

  // "active" means the first charge succeeded and the mandate is live.
  if (rzSub.status !== "active") return false;

  if (sub.pendingUpgradePlanId) {
    const { finalizePlanUpgrade } = await import("./upgrade-downgrade.service");
    await finalizePlanUpgrade(sub.id);
  } else {
    await activateSubscription({ subscriptionId: sub.id });
  }
  await syncInvoicesForSubscription(sub.id);
  return true;
}

export async function reconcileMissedPayments() {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) return 0;

  const pending = await prisma.subscription.findMany({
    where: {
      razorpaySubscriptionId: { not: null },
      OR: [
        { status: SubscriptionStatus.PAST_DUE },
        { paymentStatus: PaymentStatus.PENDING, pendingCheckout: true },
      ],
    },
  });

  let recovered = 0;
  for (const sub of pending) {
    if (!sub.razorpaySubscriptionId) continue;
    const rzSub = await provider.fetchSubscription(sub.razorpaySubscriptionId);
    if (rzSub?.status === "active") {
      if (sub.pendingUpgradePlanId) {
        const { finalizePlanUpgrade } = await import("./upgrade-downgrade.service");
        await finalizePlanUpgrade(sub.id);
      } else {
        await activateSubscription({ subscriptionId: sub.id });
      }
      await syncInvoicesForSubscription(sub.id);
      recovered++;
    }
  }
  return recovered;
}

export async function runBillingSync() {
  const subscriptions = await prisma.subscription.findMany({
    where: { razorpaySubscriptionId: { not: null } },
    select: { id: true },
  });

  let synced = 0;
  for (const { id } of subscriptions) {
    try {
      const ok = await syncSubscriptionFromRazorpay(id);
      if (ok) synced++;
    } catch (error) {
      console.error(`Billing sync failed for ${id}:`, error);
    }
  }

  const scheduledApplied = await applyScheduledChangesFallback();
  const recovered = await reconcileMissedPayments();

  await logBillingAction({
    action: "SYNC_COMPLETED",
    entityType: "System",
    metadata: { synced, scheduledApplied, recovered, total: subscriptions.length },
  });

  return { synced, scheduledApplied, recovered, total: subscriptions.length };
}
