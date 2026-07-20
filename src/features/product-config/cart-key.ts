/** Normalize special-instruction text for merge identity (trim; empty → ""). */
export function normalizeInstructionNote(note?: string | null): string {
  return (note ?? "").trim();
}

/**
 * Canonical order-line identity.
 * Two selections merge only when product, variant, sorted modifiers, and notes match.
 */
export function buildConfigurationKey(
  productId: string,
  variantId: string | null | undefined,
  modifierIds: string[],
  notes?: string | null,
  kitchenNotes?: string | null
): string {
  const sortedMods = [...modifierIds].sort().join(",");
  const n = normalizeInstructionNote(notes);
  const kn = normalizeInstructionNote(kitchenNotes);
  return `${productId}:${variantId ?? ""}:${sortedMods}:${n}:${kn}`;
}

export function cartLineKey(
  productId: string,
  variantId: string | null | undefined,
  modifierIds: string[],
  notes?: string | null,
  kitchenNotes?: string | null
): string {
  return buildConfigurationKey(productId, variantId, modifierIds, notes, kitchenNotes);
}
