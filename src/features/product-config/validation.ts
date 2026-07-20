import type { ConfigurableProduct, ProductSelection, ValidationResult } from "./types";
import { findModifier, findVariant, getActiveModifierGroups, getVariantGroups } from "./product-helpers";

export function validateSelection(
  product: ConfigurableProduct,
  selection: ProductSelection
): ValidationResult {
  const errors: string[] = [];

  if (selection.quantity < 1) {
    errors.push("Quantity must be at least 1");
  }

  const variantGroups = getVariantGroups(product);
  const hasVariants = variantGroups.some((g) => g.variants.length > 0);

  if (hasVariants) {
    // Always require a variant when the product has them so each variant is its own line
    // and priced correctly (base product price must not absorb mixed variants).
    if (!selection.variantId) {
      errors.push("Please select a variant");
    } else if (!findVariant(product, selection.variantId)) {
      errors.push("Selected variant is no longer available");
    }
  }

  const modifierGroups = getActiveModifierGroups(product);
  const selectedByGroup = new Map<string, string[]>();

  for (const modifierId of selection.modifierIds) {
    const found = findModifier(product, modifierId);
    if (!found) {
      errors.push("One or more modifiers are no longer available");
      continue;
    }
    const list = selectedByGroup.get(found.group.id) ?? [];
    list.push(modifierId);
    selectedByGroup.set(found.group.id, list);
  }

  for (const group of modifierGroups) {
    const count = selectedByGroup.get(group.id)?.length ?? 0;
    const min = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
    const max = group.maxSelect > 0 ? group.maxSelect : Infinity;

    if (count < min) {
      errors.push(
        min === 1
          ? `Select at least one option from ${group.name}`
          : `Select at least ${min} from ${group.name}`
      );
    }
    if (Number.isFinite(max) && count > max) {
      errors.push(`Select at most ${group.maxSelect} from ${group.name}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function canAddToOrder(product: ConfigurableProduct, selection: ProductSelection): boolean {
  return validateSelection(product, selection).valid;
}
