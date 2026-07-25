import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  buildOrderItemSnapshots,
  validateSelection,
  type ProductSelection,
} from "@/features/product-config";
import {
  mapPrismaProductToConfigurable,
  PRODUCT_CONFIG_INCLUDE,
} from "@/features/product-config/map-product";
import { loadActivePromotions, getRestaurantPricingClock } from "@/features/pricing-engine/load-active";

export type OrderItemConfigInput = {
  variantId?: string | null;
  modifierIds?: string[];
  quantity: number;
  notes?: string;
  kitchenNotes?: string;
};

export async function loadConfigurableProduct(productId: string, restaurantId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId, isAvailable: true },
    include: PRODUCT_CONFIG_INCLUDE,
  });
  if (!product) return null;
  return mapPrismaProductToConfigurable(product);
}

export async function resolveOrderItemFromProduct(
  productId: string,
  restaurantId: string,
  input: OrderItemConfigInput
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId, isAvailable: true },
    include: PRODUCT_CONFIG_INCLUDE,
  });
  if (!product) throw new AppError("Product not found", "NOT_FOUND", 404);

  const configurable = mapPrismaProductToConfigurable(product);

  const selection: ProductSelection = {
    variantId: input.variantId ?? null,
    modifierIds: input.modifierIds ?? [],
    quantity: input.quantity,
    notes: input.notes,
    kitchenNotes: input.kitchenNotes,
  };

  const validation = validateSelection(configurable, selection);
  if (!validation.valid) {
    throw new AppError(validation.errors[0] ?? "Invalid selection", "VALIDATION", 400);
  }

  const [{ clock }, promotions] = await Promise.all([
    getRestaurantPricingClock(restaurantId),
    loadActivePromotions(restaurantId, {
      productIds: [productId],
      categoryIds: product.categoryId ? [product.categoryId] : [],
    }),
  ]);

  return buildOrderItemSnapshots(configurable, selection, {
    promotions,
    dayOfWeek: clock.dayOfWeek,
    minutesOfDay: clock.minutesOfDay,
    now: clock.instant,
  });
}
