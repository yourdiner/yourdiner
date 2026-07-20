import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { categorySchema, reorderSchema } from "@/features/menu/schemas";
import { getErrorMessage } from "@/lib/errors";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function requireCategoryAdmin() {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  return { tenant, staff };
}

export async function createCategoryService(input: unknown): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant, staff } = await requireCategoryAdmin();
    await requirePlanFeature(tenant.restaurantId, "categories");

    const data = categorySchema.parse(input);
    const maxOrder = await prisma.category.aggregate({
      where: { restaurantId: tenant.restaurantId },
      _max: { sortOrder: true },
    });

    const category = await prisma.category.create({
      data: {
        ...data,
        restaurantId: tenant.restaurantId,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "CREATE",
        entity: "category",
        entityId: category.id,
      },
    });

    return { ok: true, data: { id: category.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteCategoryService(id: string): Promise<ServiceResult> {
  try {
    const { tenant, staff } = await requireCategoryAdmin();

    const existing = await prisma.category.findFirst({
      where: { id, restaurantId: tenant.restaurantId },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) return { ok: false, error: "Category not found" };
    if (existing._count.products > 0) {
      return { ok: false, error: "Cannot delete category with products" };
    }

    await prisma.category.delete({ where: { id } });
    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "DELETE",
        entity: "category",
        entityId: id,
      },
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function reorderCategoriesService(input: unknown): Promise<ServiceResult> {
  try {
    const { tenant } = await requireCategoryAdmin();
    const { items } = reorderSchema.parse(input);

    await prisma.$transaction(
      items.map((item) =>
        prisma.category.updateMany({
          where: { id: item.id, restaurantId: tenant.restaurantId },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
