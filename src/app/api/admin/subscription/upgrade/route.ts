import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BillingCycle } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { getErrorMessage } from "@/lib/errors";
import { findSubscriptionByRestaurantId } from "@/lib/subscription";
import { initiateUpgradeCheckout } from "@/modules/subscription-engine/services/upgrade-downgrade.service";
import { getPublicRazorpayKeyId, isRazorpayConfigured } from "@/lib/payments/razorpay";

export const runtime = "nodejs";

const schema = z.object({
  planSlug: z.string().min(1),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
});

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireTenantContext();
    const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER"]);

    if (!isRazorpayConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Payment gateway is not configured. Contact support." },
        { status: 503 }
      );
    }

    const { planSlug, billingCycle } = schema.parse(await request.json());

    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) {
      return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 });
    }

    const subscription = await findSubscriptionByRestaurantId(tenant.restaurantId);
    if (!subscription) {
      return NextResponse.json({ ok: false, error: "No subscription found" }, { status: 404 });
    }

    if (subscription.planId === plan.id) {
      return NextResponse.json(
        { ok: false, error: "You are already on this plan" },
        { status: 400 }
      );
    }

    const result = await initiateUpgradeCheckout(
      subscription.id,
      plan.id,
      billingCycle as BillingCycle,
      staff.userId ?? undefined
    );

    return NextResponse.json({
      ok: true,
      razorpaySubscriptionId: result.subscriptionId,
      checkoutUrl: result.checkoutUrl,
      amount: result.chargeAmount,
      planName: plan.name,
      keyId: getPublicRazorpayKeyId(),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 400 });
  }
}
