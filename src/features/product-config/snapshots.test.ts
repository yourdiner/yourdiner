import { describe, expect, it } from "vitest";
import { buildOrderItemSnapshots } from "./snapshots";
import type { ConfigurableProduct } from "./types";

const product: ConfigurableProduct = {
  id: "prod-cold-coffee",
  name: "Cold Coffee",
  price: 15000,
  variantGroups: [
    {
      id: "vg-size",
      name: "Size",
      isRequired: true,
      variants: [
        { id: "var-small", name: "Small", price: 15000 },
        { id: "var-large", name: "Large", price: 17000 },
      ],
    },
  ],
  modifierGroups: [
    {
      id: "mg-addons",
      name: "Add-ons",
      minSelect: 0,
      maxSelect: 2,
      isRequired: false,
      modifiers: [
        { id: "mod-ice-cream", name: "Ice Cream", price: 3000 },
        { id: "mod-chocolate", name: "Extra Chocolate", price: 2000 },
      ],
    },
  ],
};

describe("buildOrderItemSnapshots configurationKey", () => {
  it("embeds notes so identical configs share a key", () => {
    const a = buildOrderItemSnapshots(product, {
      variantId: "var-large",
      modifierIds: ["mod-ice-cream"],
      quantity: 1,
    });
    const b = buildOrderItemSnapshots(product, {
      variantId: "var-large",
      modifierIds: ["mod-ice-cream"],
      quantity: 2,
    });
    expect(a.configurationKey).toBe(b.configurationKey);
    expect(a.unitPrice).toBe(20000); // 17000 + 3000
  });

  it("sorts modifier IDs in the key", () => {
    const a = buildOrderItemSnapshots(product, {
      variantId: "var-large",
      modifierIds: ["mod-ice-cream", "mod-chocolate"],
      quantity: 1,
    });
    const b = buildOrderItemSnapshots(product, {
      variantId: "var-large",
      modifierIds: ["mod-chocolate", "mod-ice-cream"],
      quantity: 1,
    });
    expect(a.configurationKey).toBe(b.configurationKey);
  });

  it("different notes produce different keys", () => {
    const a = buildOrderItemSnapshots(product, {
      variantId: "var-large",
      modifierIds: ["mod-ice-cream"],
      quantity: 1,
    });
    const b = buildOrderItemSnapshots(product, {
      variantId: "var-large",
      modifierIds: ["mod-ice-cream"],
      quantity: 1,
      notes: "Less Sugar",
    });
    expect(a.configurationKey).not.toBe(b.configurationKey);
  });
});
