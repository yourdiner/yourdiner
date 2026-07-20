import type { ConfigurableProduct, ProductSelection, PricedSelection } from "./types";
import { findModifier, findVariant, getVariantGroups } from "./product-helpers";
import { buildConfigurationKey } from "./cart-key";

export function computeBasePrice(product: ConfigurableProduct, variantId?: string | null): {
  basePrice: number;
  variantPrice: number | null;
  variantName: string | null;
  resolvedVariantId: string | null;
} {
  if (variantId) {
    const found = findVariant(product, variantId);
    if (found) {
      return {
        basePrice: found.variant.price,
        variantPrice: found.variant.price,
        variantName: found.variant.name,
        resolvedVariantId: found.variant.id,
      };
    }
  }

  const groups = getVariantGroups(product);
  if (groups.length > 0) {
    return {
      basePrice: product.price,
      variantPrice: null,
      variantName: null,
      resolvedVariantId: null,
    };
  }

  return {
    basePrice: product.price,
    variantPrice: null,
    variantName: null,
    resolvedVariantId: null,
  };
}

export function priceSelection(
  product: ConfigurableProduct,
  selection: ProductSelection
): PricedSelection {
  const qty = Math.max(1, selection.quantity);
  const { basePrice, variantPrice, variantName, resolvedVariantId } = computeBasePrice(
    product,
    selection.variantId
  );

  const modifiers = selection.modifierIds
    .map((id) => findModifier(product, id))
    .filter((found): found is NonNullable<ReturnType<typeof findModifier>> => found != null)
    .map(({ group, modifier }) => ({
      modifierId: modifier.id,
      groupId: group.id,
      groupName: group.name,
      name: modifier.name,
      price: modifier.price,
    }));

  const modifierTotal = modifiers.reduce((s, m) => s + m.price, 0);
  const unitPrice = basePrice + modifierTotal;
  const configurationKey = buildConfigurationKey(
    product.id,
    resolvedVariantId,
    modifiers.map((m) => m.modifierId),
    selection.notes,
    selection.kitchenNotes
  );

  return {
    unitPrice,
    totalPrice: unitPrice * qty,
    basePrice,
    variantPrice,
    variantName,
    variantId: resolvedVariantId,
    modifiers,
    configurationKey,
    displayName: product.name,
  };
}

export function computeUnitPrice(product: ConfigurableProduct, selection: ProductSelection): number {
  return priceSelection(product, selection).unitPrice;
}

export function computeTotalPrice(product: ConfigurableProduct, selection: ProductSelection): number {
  return priceSelection(product, selection).totalPrice;
}
