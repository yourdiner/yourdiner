import { computeOrderTotal, computeTaxAmount } from "@/lib/tax-settings";
import { sortByPriorityDesc } from "./targeting";
import type {
  AppliedPromotionAudit,
  EnginePromotion,
  PriceOrderInput,
  PriceOrderResult,
} from "./types";

/**
 * Order-level pricing: bill promotions → tax → total.
 * manualDiscountPaise is preserved separately (checkout / loyalty).
 */
export function priceOrder(input: PriceOrderInput): PriceOrderResult {
  const delivery = Math.max(0, input.deliveryChargesPaise ?? 0);
  const subtotal = Math.max(0, input.lineTotalPaise) + delivery;

  const billPromos = sortByPriorityDesc(input.billPromotions).filter(
    (p) => p.type === "BILL_FLAT" || p.type === "BILL_PERCENT"
  );

  let promotionDiscountAmount = 0;
  let appliedBillPromotion: AppliedPromotionAudit | null = null;
  let remaining = subtotal;

  for (const promo of billPromos) {
    const minSpend = promo.minOrderAmountPaise ?? 0;
    if (subtotal < minSpend) continue;

    let discount = 0;
    if (promo.type === "BILL_PERCENT" && promo.percentOff != null) {
      const pct = Math.min(100, Math.max(0, promo.percentOff));
      discount = Math.round((remaining * pct) / 100);
    } else if (promo.type === "BILL_FLAT" && promo.flatOffPaise != null) {
      discount = Math.max(0, promo.flatOffPaise);
    }

    discount = Math.min(discount, remaining);
    if (discount <= 0) continue;

    promotionDiscountAmount += discount;
    remaining -= discount;
    if (!appliedBillPromotion) {
      appliedBillPromotion = {
        promotionId: promo.id,
        promotionName: promo.name,
        discountPaise: discount,
      };
    }
    if (!promo.stackable) break;
  }

  const manualDiscountPaise = Math.max(0, input.manualDiscountPaise);
  const totalDiscount = promotionDiscountAmount + manualDiscountPaise;

  const taxAmount = computeTaxAmount(
    subtotal,
    input.taxSettings.taxPercent,
    input.taxSettings.taxInclusive
  );

  const total = computeOrderTotal(
    subtotal,
    taxAmount,
    totalDiscount,
    input.taxSettings.taxInclusive
  );

  return {
    subtotal,
    promotionDiscountAmount,
    discountAmount: manualDiscountPaise,
    taxAmount,
    total,
    appliedBillPromotion,
  };
}

export function filterBillPromotions(promotions: EnginePromotion[]): EnginePromotion[] {
  return promotions.filter((p) => p.type === "BILL_FLAT" || p.type === "BILL_PERCENT");
}
