import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  promotionUpsertSchema,
  type PromotionUpsertInput,
} from "@/features/pricing-engine/validations";
import { invalidateRestaurantPromoCache } from "@/features/pricing-engine/cache";
import { priceLine } from "@/features/pricing-engine/price-line";
import { mapPromotionToEngine } from "@/features/pricing-engine/map-promotion";
import { getLocalClock } from "@/features/pricing-engine/window";
import { getRestaurantSettingsCached } from "@/lib/request-cache";
import { mapPrismaProductToConfigurable, PRODUCT_CONFIG_INCLUDE } from "@/features/product-config/map-product";

const PROMO_INCLUDE = {
  targets: {
    include: {
      product: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  },
  comboComponents: {
    orderBy: { sortOrder: "asc" as const },
    include: { product: { select: { id: true, name: true, price: true } } },
  },
  dayPrices: true,
} as const;

export function computePromotionStatus(
  promo: {
    isActive: boolean;
    startDate: Date | null;
    endDate: Date | null;
  },
  now = new Date()
): "Active" | "Scheduled" | "Expired" | "Disabled" {
  if (!promo.isActive) return "Disabled";
  if (promo.startDate && promo.startDate > now) return "Scheduled";
  if (promo.endDate && promo.endDate < now) return "Expired";
  return "Active";
}

export async function listPromotionsForRestaurant(restaurantId: string) {
  const rows = await prisma.promotion.findMany({
    where: { restaurantId },
    include: PROMO_INCLUDE,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map((p) => ({
    ...p,
    status: computePromotionStatus(p),
  }));
}

export async function getPromotionForRestaurant(restaurantId: string, id: string) {
  const promo = await prisma.promotion.findFirst({
    where: { id, restaurantId },
    include: PROMO_INCLUDE,
  });
  if (!promo) throw new AppError("Promotion not found", "NOT_FOUND", 404);
  return { ...promo, status: computePromotionStatus(promo) };
}

async function assertTargetsBelongToRestaurant(
  restaurantId: string,
  data: PromotionUpsertInput
) {
  const productIds = [
    ...data.targets.map((t) => t.productId).filter(Boolean),
    ...data.comboComponents.map((c) => c.productId),
  ] as string[];
  const categoryIds = data.targets.map((t) => t.categoryId).filter(Boolean) as string[];

  if (productIds.length) {
    const unique = [...new Set(productIds)];
    const count = await prisma.product.count({
      where: { restaurantId, id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new AppError("One or more products do not belong to this restaurant", "VALIDATION", 400);
    }
  }
  if (categoryIds.length) {
    const unique = [...new Set(categoryIds)];
    const count = await prisma.category.count({
      where: { restaurantId, id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new AppError("One or more categories do not belong to this restaurant", "VALIDATION", 400);
    }
  }
}

function buildNestedCreate(data: PromotionUpsertInput) {
  return {
    targets:
      data.targetScope === "ENTIRE_MENU" || data.type === "COMBO" || data.type.startsWith("BILL_")
        ? undefined
        : {
            create: data.targets.map((t) => ({
              productId: t.productId ?? null,
              categoryId: t.categoryId ?? null,
            })),
          },
    comboComponents:
      data.type === "COMBO"
        ? {
            create: data.comboComponents.map((c, i) => ({
              productId: c.productId,
              quantity: c.quantity,
              sortOrder: c.sortOrder ?? i,
            })),
          }
        : undefined,
    dayPrices:
      data.type === "DAY_PRICE"
        ? {
            create: data.dayPrices.map((d) => ({
              daysOfWeek: d.daysOfWeek,
              fixedPricePaise: d.fixedPricePaise,
            })),
          }
        : undefined,
  };
}

export async function createPromotionForRestaurant(
  restaurantId: string,
  input: unknown
) {
  const data = promotionUpsertSchema.parse(input);
  await assertTargetsBelongToRestaurant(restaurantId, data);

  const promo = await prisma.promotion.create({
    data: {
      restaurantId,
      name: data.name,
      description: data.description ?? null,
      billLabel: data.billLabel ?? null,
      type: data.type,
      targetScope: data.targetScope,
      priority: data.priority,
      stackable: data.stackable,
      isActive: data.isActive,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      daysOfWeek: data.daysOfWeek,
      fixedPricePaise: data.fixedPricePaise ?? null,
      percentOff: data.percentOff ?? null,
      flatOffPaise: data.flatOffPaise ?? null,
      minOrderAmountPaise: data.minOrderAmountPaise ?? null,
      ...buildNestedCreate(data),
    },
    include: PROMO_INCLUDE,
  });

  invalidateRestaurantPromoCache(restaurantId);
  return promo;
}

export async function updatePromotionForRestaurant(
  restaurantId: string,
  id: string,
  input: unknown
) {
  const data = promotionUpsertSchema.parse(input);
  await assertTargetsBelongToRestaurant(restaurantId, data);

  const existing = await prisma.promotion.findFirst({
    where: { id, restaurantId },
  });
  if (!existing) throw new AppError("Promotion not found", "NOT_FOUND", 404);

  await prisma.$transaction(async (tx) => {
    await tx.promotionTarget.deleteMany({ where: { promotionId: id } });
    await tx.promotionComboComponent.deleteMany({ where: { promotionId: id } });
    await tx.promotionDayPrice.deleteMany({ where: { promotionId: id } });

    await tx.promotion.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
        billLabel: data.billLabel ?? null,
        type: data.type,
        targetScope: data.targetScope,
        priority: data.priority,
        stackable: data.stackable,
        isActive: data.isActive,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        daysOfWeek: data.daysOfWeek,
        fixedPricePaise: data.fixedPricePaise ?? null,
        percentOff: data.percentOff ?? null,
        flatOffPaise: data.flatOffPaise ?? null,
        minOrderAmountPaise: data.minOrderAmountPaise ?? null,
        ...buildNestedCreate(data),
      },
    });
  });

  invalidateRestaurantPromoCache(restaurantId);
  return getPromotionForRestaurant(restaurantId, id);
}

export async function setPromotionActive(
  restaurantId: string,
  id: string,
  isActive: boolean
) {
  const existing = await prisma.promotion.findFirst({
    where: { id, restaurantId },
  });
  if (!existing) throw new AppError("Promotion not found", "NOT_FOUND", 404);

  const promo = await prisma.promotion.update({
    where: { id },
    data: { isActive },
    include: PROMO_INCLUDE,
  });
  invalidateRestaurantPromoCache(restaurantId);
  return promo;
}

export async function softDeletePromotion(restaurantId: string, id: string) {
  // Soft-delete: disable and keep history. Detach FK from future orders by nulling is not needed.
  return setPromotionActive(restaurantId, id, false);
}

export async function hardDeletePromotion(restaurantId: string, id: string) {
  const existing = await prisma.promotion.findFirst({
    where: { id, restaurantId },
  });
  if (!existing) throw new AppError("Promotion not found", "NOT_FOUND", 404);

  // Null promotionId on order items but keep snapshots
  await prisma.$transaction([
    prisma.orderItem.updateMany({
      where: { promotionId: id },
      data: { promotionId: null },
    }),
    prisma.promotion.delete({ where: { id } }),
  ]);
  invalidateRestaurantPromoCache(restaurantId);
}

export async function duplicatePromotion(restaurantId: string, id: string) {
  const source = await getPromotionForRestaurant(restaurantId, id);
  return createPromotionForRestaurant(restaurantId, {
    name: `${source.name} (Copy)`,
    description: source.description,
    billLabel: source.billLabel,
    type: source.type,
    targetScope: source.targetScope,
    priority: source.priority,
    stackable: source.stackable,
    isActive: false,
    startDate: source.startDate,
    endDate: source.endDate,
    startTime: source.startTime,
    endTime: source.endTime,
    daysOfWeek: source.daysOfWeek,
    fixedPricePaise: source.fixedPricePaise,
    percentOff: source.percentOff,
    flatOffPaise: source.flatOffPaise,
    minOrderAmountPaise: source.minOrderAmountPaise,
    targets: source.targets.map((t) => ({
      productId: t.productId,
      categoryId: t.categoryId,
    })),
    comboComponents: source.comboComponents.map((c) => ({
      productId: c.productId,
      quantity: c.quantity,
      sortOrder: c.sortOrder,
    })),
    dayPrices: source.dayPrices.map((d) => ({
      daysOfWeek: d.daysOfWeek,
      fixedPricePaise: d.fixedPricePaise,
    })),
  });
}

export async function previewPromotionPrice(
  restaurantId: string,
  promotionId: string,
  productId: string
) {
  const promo = await prisma.promotion.findFirst({
    where: { id: promotionId, restaurantId },
    include: {
      targets: true,
      comboComponents: true,
      dayPrices: true,
    },
  });
  if (!promo) throw new AppError("Promotion not found", "NOT_FOUND", 404);

  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId },
    include: PRODUCT_CONFIG_INCLUDE,
  });
  if (!product) throw new AppError("Product not found", "NOT_FOUND", 404);

  const settings = await getRestaurantSettingsCached(restaurantId);
  const timeZone = settings?.timezone || "Asia/Kolkata";
  const clock = getLocalClock(new Date(), timeZone);
  const engine = mapPromotionToEngine(promo);
  const configurable = mapPrismaProductToConfigurable(product);

  const priced = priceLine({
    product: configurable,
    selection: { modifierIds: [], quantity: 1 },
    promotions: [engine],
    now: clock.instant,
    dayOfWeek: clock.dayOfWeek,
    minutesOfDay: clock.minutesOfDay,
  });

  return {
    productName: product.name,
    originalUnitPrice: priced.originalUnitPrice,
    unitPrice: priced.unitPrice,
    discountPaise: priced.promotionDiscountPaise,
    promotionName: priced.promotionNameSnapshot,
  };
}

export type { PromotionUpsertInput };
