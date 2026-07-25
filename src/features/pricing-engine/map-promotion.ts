import type {
  Promotion,
  PromotionComboComponent,
  PromotionDayPrice,
  PromotionTarget,
} from "@prisma/client";
import type { EnginePromotion } from "./types";

export type PrismaPromotionWithRelations = Promotion & {
  targets: PromotionTarget[];
  comboComponents: PromotionComboComponent[];
  dayPrices: PromotionDayPrice[];
};

export function mapPromotionToEngine(p: PrismaPromotionWithRelations): EnginePromotion {
  return {
    id: p.id,
    restaurantId: p.restaurantId,
    name: p.name,
    billLabel: p.billLabel,
    type: p.type,
    targetScope: p.targetScope,
    priority: p.priority,
    stackable: p.stackable,
    isActive: p.isActive,
    startDate: p.startDate,
    endDate: p.endDate,
    startTime: p.startTime,
    endTime: p.endTime,
    daysOfWeek: p.daysOfWeek ?? [],
    fixedPricePaise: p.fixedPricePaise,
    percentOff: p.percentOff,
    flatOffPaise: p.flatOffPaise,
    minOrderAmountPaise: p.minOrderAmountPaise,
    targets: p.targets.map((t) => ({
      productId: t.productId,
      categoryId: t.categoryId,
    })),
    comboComponents: p.comboComponents.map((c) => ({
      productId: c.productId,
      quantity: c.quantity,
      sortOrder: c.sortOrder,
    })),
    dayPrices: p.dayPrices.map((d) => ({
      daysOfWeek: d.daysOfWeek ?? [],
      fixedPricePaise: d.fixedPricePaise,
    })),
  };
}
