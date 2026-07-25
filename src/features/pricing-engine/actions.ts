"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/errors";
import {
  createPromotionForRestaurant,
  duplicatePromotion,
  getPromotionForRestaurant,
  hardDeletePromotion,
  listPromotionsForRestaurant,
  previewPromotionPrice,
  setPromotionActive,
  softDeletePromotion,
  updatePromotionForRestaurant,
} from "./promotion.service";

async function requirePromotionsAccess() {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "promotions");
  return { tenant, staff };
}

export async function getPromotions() {
  const { tenant } = await requirePromotionsAccess();
  return listPromotionsForRestaurant(tenant.restaurantId);
}

export async function getPromotion(id: string) {
  const { tenant } = await requirePromotionsAccess();
  return getPromotionForRestaurant(tenant.restaurantId, id);
}

export async function createPromotion(input: unknown) {
  try {
    const { tenant, staff } = await requirePromotionsAccess();
    const promo = await createPromotionForRestaurant(tenant.restaurantId, input);
    const { prisma } = await import("@/lib/db");
    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "CREATE",
        entity: "promotion",
        entityId: promo.id,
      },
    });
    revalidatePath("/dashboard/promotions");
    revalidatePath("/admin/promotions");
    return { ok: true as const, promotion: promo };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function updatePromotion(id: string, input: unknown) {
  try {
    const { tenant, staff } = await requirePromotionsAccess();
    const promo = await updatePromotionForRestaurant(tenant.restaurantId, id, input);
    const { prisma } = await import("@/lib/db");
    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "UPDATE",
        entity: "promotion",
        entityId: id,
      },
    });
    revalidatePath("/dashboard/promotions");
    revalidatePath("/admin/promotions");
    return { ok: true as const, promotion: promo };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function togglePromotion(id: string, isActive: boolean) {
  try {
    const { tenant } = await requirePromotionsAccess();
    await setPromotionActive(tenant.restaurantId, id, isActive);
    revalidatePath("/dashboard/promotions");
    revalidatePath("/admin/promotions");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function deletePromotion(id: string, hard = false) {
  try {
    const { tenant } = await requirePromotionsAccess();
    if (hard) {
      await hardDeletePromotion(tenant.restaurantId, id);
    } else {
      await softDeletePromotion(tenant.restaurantId, id);
    }
    revalidatePath("/dashboard/promotions");
    revalidatePath("/admin/promotions");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function duplicatePromotionAction(id: string) {
  try {
    const { tenant } = await requirePromotionsAccess();
    const promo = await duplicatePromotion(tenant.restaurantId, id);
    revalidatePath("/dashboard/promotions");
    revalidatePath("/admin/promotions");
    return { ok: true as const, promotion: promo };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function previewPromotion(promotionId: string, productId: string) {
  try {
    const { tenant } = await requirePromotionsAccess();
    const preview = await previewPromotionPrice(tenant.restaurantId, promotionId, productId);
    return { ok: true as const, preview };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function getPromotionPickerData() {
  const { tenant } = await requirePromotionsAccess();
  const { prisma } = await import("@/lib/db");
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId: tenant.restaurantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.findMany({
      where: { restaurantId: tenant.restaurantId, isAvailable: true, isHidden: false },
      select: { id: true, name: true, categoryId: true, price: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return { categories, products };
}
