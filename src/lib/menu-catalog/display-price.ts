/**
 * Menu card display price — ignores modifiers/add-ons entirely.
 * - No variants → base product price (never "From")
 * - Has variants → lowest variant price with "From"
 */
export function resolveMenuCardDisplayPrice(input: {
  basePrice: number;
  variantPrices: number[];
}): { amount: number; showFrom: boolean } {
  const prices = input.variantPrices.filter((p) => Number.isFinite(p));
  if (prices.length > 0) {
    return { amount: Math.min(...prices), showFrom: true };
  }
  return { amount: input.basePrice, showFrom: false };
}
