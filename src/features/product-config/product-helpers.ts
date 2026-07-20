import type { ConfigurableProduct, ConfigurableVariantGroup } from "./types";

/** Normalize legacy flat variants into variant groups. */
export function getVariantGroups(product: ConfigurableProduct): ConfigurableVariantGroup[] {
  if (product.variantGroups?.length) {
    return product.variantGroups
      .filter((g) => g.variants.some((v) => v.isActive !== false && v.isAvailable !== false))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  const flat = (product.variants ?? []).filter(
    (v) => v.isActive !== false && v.isAvailable !== false
  );
  if (flat.length === 0) return [];

  return [
    {
      id: "__default__",
      name: "Options",
      isRequired: true,
      sortOrder: 0,
      variants: flat,
    },
  ];
}

export function hasRequiredVariants(product: ConfigurableProduct): boolean {
  return getVariantGroups(product).some((g) => g.isRequired && g.variants.length > 0);
}

export function getDisplayFromPrice(product: ConfigurableProduct): number {
  const groups = getVariantGroups(product);
  const variantPrices = groups.flatMap((g) => g.variants.map((v) => v.price));
  if (variantPrices.length > 0) {
    return Math.min(...variantPrices);
  }
  return product.price;
}

export function findVariant(product: ConfigurableProduct, variantId: string) {
  for (const group of getVariantGroups(product)) {
    const variant = group.variants.find((v) => v.id === variantId);
    if (variant) return { group, variant };
  }
  return null;
}

export function findModifier(product: ConfigurableProduct, modifierId: string) {
  for (const group of product.modifierGroups ?? []) {
    const modifier = group.modifiers.find((m) => m.id === modifierId);
    if (modifier) return { group, modifier };
  }
  return null;
}

export function getActiveModifierGroups(product: ConfigurableProduct) {
  return (product.modifierGroups ?? [])
    .filter((g) => g.modifiers.some((m) => m.isActive !== false && m.isAvailable !== false))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
