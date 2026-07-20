import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { productSchema, variantSchema } from "@/features/menu/schemas";
import { getErrorMessage } from "@/lib/errors";
import { revalidatePublicMenuCache } from "@/lib/menu-cache";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function requireProductAdmin() {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  return { tenant, staff };
}

export async function updateProductService(
  id: string,
  input: unknown
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant } = await requireProductAdmin();
    await requirePlanFeature(tenant.restaurantId, "products");

    const data = productSchema.partial().parse(input);
    const existing = await prisma.product.findFirst({
      where: { id, restaurantId: tenant.restaurantId },
    });
    if (!existing) return { ok: false, error: "Product not found" };

    await prisma.product.update({
      where: { id },
      data: {
        ...data,
        nutritionInfo: data.nutritionInfo as Prisma.InputJsonValue | undefined,
        schedule: data.schedule as Prisma.InputJsonValue | undefined,
      } as Prisma.ProductUncheckedUpdateInput,
    });

    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: { id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteProductService(id: string): Promise<ServiceResult> {
  try {
    const { tenant, staff } = await requireProductAdmin();

    const existing = await prisma.product.findFirst({
      where: { id, restaurantId: tenant.restaurantId },
    });
    if (!existing) return { ok: false, error: "Product not found" };

    await prisma.product.delete({ where: { id } });
    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "DELETE",
        entity: "product",
        entityId: id,
      },
    });

    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createProductService(input: unknown): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant, staff } = await requireProductAdmin();
    await requirePlanFeature(tenant.restaurantId, "products");

    const data = productSchema.parse(input);
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, restaurantId: tenant.restaurantId },
    });
    if (!category) return { ok: false, error: "Category not found" };

    const maxOrder = await prisma.product.aggregate({
      where: { restaurantId: tenant.restaurantId, categoryId: data.categoryId },
      _max: { sortOrder: true },
    });

    const product = await prisma.product.create({
      data: {
        ...data,
        nutritionInfo: data.nutritionInfo as Prisma.InputJsonValue,
        schedule: data.schedule as Prisma.InputJsonValue,
        restaurantId: tenant.restaurantId,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "CREATE",
        entity: "product",
        entityId: product.id,
      },
    });

    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: { id: product.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function upsertVariantService(
  productId: string,
  input: unknown
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant } = await requireProductAdmin();

    const product = await prisma.product.findFirst({
      where: { id: productId, restaurantId: tenant.restaurantId },
    });
    if (!product) return { ok: false, error: "Product not found" };

    const data = variantSchema.parse(input);
    const maxOrder = await prisma.productVariant.aggregate({
      where: { productId, ...(data.groupId ? { groupId: data.groupId } : {}) },
      _max: { sortOrder: true },
    });

    let groupId = data.groupId;
    if (!groupId) {
      const existing = await prisma.productVariantGroup.findFirst({
        where: { productId },
        orderBy: { sortOrder: "asc" },
      });
      if (existing) groupId = existing.id;
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        groupId: groupId ?? undefined,
        name: data.name,
        price: data.price,
        sku: data.sku,
        prepTimeMinutes: data.prepTimeMinutes,
        isAvailable: data.isAvailable,
        isActive: data.isActive,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: { id: variant.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteVariantService(variantId: string): Promise<ServiceResult> {
  try {
    const { tenant } = await requireProductAdmin();

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, product: { restaurantId: tenant.restaurantId } },
    });
    if (!variant) return { ok: false, error: "Variant not found" };

    await prisma.productVariant.delete({ where: { id: variantId } });
    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function duplicateProductService(id: string): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant } = await requireProductAdmin();
    await requirePlanFeature(tenant.restaurantId, "products");

    const original = await prisma.product.findFirst({
      where: { id, restaurantId: tenant.restaurantId },
      include: { variants: true, images: true },
    });
    if (!original) return { ok: false, error: "Product not found" };

    const { id: _omitId, createdAt: _c, updatedAt: _u, ...productData } = original;

    const duplicate = await prisma.product.create({
      data: {
        ...productData,
        nutritionInfo: productData.nutritionInfo as Prisma.InputJsonValue,
        schedule: productData.schedule as Prisma.InputJsonValue,
        name: `${original.name} (Copy)`,
        variants: {
          create: original.variants.map(({ id: _vid, productId: _pid, branchPricing, ...v }) => ({
            ...v,
            branchPricing:
              branchPricing == null ? undefined : (branchPricing as Prisma.InputJsonValue),
          })),
        },
        images: {
          create: original.images.map(({ id: _iid, productId: _pid, ...img }) => img),
        },
      },
    });

    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: { id: duplicate.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function toggleProductVisibilityService(
  id: string
): Promise<ServiceResult<{ isHidden: boolean }>> {
  try {
    const { tenant } = await requireProductAdmin();

    const product = await prisma.product.findFirst({
      where: { id, restaurantId: tenant.restaurantId },
    });
    if (!product) return { ok: false, error: "Product not found" };

    const updated = await prisma.product.update({
      where: { id },
      data: { isHidden: !product.isHidden },
    });

    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: { isHidden: updated.isHidden } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function exportMenuService(): Promise<ServiceResult<{ base64: string }>> {
  try {
    const { tenant } = await requireProductAdmin();
    const ExcelJS = (await import("exceljs")).default;
    const { paiseToRupees } = await import("@/lib/utils");

    const categories = await prisma.category.findMany({
      where: { restaurantId: tenant.restaurantId },
      include: { products: { include: { variants: true } } },
      orderBy: { sortOrder: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Menu");

    sheet.columns = [
      { header: "Category", key: "category", width: 20 },
      { header: "Product", key: "product", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Price (₹)", key: "price", width: 15 },
      { header: "Dietary", key: "dietary", width: 12 },
      { header: "Variant", key: "variant", width: 15 },
      { header: "Variant Price (₹)", key: "variantPrice", width: 18 },
      { header: "SKU", key: "sku", width: 15 },
    ];

    for (const cat of categories) {
      for (const product of cat.products) {
        if (product.variants.length === 0) {
          sheet.addRow({
            category: cat.name,
            product: product.name,
            description: product.shortDescription || "",
            price: paiseToRupees(product.price),
            dietary: product.dietaryType,
            sku: product.sku || "",
          });
        } else {
          for (const variant of product.variants) {
            sheet.addRow({
              category: cat.name,
              product: product.name,
              description: product.shortDescription || "",
              price: paiseToRupees(product.price),
              dietary: product.dietaryType,
              variant: variant.name,
              variantPrice: paiseToRupees(variant.price),
              sku: product.sku || "",
            });
          }
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return { ok: true, data: { base64: Buffer.from(buffer).toString("base64") } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
