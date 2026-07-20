import type { MenuData } from "@/features/menu/components/public-menu-view";

type OpeningHours = Array<{ day: string; open: string; close: string; closed: boolean }>;

type BrandingSnapshot = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  about: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  receiptFooter: string | null;
  openingHours: unknown;
  logo?: { url: string } | null;
  cover?: { url: string } | null;
};

type OrderContextCategoryShell = {
  id: string;
  name: string;
  description: string | null;
};

/** Maps order-context category shells + branding into the PublicMenuView menu shape (no products). */
export function buildMenuDataFromOrderContext(
  restaurant: { id: string; name: string },
  categories: OrderContextCategoryShell[],
  branding: BrandingSnapshot | null
): MenuData {
  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      branding: branding
        ? {
            primaryColor: branding.primaryColor,
            secondaryColor: branding.secondaryColor,
            accentColor: branding.accentColor,
            fontFamily: branding.fontFamily,
            about: branding.about,
            address: branding.address,
            phone: branding.phone,
            email: branding.email,
            logo: branding.logo ? { url: branding.logo.url } : null,
            cover: branding.cover ? { url: branding.cover.url } : null,
            gstNumber: branding.gstNumber,
            receiptFooter: branding.receiptFooter,
            openingHours: Array.isArray(branding.openingHours)
              ? (branding.openingHours as OpeningHours)
              : [],
            socialLinks: {},
          }
        : null,
    },
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      products: [],
    })),
  };
}
