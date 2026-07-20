import { NextResponse } from "next/server";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { getErrorMessage } from "@/lib/errors";
import { findSubscriptionByRestaurantId } from "@/lib/subscription";
import {
  persistPendingCheckoutUrl,
  findLocalPayableInvoiceUrl,
} from "@/modules/subscription-engine/services/checkout-url.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);

    const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
    if (!subscription?.pendingCheckout) {
      return NextResponse.json(
        { ok: false, error: "No pending checkout" },
        { status: 404 }
      );
    }

    if (!subscription.razorpaySubscriptionId) {
      return NextResponse.json(
        { ok: false, error: "Checkout not available" },
        { status: 404 }
      );
    }

    const localUrl = await findLocalPayableInvoiceUrl(subscription.id);
    if (localUrl) {
      return NextResponse.json({ ok: true, checkoutUrl: localUrl });
    }

    let checkoutUrl: string | null = null;
    try {
      checkoutUrl = await persistPendingCheckoutUrl(
        subscription.id,
        subscription.razorpaySubscriptionId,
        subscription.pendingCheckoutUrl,
        { refresh: true, retryInvoiceFetch: true }
      );
    } catch {
      // Rate-limited or Razorpay unavailable — fall back to stored URL.
    }

    const fallbackUrl =
      checkoutUrl ??
      subscription.pendingCheckoutUrl ??
      (await findLocalPayableInvoiceUrl(subscription.id));

    if (!fallbackUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Checkout URL not available. Try again in a minute or use the invoice link below.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, checkoutUrl: fallbackUrl });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 400 });
  }
}
