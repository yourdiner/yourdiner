import type { ConfigurableProduct } from "@/features/product-config";

/** Visibility / variant filter preset for catalog queries. */
export type MenuCatalogMode = "public" | "staff";

export type MenuCategoryShell = {
  id: string;
  name: string;
  description: string | null;
};

/** Lightweight product row for cards — no variant/modifier trees. */
export type MenuProductCard = {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  discountPrice: number | null;
  dietaryType: string;
  spicyLevel: number;
  isOutOfStock: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isChefSpecial: boolean;
  calories: number | null;
  allergens: string[];
  images: Array<{ media: { url: string } }>;
  /** Lowest active variant price, else base price. Never includes modifiers/add-ons. */
  displayFromPrice: number;
  /** True when display should use "From ₹X" (variants exist). */
  showFromPrice: boolean;
  hasVariants: boolean;
  hasModifiers: boolean;
  /** Add-ons are modeled as modifiers in this product; mirrors hasModifiers. */
  hasAddOns: boolean;
};

export type MenuProductConfig = ConfigurableProduct;

export type PublicMenuShell = {
  restaurant: {
    id: string;
    name: string;
    status?: string;
    branding: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
      fontFamily: string;
      about: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      logo: { url: string } | null;
      cover: { url: string } | null;
      gstNumber: string | null;
      receiptFooter: string | null;
      openingHours: Array<{ day: string; open: string; close: string; closed: boolean }>;
      socialLinks?: Record<string, string>;
    } | null;
    subscription?: unknown;
  };
  categories: Array<MenuCategoryShell & { products: MenuProductCard[] }>;
};
