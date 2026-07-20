"use server";

import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import {
  categorySchema,
  productSchema,
  variantSchema,
  modifierGroupSchema,
  reorderSchema,
} from "@/features/menu/schemas";
import { AppError } from "@/lib/errors";
import { paiseToRupees } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { revalidatePublicMenuCache } from "@/lib/menu-cache";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";

// ─── Categories ─────────────────────────────────────────────────────────────

export async function getCategories() {
  const tenant = await requireTenantContext();
  return prisma.category.findMany({
    where: { restaurantId: tenant.restaurantId },
    include: { image: true, _count: { select: { products: true } } },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCategory(input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
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
    include: { image: true },
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

  revalidatePath("/dashboard/categories");
  revalidatePublicMenuCache(tenant.restaurantId);
  return category;
}

export async function updateCategory(id: string, input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "categories");

  const data = categorySchema.partial().parse(input);

  const existing = await prisma.category.findFirst({
    where: { id, restaurantId: tenant.restaurantId },
  });
  if (!existing) throw new AppError("Category not found", "NOT_FOUND", 404);

  const category = await prisma.category.update({
    where: { id },
    data,
    include: { image: true },
  });

  revalidatePath("/dashboard/categories");
  revalidatePublicMenuCache(tenant.restaurantId);
  return category;
}

export async function deleteCategory(id: string) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const existing = await prisma.category.findFirst({
    where: { id, restaurantId: tenant.restaurantId },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) throw new AppError("Category not found", "NOT_FOUND", 404);
  if (existing._count.products > 0) {
    throw new AppError("Cannot delete category with products", "HAS_PRODUCTS", 400);
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

  revalidatePath("/dashboard/categories");
  revalidatePublicMenuCache(tenant.restaurantId);
}

export async function reorderCategories(input: unknown) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const { items } = reorderSchema.parse(input);

  await prisma.$transaction(
    items.map((item) =>
      prisma.category.updateMany({
        where: { id: item.id, restaurantId: tenant.restaurantId },
        data: { sortOrder: item.sortOrder },
      })
    )
  );

  revalidatePath("/dashboard/categories");
  revalidatePublicMenuCache(tenant.restaurantId);
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(params?: {
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: "default" | "price_asc" | "price_desc";
}) {
  const tenant = await requireTenantContext();
  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const skip = (page - 1) * limit;

  const where = {
    restaurantId: tenant.restaurantId,
    ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params?.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" as const } },
            { searchKeywords: { has: params.search.toLowerCase() } },
          ],
        }
      : {}),
  };

  const orderBy =
    params?.sort === "price_asc"
      ? [{ price: "asc" as const }]
      : params?.sort === "price_desc"
        ? [{ price: "desc" as const }]
        : [{ sortOrder: "asc" as const }, { displayPriority: "desc" as const }];

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        discountPrice: true,
        shortDescription: true,
        dietaryType: true,
        isAvailable: true,
        isHidden: true,
        isFeatured: true,
        isBestSeller: true,
        category: { select: { id: true, name: true } },
        variants: {
          select: { id: true, name: true, price: true },
          orderBy: { sortOrder: "asc" },
        },
        images: {
          take: 1,
          orderBy: { sortOrder: "asc" },
          select: { media: { select: { url: true } } },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total, page, limit };
}

export async function getProductById(id: string) {
  const tenant = await requireTenantContext();

  const product = await prisma.product.findFirst({
    where: { id, restaurantId: tenant.restaurantId },
    include: {
      category: true,
      variantGroups: {
        orderBy: { sortOrder: "asc" },
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      },
      variants: { orderBy: { sortOrder: "asc" } },
      images: { include: { media: true }, orderBy: { sortOrder: "asc" } },
      modifierGroups: { include: { group: { include: { modifiers: true } } } },
      tax: true,
    },
  });

  if (!product) throw new AppError("Product not found", "NOT_FOUND", 404);
  return product;
}

export async function createProduct(input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "products");

  const data = productSchema.parse(input);

  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, restaurantId: tenant.restaurantId },
  });
  if (!category) throw new AppError("Category not found", "NOT_FOUND", 404);

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
    include: { category: true, variants: true, images: { include: { media: true } } },
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

  revalidatePath("/dashboard/products");
  revalidatePublicMenuCache(tenant.restaurantId);
  return product;
}

export async function updateProduct(id: string, input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "products");

  const data = productSchema.partial().parse(input);

  const existing = await prisma.product.findFirst({
    where: { id, restaurantId: tenant.restaurantId },
  });
  if (!existing) throw new AppError("Product not found", "NOT_FOUND", 404);

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      nutritionInfo: data.nutritionInfo as Prisma.InputJsonValue | undefined,
      schedule: data.schedule as Prisma.InputJsonValue | undefined,
    } as Prisma.ProductUncheckedUpdateInput,
    include: { category: true, variants: true, images: { include: { media: true } } },
  });

  revalidatePath("/dashboard/products");
  revalidatePublicMenuCache(tenant.restaurantId);
  return product;
}

export async function deleteProduct(id: string) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const existing = await prisma.product.findFirst({
    where: { id, restaurantId: tenant.restaurantId },
  });
  if (!existing) throw new AppError("Product not found", "NOT_FOUND", 404);

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

  revalidatePath("/dashboard/products");
  revalidatePublicMenuCache(tenant.restaurantId);
}

export async function duplicateProduct(id: string) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "products");

  const original = await prisma.product.findFirst({
    where: { id, restaurantId: tenant.restaurantId },
    include: { variants: true, images: true },
  });
  if (!original) throw new AppError("Product not found", "NOT_FOUND", 404);

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
    include: { variants: true, images: { include: { media: true } } },
  });

  revalidatePath("/dashboard/products");
  revalidatePublicMenuCache(tenant.restaurantId);
  return duplicate;
}

export async function toggleProductVisibility(id: string) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const product = await prisma.product.findFirst({
    where: { id, restaurantId: tenant.restaurantId },
  });
  if (!product) throw new AppError("Product not found", "NOT_FOUND", 404);

  const updated = await prisma.product.update({
    where: { id },
    data: { isHidden: !product.isHidden },
  });

  revalidatePath("/dashboard/products");
  revalidatePublicMenuCache(tenant.restaurantId);
  return updated;
}

export async function reorderProducts(input: unknown) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const { items } = reorderSchema.parse(input);

  await prisma.$transaction(
    items.map((item) =>
      prisma.product.updateMany({
        where: { id: item.id, restaurantId: tenant.restaurantId },
        data: { sortOrder: item.sortOrder },
      })
    )
  );

  revalidatePath("/dashboard/products");
  revalidatePublicMenuCache(tenant.restaurantId);
}

// ─── Variants ─────────────────────────────────────────────────────────────────

export async function upsertVariant(productId: string, input: unknown, variantId?: string) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId: tenant.restaurantId },
  });
  if (!product) throw new AppError("Product not found", "NOT_FOUND", 404);

  const data = variantSchema.parse(input);

  if (variantId) {
    return prisma.productVariant.update({ where: { id: variantId }, data });
  }

  const maxOrder = await prisma.productVariant.aggregate({
    where: { productId },
    _max: { sortOrder: true },
  });

  return prisma.productVariant.create({
    data: { ...data, productId, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
}

export async function deleteVariant(variantId: string) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, product: { restaurantId: tenant.restaurantId } },
  });
  if (!variant) throw new AppError("Variant not found", "NOT_FOUND", 404);

  await prisma.productVariant.delete({ where: { id: variantId } });
  revalidatePath("/dashboard/products");
  revalidatePublicMenuCache(tenant.restaurantId);
}

// ─── Modifier Groups ──────────────────────────────────────────────────────────

export async function getModifierGroups() {
  const tenant = await requireTenantContext();
  return prisma.modifierGroup.findMany({
    where: { restaurantId: tenant.restaurantId },
    include: { modifiers: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createModifierGroup(input: unknown) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const data = modifierGroupSchema.parse(input);
  const { modifiers, ...groupData } = data;

  const group = await prisma.modifierGroup.create({
    data: {
      ...groupData,
      restaurantId: tenant.restaurantId,
      modifiers: {
        create: modifiers.map((m, i) => ({ ...m, sortOrder: i })),
      },
    },
    include: { modifiers: true },
  });

  revalidatePath("/dashboard/products");
  revalidatePublicMenuCache(tenant.restaurantId);
  return group;
}

// ─── Public Menu ──────────────────────────────────────────────────────────────

export { revalidatePublicMenuCache };

export async function getPublicMenu(restaurantId: string) {
  const { getCachedPublicMenu } = await import("@/lib/menu-cache");
  return getCachedPublicMenu(restaurantId);
}

export async function searchPublicMenu(restaurantId: string, query: string) {
  const { searchMenuProductCards } = await import("@/lib/menu-catalog");
  return searchMenuProductCards(restaurantId, query, "public");
}

// ─── Import / Export ──────────────────────────────────────────────────────────

export async function exportMenuToExcel() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

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
    { header: "Variant Add-on (₹)", key: "variantPrice", width: 18 },
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
  return Buffer.from(buffer).toString("base64");
}

export async function addProductImage(productId: string, mediaId: string, isPrimary = false) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId: tenant.restaurantId },
  });
  if (!product) throw new AppError("Product not found", "NOT_FOUND", 404);

  if (isPrimary) {
    await prisma.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });
  }

  const maxOrder = await prisma.productImage.aggregate({
    where: { productId },
    _max: { sortOrder: true },
  });

  return prisma.productImage.create({
    data: {
      productId,
      mediaId,
      isPrimary,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    include: { media: true },
  });
}

export async function removeProductImage(productImageId: string) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const image = await prisma.productImage.findFirst({
    where: { id: productImageId, product: { restaurantId: tenant.restaurantId } },
  });
  if (!image) throw new AppError("Image not found", "NOT_FOUND", 404);

  await prisma.productImage.delete({ where: { id: productImageId } });
  revalidatePath("/dashboard/products");
  revalidatePublicMenuCache(tenant.restaurantId);
}

export async function getTaxes() {
  const tenant = await requireTenantContext();
  return prisma.tax.findMany({ where: { restaurantId: tenant.restaurantId } });
}
