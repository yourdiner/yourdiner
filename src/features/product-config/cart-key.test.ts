import { describe, expect, it } from "vitest";
import {
  buildConfigurationKey,
  cartLineKey,
  normalizeInstructionNote,
} from "./cart-key";

describe("normalizeInstructionNote", () => {
  it("trims whitespace and treats empty as empty string", () => {
    expect(normalizeInstructionNote("  Less Sugar  ")).toBe("Less Sugar");
    expect(normalizeInstructionNote("   ")).toBe("");
    expect(normalizeInstructionNote(null)).toBe("");
    expect(normalizeInstructionNote(undefined)).toBe("");
  });
});

describe("buildConfigurationKey", () => {
  const productId = "prod-coffee";
  const large = "var-large";
  const small = "var-small";
  const iceCream = "mod-ice-cream";
  const chocolate = "mod-chocolate";

  it("same product + variant + mods + notes → identical key (qty merge)", () => {
    const a = buildConfigurationKey(productId, large, [iceCream], null, null);
    const b = buildConfigurationKey(productId, large, [iceCream], undefined, "");
    expect(a).toBe(b);
  });

  it("different variant → different key", () => {
    const a = buildConfigurationKey(productId, small, [iceCream]);
    const b = buildConfigurationKey(productId, large, [iceCream]);
    expect(a).not.toBe(b);
  });

  it("different modifier/add-on → different key", () => {
    const a = buildConfigurationKey(productId, large, [iceCream]);
    const b = buildConfigurationKey(productId, large, [chocolate]);
    expect(a).not.toBe(b);
  });

  it("same mods in different order → identical key (sorted IDs)", () => {
    const a = buildConfigurationKey(productId, large, [iceCream, chocolate]);
    const b = buildConfigurationKey(productId, large, [chocolate, iceCream]);
    expect(a).toBe(b);
  });

  it("same config + different note → different key", () => {
    const a = buildConfigurationKey(productId, large, [iceCream], null, null);
    const b = buildConfigurationKey(productId, large, [iceCream], "Less Sugar", null);
    expect(a).not.toBe(b);
  });

  it("empty vs missing note → identical after normalize", () => {
    const a = buildConfigurationKey(productId, large, [iceCream], "", "  ");
    const b = buildConfigurationKey(productId, large, [iceCream], null, undefined);
    expect(a).toBe(b);
  });

  it("different kitchenNotes → different key", () => {
    const a = buildConfigurationKey(productId, large, [iceCream], null, "No ice");
    const b = buildConfigurationKey(productId, large, [iceCream], null, "Extra hot");
    expect(a).not.toBe(b);
  });

  it("cartLineKey matches buildConfigurationKey including notes", () => {
    expect(
      cartLineKey(productId, large, [chocolate, iceCream], "  note  ", null)
    ).toBe(buildConfigurationKey(productId, large, [iceCream, chocolate], "note", ""));
  });
});

describe("merge identity scenarios (key equality = would merge qty)", () => {
  const productId = "prod-cold-coffee";
  const large = "var-large";
  const small = "var-small";
  const iceCream = "mod-ice-cream";
  const chocolate = "mod-extra-choc";

  function wouldMerge(
    a: Parameters<typeof buildConfigurationKey>,
    b: Parameters<typeof buildConfigurationKey>
  ) {
    return buildConfigurationKey(...a) === buildConfigurationKey(...b);
  }

  it("Example 1: same Large + Ice Cream twice → merge", () => {
    expect(
      wouldMerge(
        [productId, large, [iceCream]],
        [productId, large, [iceCream]]
      )
    ).toBe(true);
  });

  it("Example 2: Large with no add-on twice → merge", () => {
    expect(wouldMerge([productId, large, []], [productId, large, []])).toBe(true);
  });

  it("Example 3: Ice Cream vs Extra Chocolate → separate", () => {
    expect(
      wouldMerge(
        [productId, large, [iceCream]],
        [productId, large, [chocolate]]
      )
    ).toBe(false);
  });

  it("Example 4: Small vs Large same add-on → separate", () => {
    expect(
      wouldMerge(
        [productId, small, [iceCream]],
        [productId, large, [iceCream]]
      )
    ).toBe(false);
  });

  it("Example 5: same config + Less Sugar note → separate", () => {
    expect(
      wouldMerge(
        [productId, large, [iceCream], null, null],
        [productId, large, [iceCream], "Less Sugar", null]
      )
    ).toBe(false);
  });
});
