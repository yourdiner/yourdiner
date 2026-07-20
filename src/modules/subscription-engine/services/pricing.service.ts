import { prisma } from "@/lib/db";
import type { BillingCycle } from "@prisma/client";
import type { EffectivePrice } from "../types";

export function resolveEffectivePricing(
  pricingRows: Array<{
    currency: string;
    priceMonthly: number;
    priceYearly: number;
    taxRate: number;
    discountPercent: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }>,
  at: Date = new Date()
): EffectivePrice | null {
  const row = pricingRows.find(
    (p) => p.effectiveFrom <= at && (!p.effectiveTo || p.effectiveTo > at)
  );
  if (!row) return null;
  return {
    priceMonthly: row.priceMonthly,
    priceYearly: row.priceYearly,
    currency: row.currency,
    taxRate: row.taxRate,
    discountPercent: row.discountPercent,
  };
}

export async function getEffectivePriceForVersion(
  planVersionId: string,
  at: Date = new Date()
): Promise<EffectivePrice | null> {
  const rows = await prisma.planPricing.findMany({
    where: { planVersionId },
    orderBy: { effectiveFrom: "desc" },
  });
  return resolveEffectivePricing(rows, at);
}

export function getPriceForCycle(pricing: EffectivePrice, cycle: BillingCycle): number {
  const base = cycle === "YEARLY" ? pricing.priceYearly : pricing.priceMonthly;
  if (pricing.discountPercent > 0) {
    return Math.round(base * (1 - pricing.discountPercent / 100));
  }
  return base;
}

export function calculateProration(
  pricePaid: number,
  periodStart: Date,
  periodEnd: Date,
  newPlanPrice: number,
  at: Date = new Date()
): { remainingCredit: number; chargeAmount: number; daysRemaining: number } {
  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const remainingMs = Math.max(0, periodEnd.getTime() - at.getTime());
  const totalDays = Math.max(1, Math.ceil(totalMs / (24 * 60 * 60 * 1000)));
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const remainingCredit = Math.round((pricePaid / totalDays) * daysRemaining);
  const chargeAmount = Math.max(0, newPlanPrice - remainingCredit);
  return { remainingCredit, chargeAmount, daysRemaining };
}
