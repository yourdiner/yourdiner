import { prisma } from "@/lib/db";
import { getCachedPublicBranding } from "@/lib/menu-cache";
import { getRestaurantBrandingCached } from "@/lib/request-cache";

export async function getTenantBrandingMetadata(restaurantId: string, restaurantName: string) {
  const branding = await getCachedPublicBranding(restaurantId);
  const title = restaurantName;
  const description = branding?.about || `Manage ${restaurantName}`;
  const icons = branding?.favicon?.url
    ? [{ url: branding.favicon.url, type: "image/png" }]
    : undefined;

  return {
    title: { default: title, template: `%s · ${restaurantName}` },
    description,
    icons,
    openGraph: {
      title,
      description,
      images: branding?.logo?.url ? [branding.logo.url] : undefined,
    },
    appleWebApp: { title: restaurantName },
  };
}

export async function getRestaurantBrandingSnapshot(restaurantId: string) {
  return getRestaurantBrandingCached(restaurantId);
}
