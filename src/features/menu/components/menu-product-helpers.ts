import type { ConfigurableProduct } from "@/features/product-config";
import type { MenuProduct, MenuProductCard } from "@/features/menu/components/public-menu-types";

export function menuProductToConfigurable(product: MenuProduct): ConfigurableProduct {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    description: product.description,
    shortDescription: product.shortDescription,
    isOutOfStock: product.isOutOfStock,
    variantGroups: product.variantGroups,
    variants: product.variants,
    modifierGroups: product.modifierGroups,
    images: product.images,
  };
}

export function configurableToMenuProduct(
  config: ConfigurableProduct,
  card?: MenuProductCard | null
): MenuProduct {
  return {
    id: config.id,
    name: config.name,
    shortDescription: config.shortDescription ?? card?.shortDescription ?? null,
    description: config.description ?? card?.description ?? null,
    price: config.price,
    discountPrice: card?.discountPrice ?? null,
    dietaryType: card?.dietaryType ?? "VEG",
    spicyLevel: card?.spicyLevel ?? 0,
    isOutOfStock: config.isOutOfStock ?? card?.isOutOfStock ?? false,
    isFeatured: card?.isFeatured ?? false,
    isBestSeller: card?.isBestSeller ?? false,
    isChefSpecial: card?.isChefSpecial ?? false,
    calories: card?.calories ?? null,
    allergens: card?.allergens ?? [],
    variantGroups: config.variantGroups ?? [],
    modifierGroups: config.modifierGroups ?? [],
    variants: config.variants ?? [],
    images: config.images?.length
      ? config.images
      : card?.images ?? [],
  };
}

export function productHasOptions(product: MenuProductCard): boolean {
  return product.hasVariants || product.hasModifiers || product.hasAddOns;
}

export function productOptionCount(product: MenuProductCard): number {
  // Card-level: use flags as truthy counts for "Customizable" badge
  return (product.hasVariants ? 1 : 0) + (product.hasModifiers || product.hasAddOns ? 1 : 0);
}

export function productDisplayFromPrice(product: MenuProductCard): number {
  return product.displayFromPrice;
}

/** Format card price: "From ₹X" only when variants exist — never because of add-ons. */
export function formatMenuCardPrice(
  product: MenuProductCard,
  formatCurrency: (paise: number) => string
): string {
  const amount = product.displayFromPrice;
  if (product.showFromPrice ?? product.hasVariants) {
    return `From ${formatCurrency(amount)}`;
  }
  return formatCurrency(amount);
}
