import "server-only";

import { prisma } from "@/lib/db";
import { getRestaurantSettingsCached } from "@/lib/request-cache";
import { getPromoCache, setPromoCache } from "./cache";
import { mapPromotionToEngine } from "./map-promotion";
import type { EnginePromotion } from "./types";
import { getLocalClock, isPromotionWindowActive } from "./window";

const PROMO_INCLUDE = {
  targets: true,
  comboComponents: { orderBy: { sortOrder: "asc" as const } },
  dayPrices: true,
} as const;

/**
 * Load active, in-window promotions for a restaurant.
 * Optionally narrow to product/category relevance (still includes ENTIRE_MENU, COMBO, BILL_*).
 */
export async function loadActivePromotions(
  restaurantId: string,
  options?: {
    at?: Date;
    productIds?: string[];
    categoryIds?: string[];
  }
): Promise<EnginePromotion[]> {
  const at = options?.at ?? new Date();
  const settings = await getRestaurantSettingsCached(restaurantId);
  const timeZone = settings?.timezone || "Asia/Kolkata";
  const clock = getLocalClock(at, timeZone);
  const bucket = Math.floor(clock.minutesOfDay / 5); // 5-minute cache bucket
  const cacheKey = `promos:${restaurantId}:${clock.dateKey}:${bucket}`;

  let all = getPromoCache<EnginePromotion[]>(cacheKey);
  if (!all) {
    const rows = await prisma.promotion.findMany({
      where: {
        restaurantId,
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: at } }] },
          { OR: [{ endDate: null }, { endDate: { gte: at } }] },
        ],
      },
      include: PROMO_INCLUDE,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });

    all = rows
      .map(mapPromotionToEngine)
      .filter((p) => isPromotionWindowActive(p, clock, timeZone));

    setPromoCache(cacheKey, all);
  }

  const productIds = new Set(options?.productIds ?? []);
  const categoryIds = new Set(options?.categoryIds ?? []);
  if (!productIds.size && !categoryIds.size) return all;

  return all.filter((p) => {
    if (
      p.type === "COMBO" ||
      p.type === "BILL_FLAT" ||
      p.type === "BILL_PERCENT" ||
      p.targetScope === "ENTIRE_MENU"
    ) {
      return true;
    }
    if (p.targetScope === "PRODUCTS") {
      return p.targets.some((t) => t.productId && productIds.has(t.productId));
    }
    if (p.targetScope === "CATEGORIES") {
      return p.targets.some((t) => t.categoryId && categoryIds.has(t.categoryId));
    }
    // Combo relevance by component products
    if (p.comboComponents.length) {
      return p.comboComponents.some((c) => productIds.has(c.productId));
    }
    return true;
  });
}

export async function getRestaurantPricingClock(restaurantId: string, at = new Date()) {
  const settings = await getRestaurantSettingsCached(restaurantId);
  const timeZone = settings?.timezone || "Asia/Kolkata";
  return { timeZone, clock: getLocalClock(at, timeZone) };
}
