import { priceSelection } from "@/features/product-config";
import {
  productMatchesPromotion,
  resolveDayFixedPrice,
  sortByPriorityDesc,
} from "./targeting";
import type { AppliedPromotionAudit, PriceLineContext, PricedLine } from "./types";

/**
 * Central line pricing:
 * 1. Base + variant + modifiers (existing priceSelection)
 * 2. Time/day fixed price replaces base only; modifiers unchanged
 * 3. Percentage then flat discounts by priority / stackable
 */
export function priceLine(ctx: PriceLineContext): PricedLine {
  const basePriced = priceSelection(ctx.product, ctx.selection);
  const modifierTotal = basePriced.modifiers.reduce((s, m) => s + m.price, 0);
  let workingBase = basePriced.basePrice;
  const applied: AppliedPromotionAudit[] = [];

  const applicable = sortByPriorityDesc(ctx.promotions).filter((p) =>
    productMatchesPromotion(p, ctx.product.id, ctx.product.categoryId)
  );

  let stopStacking = false;
  let primaryPromoId: string | null = null;
  let primaryPromoName: string | null = null;

  // Fixed-price overrides (time/day) — only first (highest priority) applies
  for (const promo of applicable) {
    if (stopStacking) break;
    if (promo.type !== "TIME_PRICE" && promo.type !== "DAY_PRICE") continue;

    const fixed = resolveDayFixedPrice(promo, ctx.dayOfWeek);
    if (fixed == null) continue;

    const before = workingBase;
    workingBase = fixed;
    const discount = Math.max(0, before - workingBase);
    applied.push({
      promotionId: promo.id,
      promotionName: promo.name,
      discountPaise: discount,
    });
    if (!primaryPromoId) {
      primaryPromoId = promo.id;
      primaryPromoName = promo.name;
    }
    if (!promo.stackable) stopStacking = true;
    break; // never two fixed-price overrides
  }

  // Percentage / flat line discounts
  for (const promo of applicable) {
    if (stopStacking) break;
    if (promo.type !== "PERCENT" && promo.type !== "FLAT") continue;

    const currentUnit = workingBase + modifierTotal;
    let discount = 0;

    if (promo.type === "PERCENT" && promo.percentOff != null && promo.percentOff > 0) {
      const pct = Math.min(100, Math.max(0, promo.percentOff));
      discount = Math.round((currentUnit * pct) / 100);
    } else if (promo.type === "FLAT" && promo.flatOffPaise != null && promo.flatOffPaise > 0) {
      discount = Math.min(currentUnit, promo.flatOffPaise);
    }

    if (discount <= 0) continue;

    // Apply discount to base portion first conceptually: reduce unit by discount
    // Keep modifiers intact by reducing workingBase, floored at 0.
    const newUnit = Math.max(0, currentUnit - discount);
    workingBase = Math.max(0, newUnit - modifierTotal);

    applied.push({
      promotionId: promo.id,
      promotionName: promo.name,
      discountPaise: discount,
    });
    if (!primaryPromoId) {
      primaryPromoId = promo.id;
      primaryPromoName = promo.name;
    }
    if (!promo.stackable) stopStacking = true;
  }

  const unitPrice = workingBase + modifierTotal;
  const originalUnitPrice = basePriced.basePrice + modifierTotal;
  const promotionDiscountPaise = Math.max(0, originalUnitPrice - unitPrice);
  const qty = Math.max(1, ctx.selection.quantity);

  return {
    ...basePriced,
    basePrice: workingBase,
    unitPrice,
    totalPrice: unitPrice * qty,
    originalUnitPrice,
    promotionId: primaryPromoId,
    promotionNameSnapshot: primaryPromoName,
    promotionDiscountPaise,
    applied,
  };
}
