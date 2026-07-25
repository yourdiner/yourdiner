/**
 * Request-scoped memoization for Prisma lookups.
 * Uses React `cache()` so layout + page + actions share one DB hit per request.
 */
import { cache } from "react";
import { prisma } from "@/lib/db";

/** One restaurantSettings row per restaurantId per request. */
export const getRestaurantSettingsCached = cache(async (restaurantId: string) => {
  return prisma.restaurantSettings.findUnique({
    where: { restaurantId },
    select: {
      orderSettings: true,
      loyaltySettings: true,
      printerSettings: true,
      reservationSettings: true,
      averageDiningMinutes: true,
      taxPercent: true,
      taxInclusive: true,
      language: true,
      currency: true,
      timezone: true,
    },
  });
});

/** Branding snapshot (admin) — one per restaurantId per request. */
export const getRestaurantBrandingCached = cache(async (restaurantId: string) => {
  const branding = await prisma.restaurantBranding.findUnique({
    where: { restaurantId },
    include: {
      logo: true,
      favicon: true,
      cover: true,
    },
  });
  if (!branding) return null;

  const {
    normalizeBrandPrimary,
    normalizeBrandSecondary,
    normalizeBrandAccent,
    BRAND_PRIMARY_GREEN,
    BRAND_SECONDARY,
    BRAND_ACCENT_GREEN,
  } = await import("@/lib/brand-colors");

  const primaryColor = normalizeBrandPrimary(branding.primaryColor);
  const secondaryColor = normalizeBrandSecondary(branding.secondaryColor);
  const accentColor = normalizeBrandAccent(branding.accentColor);

  // Persist migration away from the old near-black defaults so admin + menu stay aligned.
  if (
    primaryColor !== branding.primaryColor ||
    secondaryColor !== branding.secondaryColor ||
    accentColor !== branding.accentColor
  ) {
    void prisma.restaurantBranding
      .update({
        where: { id: branding.id },
        data: {
          primaryColor: primaryColor || BRAND_PRIMARY_GREEN,
          secondaryColor: secondaryColor || BRAND_SECONDARY,
          accentColor: accentColor || BRAND_ACCENT_GREEN,
        },
      })
      .catch(() => undefined);
  }

  return {
    ...branding,
    primaryColor,
    secondaryColor,
    accentColor,
  };
});

/** Slim restaurant row used by feature gating — one per request. */
export const getRestaurantStatusCached = cache(async (restaurantId: string) => {
  return prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { status: true },
  });
});

/**
 * Restaurant + subscription (+ branding logo) shared by dashboard layout and overview.
 * One DB hit per request.
 */
export const getRestaurantWithSubscriptionCached = cache(async (restaurantId: string) => {
  return prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      subscription: { include: { plan: true } },
      branding: { include: { logo: true } },
    },
  });
});

/** Menu overview counts — same four numbers as separate count() calls, fewer round-trips. */
export const getDashboardMenuCounts = cache(async (restaurantId: string) => {
  const [categories, productGroups] = await Promise.all([
    prisma.category.count({ where: { restaurantId } }),
    prisma.product.groupBy({
      by: ["isHidden", "isAvailable"],
      where: { restaurantId },
      _count: { _all: true },
    }),
  ]);

  let products = 0;
  let activeProducts = 0;
  let hiddenProducts = 0;
  for (const row of productGroups) {
    const n = row._count._all;
    products += n;
    if (row.isHidden) hiddenProducts += n;
    if (!row.isHidden && row.isAvailable) activeProducts += n;
  }

  return { categories, products, activeProducts, hiddenProducts };
});
