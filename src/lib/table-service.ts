import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { allocateTableQrSlug } from "@/lib/table-qr";
import { tableSchema } from "@/features/tables/schemas";
import { getErrorMessage } from "@/lib/errors";
import { openOrderStatusFilter } from "@/lib/prisma-filters";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function requireTableAdmin() {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  return { tenant, staff };
}

export async function getNextTableNumberService(): Promise<ServiceResult<{ number: number }>> {
  try {
    const { tenant } = await requireTableAdmin();

    const max = await prisma.table.aggregate({
      where: { restaurantId: tenant.restaurantId },
      _max: { number: true },
    });

    return { ok: true, data: { number: (max._max.number ?? 0) + 1 } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createTableService(input: unknown): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant, staff } = await requireTableAdmin();
    await requirePlanFeature(tenant.restaurantId, "tables");

    const data = tableSchema.parse(input);

    const duplicate = await prisma.table.findFirst({
      where: { restaurantId: tenant.restaurantId, number: data.number },
    });
    if (duplicate) {
      return { ok: false, error: `Table number ${data.number} already exists` };
    }

    const table = await prisma.table.create({
      data: {
        ...data,
        restaurantId: tenant.restaurantId,
        qrSlug: await allocateTableQrSlug(tenant.restaurantId),
      },
    });

    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "CREATE",
        entity: "table",
        entityId: table.id,
        metadata: { number: table.number, name: table.name },
      },
    });

    return { ok: true, data: { id: table.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateTableService(
  id: string,
  input: unknown
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { tenant, staff } = await requireTableAdmin();
    await requirePlanFeature(tenant.restaurantId, "tables");

    const data = tableSchema.partial().parse(input);

    const existing = await prisma.table.findFirst({
      where: { id, restaurantId: tenant.restaurantId, isActive: true },
    });
    if (!existing) return { ok: false, error: "Table not found" };

    if (data.number !== undefined && data.number !== existing.number) {
      const duplicate = await prisma.table.findFirst({
        where: {
          restaurantId: tenant.restaurantId,
          number: data.number,
          id: { not: id },
        },
      });
      if (duplicate) {
        return { ok: false, error: `Table number ${data.number} already exists` };
      }
    }

    const table = await prisma.table.update({ where: { id }, data });

    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "UPDATE",
        entity: "table",
        entityId: table.id,
        metadata: data,
      },
    });

    return { ok: true, data: { id: table.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteTableService(id: string): Promise<ServiceResult> {
  try {
    const { tenant, staff } = await requireTableAdmin();
    await requirePlanFeature(tenant.restaurantId, "tables");

    const existing = await prisma.table.findFirst({
      where: { id, restaurantId: tenant.restaurantId, isActive: true },
      include: {
        sessions: { where: { status: { in: ["PENDING_APPROVAL", "ACTIVE"] }, isActive: true }, take: 1 },
        orders: {
          where: openOrderStatusFilter(),
          take: 1,
        },
      },
    });
    if (!existing) return { ok: false, error: "Table not found" };
    if (existing.sessions.length > 0) {
      return { ok: false, error: "Cannot remove a table with an active customer session" };
    }
    if (existing.orders.length > 0) {
      return { ok: false, error: "Cannot remove a table with open orders" };
    }

    await prisma.table.update({
      where: { id },
      data: { isActive: false, status: "AVAILABLE" },
    });

    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "DELETE",
        entity: "table",
        entityId: id,
      },
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
