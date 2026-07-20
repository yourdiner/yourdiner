import { prisma } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { revalidatePublicMenuCache } from "@/lib/menu-cache";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import {
  variantGroupSchema,
  variantSchema,
  modifierGroupCreateSchema,
  modifierGroupSchema,
  modifierSchema,
} from "@/features/menu/schemas";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function requireProductAdmin() {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  return { tenant, staff };
}

async function assertProduct(productId: string, restaurantId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId },
  });
  if (!product) throw new Error("Product not found");
  return product;
}

export async function createVariantGroupService(
  productId: string,
  input: unknown
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant } = await requireProductAdmin();
    await assertProduct(productId, tenant.restaurantId);
    const data = variantGroupSchema.parse(input);
    const maxOrder = await prisma.productVariantGroup.aggregate({
      where: { productId },
      _max: { sortOrder: true },
    });
    const group = await prisma.productVariantGroup.create({
      data: {
        ...data,
        productId,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: { id: group.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteVariantGroupService(
  groupId: string
): Promise<ServiceResult> {
  try {
    const { tenant } = await requireProductAdmin();
    const group = await prisma.productVariantGroup.findFirst({
      where: { id: groupId, product: { restaurantId: tenant.restaurantId } },
    });
    if (!group) return { ok: false, error: "Variant group not found" };
    await prisma.productVariantGroup.delete({ where: { id: groupId } });
    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function addVariantToGroupService(
  productId: string,
  input: unknown
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant } = await requireProductAdmin();
    await assertProduct(productId, tenant.restaurantId);
    const data = variantSchema.parse(input);

    let groupId = data.groupId;
    if (!groupId) {
      const existing = await prisma.productVariantGroup.findFirst({
        where: { productId },
        orderBy: { sortOrder: "asc" },
      });
      if (existing) {
        groupId = existing.id;
      } else {
        const created = await prisma.productVariantGroup.create({
          data: { productId, name: "Size", isRequired: true, sortOrder: 0 },
        });
        groupId = created.id;
      }
    }

    const maxOrder = await prisma.productVariant.aggregate({
      where: { productId, groupId },
      _max: { sortOrder: true },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        groupId,
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

export async function linkModifierGroupToProductService(
  productId: string,
  groupId: string
): Promise<ServiceResult> {
  try {
    const { tenant } = await requireProductAdmin();
    await assertProduct(productId, tenant.restaurantId);
    const group = await prisma.modifierGroup.findFirst({
      where: { id: groupId, restaurantId: tenant.restaurantId },
    });
    if (!group) return { ok: false, error: "Modifier group not found" };

    await prisma.productModifierGroup.upsert({
      where: { productId_groupId: { productId, groupId } },
      create: { productId, groupId },
      update: {},
    });

    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function unlinkModifierGroupFromProductService(
  productId: string,
  groupId: string
): Promise<ServiceResult> {
  try {
    const { tenant } = await requireProductAdmin();
    await assertProduct(productId, tenant.restaurantId);
    await prisma.productModifierGroup.deleteMany({ where: { productId, groupId } });
    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createModifierGroupForProductService(
  productId: string,
  input: unknown
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant } = await requireProductAdmin();
    await assertProduct(productId, tenant.restaurantId);

    const parsed = modifierGroupSchema.safeParse(input);
    const data = parsed.success
      ? parsed.data
      : { ...modifierGroupCreateSchema.parse(input), modifiers: [] as Array<{ name: string; price: number }> };
    const { modifiers, ...groupData } = data;

    const maxOrder = await prisma.modifierGroup.aggregate({
      where: { restaurantId: tenant.restaurantId },
      _max: { sortOrder: true },
    });

    const group = await prisma.modifierGroup.create({
      data: {
        ...groupData,
        maxSelect: groupData.maxSelect || Math.max(modifiers.length, 99),
        restaurantId: tenant.restaurantId,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        modifiers: {
          create: modifiers.map((m, i) => ({ ...m, sortOrder: i })),
        },
      },
    });

    await prisma.productModifierGroup.create({
      data: { productId, groupId: group.id },
    });

    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: { id: group.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function addModifierToGroupService(
  groupId: string,
  input: unknown
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant } = await requireProductAdmin();
    const data = modifierSchema.parse(input);
    if (data.groupId !== groupId) {
      return { ok: false, error: "Group mismatch" };
    }

    const group = await prisma.modifierGroup.findFirst({
      where: { id: groupId, restaurantId: tenant.restaurantId },
    });
    if (!group) return { ok: false, error: "Modifier group not found" };

    const maxOrder = await prisma.modifier.aggregate({
      where: { groupId },
      _max: { sortOrder: true },
    });

    const modifier = await prisma.modifier.create({
      data: {
        groupId,
        name: data.name,
        price: data.price,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: { id: modifier.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteModifierService(modifierId: string): Promise<ServiceResult> {
  try {
    const { tenant } = await requireProductAdmin();
    const modifier = await prisma.modifier.findFirst({
      where: { id: modifierId, group: { restaurantId: tenant.restaurantId } },
    });
    if (!modifier) return { ok: false, error: "Modifier not found" };

    await prisma.modifier.delete({ where: { id: modifierId } });
    revalidatePublicMenuCache(tenant.restaurantId);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function listRestaurantModifierGroupsService(): Promise<
  ServiceResult<
    Array<{
      id: string;
      name: string;
      minSelect: number;
      maxSelect: number;
      isRequired: boolean;
      modifiers: Array<{ id: string; name: string; price: number }>;
    }>
  >
> {
  try {
    const { tenant } = await requireProductAdmin();
    const groups = await prisma.modifierGroup.findMany({
      where: { restaurantId: tenant.restaurantId, isActive: true },
      include: { modifiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
    return { ok: true, data: groups };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
