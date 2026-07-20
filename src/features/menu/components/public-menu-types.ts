import type {
  ConfigurableModifierGroup,
  ConfigurableVariantGroup,
  ProductSelection,
} from "@/features/product-config";
import type { MenuProductCard as CatalogProductCard } from "@/lib/menu-catalog/types";

/** Lightweight list row — progressive catalog. */
export type MenuProductCard = CatalogProductCard;

/** Fully configured product after on-demand config fetch (sheet / cart). */
export interface MenuProduct {
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
  variantGroups: ConfigurableVariantGroup[];
  modifierGroups: ConfigurableModifierGroup[];
  /** @deprecated prefer variantGroups */
  variants: Array<{ id: string; name: string; price: number }>;
  images: Array<{ media: { url: string } }>;
}

export interface MenuData {
  restaurant: {
    id: string;
    name: string;
    status?: string;
    subscription?: {
      status: string;
      plan: { features: unknown };
      planVersion?: {
        planFeatures: Array<{
          enabled: boolean;
          feature: { code: string; isActive: boolean };
        }>;
      } | null;
    } | null;
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
  };
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    /** Prefetched cards for first category may be present; others empty until client fetch. */
    products: MenuProductCard[];
  }>;
}

export type MenuViewMode = "browse" | "customer" | "staff";

export type MenuActiveOrder = {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  discountAmount: number;
  items: Array<{
    id: string;
    productId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    kitchenStatus: string;
    variantId?: string | null;
    variantNameSnapshot?: string | null;
    modifiers?: unknown;
    notes?: string | null;
    kitchenNotes?: string | null;
  }>;
};

export type AddItemOptions = {
  variantId?: string | null;
  modifierIds?: string[];
  notes?: string;
  kitchenNotes?: string;
};

export type StaffMenuActions = {
  addItem: (productId: string, quantity?: number, options?: AddItemOptions) => Promise<void>;
  updateItemConfig?: (itemId: string, selection: ProductSelection) => Promise<void>;
  updateQty: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  submitKitchen: () => Promise<void>;
  requestBill: () => Promise<void>;
  closeSession: () => Promise<void>;
};

export type StaffShellInfo = {
  restaurantName: string;
  staffName: string;
  staffRole: string;
};

export type OrderPanel = "menu" | "order" | "service" | "bill";
