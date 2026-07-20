"use server";

import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/tenancy";
import { AppError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BillingCycle,
  PlanStatus,
} from "@prisma/client";
import {
  createPlanVersion,
  duplicatePlan,
  scheduleFuturePricing,
  extendSubscription,
  resumeSubscription,
  suspendSubscription,
  cancelSubscriptionRecord,
  changePlanImmediate,
  scheduleDowngrade,
  getLatestPlanVersion,
} from "@/lib/subscription";
import { initiateUpgradeCheckout, schedulePlanChange } from "@/modules/subscription-engine/services/upgrade-downgrade.service";
import {
  getDefaultTrialDays,
  getGlobalGraceDays,
} from "@/modules/subscription-engine/services/platform-settings.service";
import { syncInvoicesForSubscription } from "@/modules/subscription-engine/services/invoice-sync.service";
import { logBillingAction, getBillingAuditLogs } from "@/modules/subscription-engine/services/billing-audit.service";

async function revalidateSubscriptionViews(subscriptionId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { restaurantId: true },
  });

  revalidatePath("/platform/restaurants");
  if (sub) {
    revalidatePath(`/platform/restaurants/${sub.restaurantId}`);
  }
  revalidatePath("/platform/subscriptions");
  revalidatePath(`/platform/subscriptions/${subscriptionId}`);
}
import { syncRazorpayPlansForVersion } from "@/modules/subscription-engine/services/razorpay-plan-sync.service";

const planSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9_-]+$/),
  description: z.string().optional(),
  displayOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true),
  featureCodes: z.array(z.string()),
  trialDays: z.number().int().min(0).default(14),
  graceDays: z.number().int().min(0).default(7),
  billingPeriodDefault: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  priceMonthly: z.number().int().min(0),
  priceYearly: z.number().int().min(0),
  currency: z.string().default("INR"),
  taxRate: z.number().default(0),
  discountPercent: z.number().default(0),
});

export async function getAllPlansAdmin() {
  await requireSuperAdmin();
  return prisma.plan.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      versions: {
        where: { isLatest: true },
        include: {
          planFeatures: { include: { feature: true } },
          pricing: { orderBy: { effectiveFrom: "desc" }, take: 1 },
        },
      },
      _count: { select: { subscriptions: true } },
    },
  });
}

export async function getAllFeatures() {
  await requireSuperAdmin();
  return prisma.feature.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createPlan(input: unknown) {
  const session = await requireSuperAdmin();
  const data = planSchema.parse(input);

  const existing = await prisma.plan.findUnique({ where: { slug: data.slug } });
  if (existing) throw new AppError("Slug already exists", "CONFLICT", 409);

  const plan = await prisma.plan.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      displayOrder: data.displayOrder,
      sortOrder: data.displayOrder,
      isVisible: data.isVisible,
      priceMonthly: data.priceMonthly,
      priceYearly: data.priceYearly,
      features: data.featureCodes,
    },
  });

  await createPlanVersion({
    planId: plan.id,
    featureCodes: data.featureCodes,
    trialDays: data.trialDays,
    graceDays: data.graceDays,
    billingPeriodDefault: data.billingPeriodDefault as BillingCycle,
    createdById: session.user.id,
    pricing: {
      currency: data.currency,
      priceMonthly: data.priceMonthly,
      priceYearly: data.priceYearly,
      taxRate: data.taxRate,
      discountPercent: data.discountPercent,
    },
  });

  await logBillingAction({
    action: "PLAN_CREATED",
    entityType: "Plan",
    entityId: plan.id,
    actorUserId: session.user.id,
    metadata: { name: plan.name, slug: plan.slug },
  });

  revalidatePath("/platform/plans");
  return plan;
}

export async function updatePlanFeatures(input: {
  planId: string;
  featureCodes: string[];
  trialDays?: number;
  graceDays?: number;
  notes?: string;
}) {
  const session = await requireSuperAdmin();
  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new AppError("Plan not found", "NOT_FOUND", 404);

  await prisma.plan.update({
    where: { id: input.planId },
    data: { features: input.featureCodes },
  });

  await createPlanVersion({
    planId: input.planId,
    featureCodes: input.featureCodes,
    trialDays: input.trialDays ?? (await getDefaultTrialDays()),
    graceDays: input.graceDays ?? (await getGlobalGraceDays()),
    notes: input.notes ?? "Features updated by admin",
    createdById: session.user.id,
  });

  revalidatePath("/platform/plans");
  revalidatePath(`/platform/plans/${input.planId}`);
}

export async function updatePlanPricing(input: {
  planId: string;
  priceMonthly: number;
  priceYearly: number;
  currency?: string;
  taxRate?: number;
  discountPercent?: number;
  effectiveFrom?: string;
}) {
  await requireSuperAdmin();
  const latest = await getLatestPlanVersion(input.planId);
  if (!latest) throw new AppError("No plan version", "NOT_FOUND", 404);

  const enabledCodes = latest.planFeatures
    .filter((pf) => pf.enabled)
    .map((pf) => pf.feature.code);
  const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();

  if (effectiveFrom <= new Date()) {
    await createPlanVersion({
      planId: input.planId,
      featureCodes: enabledCodes,
      trialDays: await getDefaultTrialDays(),
      graceDays: await getGlobalGraceDays(),
      notes: "Pricing updated",
      pricing: {
        currency: input.currency ?? "INR",
        priceMonthly: input.priceMonthly,
        priceYearly: input.priceYearly,
        taxRate: input.taxRate,
        discountPercent: input.discountPercent,
        effectiveFrom,
      },
    });

    await prisma.plan.update({
      where: { id: input.planId },
      data: {
        priceMonthly: input.priceMonthly,
        priceYearly: input.priceYearly,
      },
    });
  } else {
    await scheduleFuturePricing(latest.id, {
      currency: input.currency,
      priceMonthly: input.priceMonthly,
      priceYearly: input.priceYearly,
      taxRate: input.taxRate,
      effectiveFrom,
      discountPercent: input.discountPercent,
    });
  }

  revalidatePath("/platform/plans");
}

export async function updatePlanMeta(input: {
  planId: string;
  name?: string;
  description?: string;
  displayOrder?: number;
  isVisible?: boolean;
  status?: PlanStatus;
}) {
  await requireSuperAdmin();
  return prisma.plan.update({
    where: { id: input.planId },
    data: {
      name: input.name,
      description: input.description,
      displayOrder: input.displayOrder,
      sortOrder: input.displayOrder,
      isVisible: input.isVisible,
      status: input.status,
      isActive: input.status !== "ARCHIVED",
    },
  });
}

export async function duplicatePlanAction(planId: string) {
  const session = await requireSuperAdmin();
  const plan = await duplicatePlan(planId, session.user.id);
  revalidatePath("/platform/plans");
  return plan;
}

export async function archivePlan(planId: string) {
  await requireSuperAdmin();
  await updatePlanMeta({ planId, status: "ARCHIVED", isVisible: false });
  revalidatePath("/platform/plans");
}

export async function disablePlan(planId: string) {
  await requireSuperAdmin();
  await updatePlanMeta({ planId, status: "DISABLED", isVisible: false });
  revalidatePath("/platform/plans");
}

export async function enablePlan(planId: string) {
  await requireSuperAdmin();
  await updatePlanMeta({ planId, status: "ACTIVE", isVisible: true });
  revalidatePath("/platform/plans");
}

export async function adminChangePlan(input: {
  subscriptionId: string;
  planId: string;
  billingCycle?: BillingCycle;
  immediate?: boolean;
}) {
  const session = await requireSuperAdmin();
  const sub = await prisma.subscription.findUnique({ where: { id: input.subscriptionId } });
  if (!sub) throw new AppError("Subscription not found", "NOT_FOUND", 404);

  if (input.immediate) {
    await changePlanImmediate(
      input.subscriptionId,
      input.planId,
      input.billingCycle ?? sub.billingCycle,
      session.user.id
    );
  } else {
    await scheduleDowngrade(input.subscriptionId, input.planId, session.user.id);
  }

  await revalidateSubscriptionViews(input.subscriptionId);
}

export async function adminInitiatePlanChange(input: {
  subscriptionId: string;
  planId: string;
  billingCycle?: BillingCycle;
  effective: "IMMEDIATE" | "NEXT_RENEWAL";
}) {
  const session = await requireSuperAdmin();
  const sub = await prisma.subscription.findUnique({ where: { id: input.subscriptionId } });
  if (!sub) throw new AppError("Subscription not found", "NOT_FOUND", 404);

  if (input.planId === sub.planId) {
    throw new AppError("Select a different plan", "VALIDATION", 400);
  }

  if (input.effective === "IMMEDIATE") {
    const owner = await prisma.staff.findFirst({
      where: { restaurantId: sub.restaurantId, role: "OWNER", isActive: true },
      select: { userId: true },
    });

    const result = await initiateUpgradeCheckout(
      input.subscriptionId,
      input.planId,
      input.billingCycle ?? sub.billingCycle,
      owner?.userId ?? session.user.id
    );

    await revalidateSubscriptionViews(input.subscriptionId);
    return result;
  }

  await schedulePlanChange(input.subscriptionId, input.planId, session.user.id);
  await revalidateSubscriptionViews(input.subscriptionId);
  return { scheduled: true as const };
}

export async function adminUpgradeSubscription(input: {
  subscriptionId: string;
  planId: string;
  billingCycle?: BillingCycle;
}) {
  await requireSuperAdmin();
  const sub = await prisma.subscription.findUnique({ where: { id: input.subscriptionId } });
  if (!sub) throw new AppError("Subscription not found", "NOT_FOUND", 404);

  const owner = await prisma.staff.findFirst({
    where: { restaurantId: sub.restaurantId, role: "OWNER", isActive: true },
    select: { userId: true },
  });

  const result = await initiateUpgradeCheckout(
    input.subscriptionId,
    input.planId,
    input.billingCycle ?? sub.billingCycle,
    owner?.userId ?? undefined
  );

  await revalidateSubscriptionViews(input.subscriptionId);
  return result;
}

export async function adminExtendSubscription(subscriptionId: string, days: number) {
  const session = await requireSuperAdmin();
  await extendSubscription(subscriptionId, days, session.user.id);
  await revalidateSubscriptionViews(subscriptionId);
}

export async function adminSuspendSubscription(subscriptionId: string) {
  await requireSuperAdmin();
  await suspendSubscription(subscriptionId);
  await revalidateSubscriptionViews(subscriptionId);
}

export async function adminResumeSubscription(subscriptionId: string) {
  const session = await requireSuperAdmin();
  await resumeSubscription(subscriptionId, session.user.id);
  await revalidateSubscriptionViews(subscriptionId);
}

export async function adminCancelSubscription(subscriptionId: string) {
  const session = await requireSuperAdmin();
  await cancelSubscriptionRecord(subscriptionId, { actorUserId: session.user.id });
  await revalidateSubscriptionViews(subscriptionId);
}

export async function syncSubscriptionInvoicesAction(subscriptionId: string) {
  await requireSuperAdmin();
  const synced = await syncInvoicesForSubscription(subscriptionId);
  await revalidateSubscriptionViews(subscriptionId);
  return synced;
}

export async function getSubscriptionDetail(subscriptionId: string) {
  await requireSuperAdmin();
  await syncInvoicesForSubscription(subscriptionId);
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      planVersion: { include: { planFeatures: { include: { feature: true } } } },
      scheduledPlan: true,
      restaurant: true,
      payments: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });

  const auditLogs = subscription
    ? await getBillingAuditLogs({
        restaurantId: subscription.restaurantId,
        limit: 30,
      })
    : [];

  return subscription ? { ...subscription, auditLogs } : null;
}

export async function resyncRazorpayPlansAction(versionId: string) {
  const session = await requireSuperAdmin();
  try {
    await syncRazorpayPlansForVersion(versionId, session.user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay sync failed";
    throw new AppError(message, "RAZORPAY_SYNC_FAILED", 502);
  }
  revalidatePath("/platform/plans");
  return { success: true };
}

export async function getPlanDetail(planId: string) {
  await requireSuperAdmin();
  return prisma.plan.findUnique({
    where: { id: planId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          planFeatures: { include: { feature: true } },
          pricing: { orderBy: { effectiveFrom: "desc" } },
        },
      },
    },
  });
}
