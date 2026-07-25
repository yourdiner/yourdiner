import { describe, expect, it } from "vitest";
import { priceLine } from "./price-line";
import { matchCombos } from "./match-combos";
import { priceOrder } from "./price-order";
import { isTimeInRange, isDayAllowed } from "./window";
import type { EnginePromotion } from "./types";
import type { ConfigurableProduct } from "@/features/product-config";

const coffee: ConfigurableProduct & { categoryId: string } = {
  id: "prod-coffee",
  name: "Cold Coffee",
  price: 15000,
  categoryId: "cat-drinks",
  variantGroups: [],
  modifierGroups: [
    {
      id: "mg1",
      name: "Add-ons",
      minSelect: 0,
      maxSelect: 2,
      isRequired: false,
      modifiers: [{ id: "mod-ice", name: "Ice Cream", price: 3000 }],
    },
  ],
};

function promo(partial: Partial<EnginePromotion> & Pick<EnginePromotion, "id" | "type" | "name">): EnginePromotion {
  return {
    restaurantId: "r1",
    billLabel: null,
    targetScope: "PRODUCTS",
    priority: 50,
    stackable: false,
    isActive: true,
    startDate: null,
    endDate: null,
    startTime: null,
    endTime: null,
    daysOfWeek: [],
    fixedPricePaise: null,
    percentOff: null,
    flatOffPaise: null,
    minOrderAmountPaise: null,
    targets: [{ productId: "prod-coffee", categoryId: null }],
    comboComponents: [],
    dayPrices: [],
    ...partial,
  };
}

describe("priceLine", () => {
  it("applies happy-hour fixed price to base only; modifiers unchanged", () => {
    const result = priceLine({
      product: coffee,
      selection: { modifierIds: ["mod-ice"], quantity: 1 },
      promotions: [
        promo({
          id: "hh",
          type: "TIME_PRICE",
          name: "Happy Hour",
          priority: 60,
          fixedPricePaise: 12000,
        }),
      ],
      now: new Date(),
      dayOfWeek: 1,
      minutesOfDay: 15 * 60,
    });

    expect(result.unitPrice).toBe(15000); // 12000 + 3000
    expect(result.originalUnitPrice).toBe(18000);
    expect(result.promotionDiscountPaise).toBe(3000);
    expect(result.promotionId).toBe("hh");
  });

  it("respects priority and non-stackable stop", () => {
    const result = priceLine({
      product: coffee,
      selection: { modifierIds: [], quantity: 1 },
      promotions: [
        promo({
          id: "fest",
          type: "PERCENT",
          name: "Festival",
          priority: 100,
          percentOff: 20,
          stackable: false,
        }),
        promo({
          id: "extra",
          type: "FLAT",
          name: "Extra",
          priority: 40,
          flatOffPaise: 1000,
          stackable: true,
        }),
      ],
      now: new Date(),
      dayOfWeek: 1,
      minutesOfDay: 12 * 60,
    });

    expect(result.unitPrice).toBe(12000); // 20% of 15000
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].promotionId).toBe("fest");
  });

  it("stacks when stackable is true", () => {
    const result = priceLine({
      product: coffee,
      selection: { modifierIds: [], quantity: 1 },
      promotions: [
        promo({
          id: "p1",
          type: "PERCENT",
          name: "P1",
          priority: 80,
          percentOff: 10,
          stackable: true,
        }),
        promo({
          id: "p2",
          type: "FLAT",
          name: "P2",
          priority: 40,
          flatOffPaise: 500,
          stackable: true,
        }),
      ],
      now: new Date(),
      dayOfWeek: 1,
      minutesOfDay: 12 * 60,
    });

    // 15000 * 10% = 13500, then -500 = 13000
    expect(result.unitPrice).toBe(13000);
    expect(result.applied).toHaveLength(2);
  });
});

describe("matchCombos", () => {
  it("matches burger+coke and redistributes combo price", () => {
    const combo = promo({
      id: "combo1",
      type: "COMBO",
      name: "Burger Combo",
      billLabel: "Burger Combo",
      priority: 90,
      fixedPricePaise: 7900,
      targets: [],
      comboComponents: [
        { productId: "burger", quantity: 1, sortOrder: 0 },
        { productId: "coke", quantity: 1, sortOrder: 1 },
      ],
    });

    const matched = matchCombos(
      [
        {
          productId: "burger",
          quantity: 1,
          unitPrice: 10000,
          totalPrice: 10000,
          originalUnitPrice: 10000,
          name: "Burger",
        },
        {
          productId: "coke",
          quantity: 1,
          unitPrice: 4000,
          totalPrice: 4000,
          originalUnitPrice: 4000,
          name: "Coke",
        },
      ],
      [combo]
    );

    const sum = matched.reduce((s, l) => s + l.totalPrice, 0);
    expect(sum).toBe(7900);
    expect(matched.every((l) => l.comboGroupId)).toBe(true);
    expect(matched[0].billDisplayName).toBe("Burger Combo");
    expect(matched[0].name).toBe("Burger");
  });
});

describe("priceOrder", () => {
  it("applies bill flat discount with min spend", () => {
    const result = priceOrder({
      lineTotalPaise: 100000,
      taxSettings: { taxPercent: 5, taxInclusive: false },
      billPromotions: [
        promo({
          id: "bill",
          type: "BILL_FLAT",
          name: "₹100 Off",
          flatOffPaise: 10000,
          minOrderAmountPaise: 100000,
          targets: [],
        }),
      ],
      manualDiscountPaise: 0,
    });

    expect(result.promotionDiscountAmount).toBe(10000);
    expect(result.taxAmount).toBe(5000);
    expect(result.total).toBe(95000); // 100000 + 5000 - 10000
  });
});

describe("window helpers", () => {
  it("handles overnight time ranges", () => {
    expect(isTimeInRange(23 * 60, "22:00", "02:00")).toBe(true);
    expect(isTimeInRange(1 * 60, "22:00", "02:00")).toBe(true);
    expect(isTimeInRange(12 * 60, "22:00", "02:00")).toBe(false);
  });

  it("empty days means all days", () => {
    expect(isDayAllowed(3, [])).toBe(true);
    expect(isDayAllowed(3, [5, 6])).toBe(false);
  });
});
