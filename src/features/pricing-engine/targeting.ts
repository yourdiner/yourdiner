import type { EnginePromotion } from "./types";

export function sortByPriorityDesc(promos: EnginePromotion[]): EnginePromotion[] {
  return [...promos].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

export function productMatchesPromotion(
  promo: EnginePromotion,
  productId: string,
  categoryId: string | undefined
): boolean {
  if (promo.type === "COMBO" || promo.type === "BILL_FLAT" || promo.type === "BILL_PERCENT") {
    return false;
  }

  if (promo.targetScope === "ENTIRE_MENU") return true;

  if (promo.targetScope === "PRODUCTS") {
    return promo.targets.some((t) => t.productId === productId);
  }

  if (promo.targetScope === "CATEGORIES") {
    if (!categoryId) return false;
    return promo.targets.some((t) => t.categoryId === categoryId);
  }

  return false;
}

export function resolveDayFixedPrice(
  promo: EnginePromotion,
  dayOfWeek: number
): number | null {
  if (promo.type === "TIME_PRICE") {
    return promo.fixedPricePaise != null && promo.fixedPricePaise >= 0
      ? promo.fixedPricePaise
      : null;
  }

  if (promo.type === "DAY_PRICE") {
    for (const band of promo.dayPrices) {
      if (band.daysOfWeek.includes(dayOfWeek) && band.fixedPricePaise >= 0) {
        return band.fixedPricePaise;
      }
    }
    // Fallback to promotion-level fixed price if band missing
    if (promo.fixedPricePaise != null && promo.fixedPricePaise >= 0) {
      if (!promo.daysOfWeek.length || promo.daysOfWeek.includes(dayOfWeek)) {
        return promo.fixedPricePaise;
      }
    }
  }

  return null;
}
