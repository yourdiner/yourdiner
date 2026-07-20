import { describe, expect, it } from "vitest";
import { resolveMenuCardDisplayPrice } from "./display-price";

describe("resolveMenuCardDisplayPrice", () => {
  it("shows base price when there are no variants (ignores that modifiers exist)", () => {
    expect(
      resolveMenuCardDisplayPrice({
        basePrice: 15000,
        variantPrices: [],
      })
    ).toEqual({ amount: 15000, showFrom: false });
  });

  it("shows From lowest variant when variants exist", () => {
    expect(
      resolveMenuCardDisplayPrice({
        basePrice: 29900,
        variantPrices: [24900, 29900, 34900],
      })
    ).toEqual({ amount: 24900, showFrom: true });
  });

  it("never uses addon/modifier prices (callers must not pass them)", () => {
    // Guard: only the supplied variant list is considered
    expect(
      resolveMenuCardDisplayPrice({
        basePrice: 15000,
        variantPrices: [15000],
      })
    ).toEqual({ amount: 15000, showFrom: true });
  });
});
