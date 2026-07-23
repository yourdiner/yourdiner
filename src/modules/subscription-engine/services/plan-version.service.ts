import { prisma } from "@/lib/db";
import type { BillingCycle } from "@prisma/client";
import type { CreatePlanVersionInput } from "../types";
import { syncRazorpayPlansForVersion } from "./razorpay-plan-sync.service";
import { logBillingAction } from "./billing-audit.service";

export async function getLatestPlanVersion(planId: string) {
  return prisma.planVersion.findFirst({
    where: { planId, isLatest: true },
    include: {
      planFeatures: { include: { feature: true } },
      pricing: { orderBy: { effectiveFrom: "desc" } },
    },
  });
}

export async function createPlanVersion(input: CreatePlanVersionInput) {
  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new Error("Plan not found");

  const latest = await prisma.planVersion.findFirst({
    where: { planId: input.planId },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;

  const features = await prisma.feature.findMany({
    where: { code: { in: input.featureCodes }, isActive: true },
  });

  // Neon free-tier latency can exceed Prisma's default 5s interactive tx timeout
  // when attaching many PlanFeature rows one-by-one (seed / plan edits).
  return prisma.$transaction(
    async (tx) => {
      await tx.planVersion.updateMany({
        where: { planId: input.planId, isLatest: true },
        data: { isLatest: false },
      });

      const version = await tx.planVersion.create({
        data: {
          planId: input.planId,
          versionNumber,
          effectiveFrom: new Date(),
          trialDays: input.trialDays ?? latest?.trialDays ?? 14,
          graceDays: input.graceDays ?? latest?.graceDays ?? 7,
          billingPeriodDefault:
            input.billingPeriodDefault ??
            latest?.billingPeriodDefault ??
            ("MONTHLY" as BillingCycle),
          notes: input.notes,
          createdById: input.createdById,
          isLatest: true,
        },
      });

      const featureIds = new Set(features.map((f) => f.id));
      const allFeatures = await tx.feature.findMany({ where: { isActive: true } });

      if (allFeatures.length > 0) {
        await tx.planFeature.createMany({
          data: allFeatures.map((feature) => ({
            planVersionId: version.id,
            featureId: feature.id,
            enabled: featureIds.has(feature.id),
          })),
        });
      }

      if (input.pricing) {
        await tx.planPricing.create({
          data: {
            planVersionId: version.id,
            currency: input.pricing.currency ?? "INR",
            priceMonthly: input.pricing.priceMonthly,
            priceYearly: input.pricing.priceYearly,
            taxRate: input.pricing.taxRate ?? 0,
            taxInclusive: input.pricing.taxInclusive ?? false,
            discountPercent: input.pricing.discountPercent ?? 0,
            offerStartDate: input.pricing.offerStartDate,
            offerEndDate: input.pricing.offerEndDate,
            effectiveFrom: input.pricing.effectiveFrom ?? new Date(),
            effectiveTo: input.pricing.effectiveTo,
          },
        });
      } else if (latest) {
        const latestPricing = await tx.planPricing.findFirst({
          where: { planVersionId: latest.id, effectiveTo: null },
          orderBy: { effectiveFrom: "desc" },
        });
        if (latestPricing) {
          await tx.planPricing.create({
            data: {
              planVersionId: version.id,
              currency: latestPricing.currency,
              priceMonthly: latestPricing.priceMonthly,
              priceYearly: latestPricing.priceYearly,
              taxRate: latestPricing.taxRate,
              taxInclusive: latestPricing.taxInclusive,
              discountPercent: latestPricing.discountPercent,
              offerStartDate: latestPricing.offerStartDate,
              offerEndDate: latestPricing.offerEndDate,
              effectiveFrom: new Date(),
            },
          });
        }
      }

      return tx.planVersion.findUnique({
        where: { id: version.id },
        include: {
          planFeatures: { include: { feature: true } },
          pricing: true,
        },
      });
    },
    { maxWait: 20_000, timeout: 120_000 }
  ).then(async (version) => {
    if (version) {
      await logBillingAction({
        action: "PLAN_VERSION_CREATED",
        entityType: "PlanVersion",
        entityId: version.id,
        actorUserId: input.createdById,
        metadata: { planId: input.planId, versionNumber: version.versionNumber },
      });

      try {
        await syncRazorpayPlansForVersion(version.id, input.createdById);
      } catch (error) {
        console.error("Razorpay plan sync failed for new version:", error);
      }
    }
    return version;
  });
}

export async function duplicatePlan(planId: string, createdById?: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      versions: {
        where: { isLatest: true },
        include: {
          planFeatures: { include: { feature: true } },
          pricing: { orderBy: { effectiveFrom: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!plan) throw new Error("Plan not found");

  const latestVersion = plan.versions[0];
  const slugBase = `${plan.slug}-copy`;
  let slug = slugBase;
  let i = 1;
  while (await prisma.plan.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${i++}`;
  }

  const newPlan = await prisma.plan.create({
    data: {
      name: `${plan.name} (Copy)`,
      slug,
      description: plan.description,
      status: plan.status,
      displayOrder: plan.displayOrder + 1,
      isVisible: false,
    },
  });

  if (latestVersion) {
    const enabledCodes = latestVersion.planFeatures
      .filter((pf) => pf.enabled)
      .map((pf) => pf.feature.code);
    const pricing = latestVersion.pricing[0];
    await createPlanVersion({
      planId: newPlan.id,
      featureCodes: enabledCodes,
      trialDays: latestVersion.trialDays,
      graceDays: latestVersion.graceDays,
      billingPeriodDefault: latestVersion.billingPeriodDefault,
      notes: `Duplicated from ${plan.name}`,
      createdById,
      pricing: pricing
        ? {
            currency: pricing.currency,
            priceMonthly: pricing.priceMonthly,
            priceYearly: pricing.priceYearly,
            taxRate: pricing.taxRate,
            taxInclusive: pricing.taxInclusive,
            discountPercent: pricing.discountPercent,
          }
        : undefined,
    });
  }

  return newPlan;
}

export async function scheduleFuturePricing(
  planVersionId: string,
  pricing: {
    currency?: string;
    priceMonthly: number;
    priceYearly: number;
    taxRate?: number;
    effectiveFrom: Date;
    discountPercent?: number;
  }
) {
  const current = await prisma.planPricing.findFirst({
    where: { planVersionId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });

  if (current && current.effectiveFrom < pricing.effectiveFrom) {
    await prisma.planPricing.update({
      where: { id: current.id },
      data: { effectiveTo: pricing.effectiveFrom },
    });
  }

  return prisma.planPricing.create({
    data: {
      planVersionId,
      currency: pricing.currency ?? "INR",
      priceMonthly: pricing.priceMonthly,
      priceYearly: pricing.priceYearly,
      taxRate: pricing.taxRate ?? 0,
      discountPercent: pricing.discountPercent ?? 0,
      effectiveFrom: pricing.effectiveFrom,
    },
  });
}
