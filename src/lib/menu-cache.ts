import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { parseSocialLinks } from "@/lib/social-links";
import { getCachedCategoriesWithFirstProducts } from "@/lib/menu-catalog/cache";
import {
  MENU_CACHE_SECONDS,
  publicMenuCacheTag,
  publicBrandingCacheTag,
} from "@/lib/menu-catalog/tags";
import type { MenuData } from "@/features/menu/components/public-menu-types";
import {
  normalizeBrandPrimary,
  normalizeBrandSecondary,
  normalizeBrandAccent,
} from "@/lib/brand-colors";

export { MENU_CACHE_SECONDS, publicMenuCacheTag, publicBrandingCacheTag };

export function revalidatePublicMenuCache(restaurantId: string) {
  revalidateTag(publicMenuCacheTag(restaurantId));
  revalidateTag(publicBrandingCacheTag(restaurantId));
}

async function fetchPublicMenuShellUncached(restaurantId: string): Promise<MenuData | null> {
  const [restaurant, categories] = await Promise.all([
    prisma.restaurant.findFirst({
      where: { id: restaurantId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        status: true,
        branding: {
          select: {
            primaryColor: true,
            secondaryColor: true,
            accentColor: true,
            fontFamily: true,
            about: true,
            address: true,
            phone: true,
            email: true,
            gstNumber: true,
            receiptFooter: true,
            openingHours: true,
            socialLinks: true,
            logo: { select: { url: true } },
            cover: { select: { url: true } },
          },
        },
        subscription: {
          select: {
            status: true,
            plan: { select: { features: true } },
            planVersion: {
              select: {
                planFeatures: {
                  select: {
                    enabled: true,
                    feature: { select: { code: true, isActive: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    getCachedCategoriesWithFirstProducts(restaurantId),
  ]);

  if (!restaurant) return null;

  const branding = restaurant.branding
    ? {
        ...restaurant.branding,
        primaryColor: normalizeBrandPrimary(restaurant.branding.primaryColor),
        secondaryColor: normalizeBrandSecondary(restaurant.branding.secondaryColor),
        accentColor: normalizeBrandAccent(restaurant.branding.accentColor),
        openingHours: (restaurant.branding.openingHours ?? []) as Array<{
          day: string;
          open: string;
          close: string;
          closed: boolean;
        }>,
        socialLinks: parseSocialLinks(restaurant.branding.socialLinks),
      }
    : null;

  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      status: restaurant.status,
      subscription: restaurant.subscription,
      branding,
    },
    categories,
  };
}

/**
 * Public menu shell: restaurant + categories, with products only for the first category.
 * Remaining category products load progressively on the client.
 */
export function getCachedPublicMenu(restaurantId: string) {
  return unstable_cache(
    () => fetchPublicMenuShellUncached(restaurantId),
    ["public-menu-shell", restaurantId],
    { revalidate: MENU_CACHE_SECONDS, tags: [publicMenuCacheTag(restaurantId)] }
  )();
}

async function fetchPublicBrandingUncached(restaurantId: string) {
  const branding = await prisma.restaurantBranding.findUnique({
    where: { restaurantId },
    include: { logo: true, cover: true, favicon: true },
  });
  if (!branding) return null;
  return {
    ...branding,
    primaryColor: normalizeBrandPrimary(branding.primaryColor),
    secondaryColor: normalizeBrandSecondary(branding.secondaryColor),
    accentColor: normalizeBrandAccent(branding.accentColor),
  };
}

export function getCachedPublicBranding(restaurantId: string) {
  return unstable_cache(
    () => fetchPublicBrandingUncached(restaurantId),
    ["public-branding", restaurantId],
    { revalidate: MENU_CACHE_SECONDS, tags: [publicBrandingCacheTag(restaurantId)] }
  )();
}
