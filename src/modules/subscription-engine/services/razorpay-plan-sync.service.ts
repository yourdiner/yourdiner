import { prisma } from "@/lib/db";
import type { RazorpaySyncStatus } from "@prisma/client";
import { getPaymentProvider } from "../providers/razorpay-payment-provider";
import { logBillingAction } from "./billing-audit.service";

const SYNC_STATUS = {
  PENDING: "PENDING",
  SYNCED: "SYNCED",
  FAILED: "FAILED",
} as const satisfies Record<string, RazorpaySyncStatus>;

async function persistPlanIds(
  versionId: string,
  planId: string,
  data: {
    razorpayPlanIdMonthly?: string | null;
    razorpayPlanIdYearly?: string | null;
    razorpaySyncStatus: RazorpaySyncStatus;
    razorpaySyncError?: string | null;
    markSynced?: boolean;
  }
) {
  await prisma.planVersion.update({
    where: { id: versionId },
    data: {
      razorpayPlanIdMonthly: data.razorpayPlanIdMonthly,
      razorpayPlanIdYearly: data.razorpayPlanIdYearly,
      razorpaySyncStatus: data.razorpaySyncStatus,
      razorpaySyncError: data.razorpaySyncError ?? null,
      ...(data.markSynced ? { razorpaySyncedAt: new Date() } : {}),
    },
  });

  const version = await prisma.planVersion.findUnique({ where: { id: versionId } });
  if (!version) return;

  await prisma.plan.update({
    where: { id: planId },
    data: {
      ...(data.razorpayPlanIdMonthly
        ? { razorpayPlanIdMonthly: data.razorpayPlanIdMonthly }
        : {}),
      ...(data.razorpayPlanIdYearly
        ? { razorpayPlanIdYearly: data.razorpayPlanIdYearly }
        : {}),
    },
  });
}

export async function syncRazorpayPlansForVersion(
  versionId: string,
  actorUserId?: string
) {
  const version = await prisma.planVersion.findUnique({
    where: { id: versionId },
    include: {
      plan: true,
      pricing: { orderBy: { effectiveFrom: "desc" }, take: 1 },
    },
  });

  if (!version) throw new Error("Plan version not found");
  const pricing = version.pricing[0];
  if (!pricing) throw new Error("Plan version has no pricing");

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    throw new Error(
      "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file, then restart the dev server."
    );
  }

  let monthlyId = version.razorpayPlanIdMonthly;
  let yearlyId = version.razorpayPlanIdYearly;

  try {
    if (!monthlyId) {
      const monthlyPlan = await provider.createPlan({
        amount: pricing.priceMonthly,
        period: "monthly",
        name: `${version.plan.name} v${version.versionNumber} Monthly`,
        currency: pricing.currency,
      });
      monthlyId = monthlyPlan.id;

      await persistPlanIds(versionId, version.planId, {
        razorpayPlanIdMonthly: monthlyId,
        razorpayPlanIdYearly: yearlyId,
        razorpaySyncStatus: SYNC_STATUS.PENDING,
        razorpaySyncError: "Monthly synced; yearly pending",
      });
    }

    if (!yearlyId) {
      if (!pricing.priceYearly || pricing.priceYearly < 100) {
        throw new Error(
          `Yearly price is missing or too low (${pricing.priceYearly} paise). Set a yearly price of at least ₹1.00 in Plan pricing.`
        );
      }

      const yearlyPlan = await provider.createPlan({
        amount: pricing.priceYearly,
        period: "yearly",
        name: `${version.plan.name} v${version.versionNumber} Yearly`,
        currency: pricing.currency,
      });
      yearlyId = yearlyPlan.id;
    }

    const updated = await prisma.planVersion.update({
      where: { id: versionId },
      data: {
        razorpayPlanIdMonthly: monthlyId,
        razorpayPlanIdYearly: yearlyId,
        razorpaySyncStatus: SYNC_STATUS.SYNCED,
        razorpaySyncedAt: new Date(),
        razorpaySyncError: null,
      },
    });

    await prisma.plan.update({
      where: { id: version.planId },
      data: {
        razorpayPlanIdMonthly: monthlyId,
        razorpayPlanIdYearly: yearlyId,
      },
    });

    await logBillingAction({
      action: "RAZORPAY_PLAN_CREATED",
      entityType: "PlanVersion",
      entityId: versionId,
      actorUserId,
      metadata: {
        planId: version.planId,
        monthlyPlanId: monthlyId,
        yearlyPlanId: yearlyId,
        versionNumber: version.versionNumber,
      },
    });

    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await persistPlanIds(versionId, version.planId, {
      razorpayPlanIdMonthly: monthlyId,
      razorpayPlanIdYearly: yearlyId,
      razorpaySyncStatus: monthlyId && !yearlyId ? SYNC_STATUS.PENDING : SYNC_STATUS.FAILED,
      razorpaySyncError: monthlyId && !yearlyId
        ? `Monthly synced (${monthlyId}). Yearly failed: ${message}`
        : message,
    });

    if (monthlyId && !yearlyId) {
      throw new Error(`Monthly plan synced, but yearly plan failed: ${message}`);
    }
    throw error;
  }
}

export function getRazorpayPlanIdForVersion(
  version: { razorpayPlanIdMonthly: string | null; razorpayPlanIdYearly: string | null },
  billingCycle: "MONTHLY" | "YEARLY"
): string | null {
  return billingCycle === "YEARLY"
    ? version.razorpayPlanIdYearly
    : version.razorpayPlanIdMonthly;
}
