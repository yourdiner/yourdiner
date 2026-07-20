import { NextResponse } from "next/server";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { getErrorMessage } from "@/lib/errors";
import { findSubscriptionByRestaurantId } from "@/lib/subscription";
import { isSubscriptionActive } from "@/modules/subscription-engine/services/lifecycle.service";
import { reconcilePendingCheckout } from "@/modules/subscription-engine/services/billing-sync.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);

    let sub = await findSubscriptionByRestaurantId(tenant.restaurantId);
    if (!sub) {
      return NextResponse.json({ ok: false, error: "No subscription found" }, { status: 404 });
    }

    // Webhook-independent fallback: if a checkout/upgrade is pending, verify the
    // live Razorpay state and finalize immediately (covers local dev where
    // webhooks can't reach the server, or a missed/late webhook in production).
    if (sub.pendingCheckout || sub.pendingUpgradePlanId) {
      try {
        const changed = await reconcilePendingCheckout(sub.id);
        if (changed) {
          sub = (await findSubscriptionByRestaurantId(tenant.restaurantId)) ?? sub;
        }
      } catch {
        // Reconcile is best-effort; fall through to returning current state.
      }
    }

    return NextResponse.json({
      ok: true,
      status: sub.status,
      active: isSubscriptionActive(sub.status, sub.gracePeriodEndsAt, sub.trialEndsAt),
      pendingCheckout: sub.pendingCheckout,
      pendingUpgradePlanId: sub.pendingUpgradePlanId,
      planSlug: sub.plan.slug,
      planName: sub.plan.name,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 400 });
  }
}
