"use server";

import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { allocateTableQrSlug } from "@/lib/table-qr";
import { tableSchema } from "@/features/tables/schemas";
import { AppError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { openOrderStatusFilter } from "@/lib/prisma-filters";
import { getRestaurantTablesAvailability } from "@/features/tables/table-availability.service";

function revalidateTablesPages() {
  revalidatePath("/dashboard/tables");
  revalidatePath("/admin/tables");
}

export async function getTables() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);

  const [tables, availability] = await Promise.all([
    prisma.table.findMany({
      where: { restaurantId: tenant.restaurantId, isActive: true },
      include: {
        qrCodes: { where: { invalidatedAt: null }, take: 1 },
        sessions: {
          where: { status: { in: ["PENDING_APPROVAL", "ACTIVE"] }, isActive: true },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    }),
    getRestaurantTablesAvailability(tenant.restaurantId),
  ]);

  return tables.map((table) => ({
    ...table,
    availabilityStatus: availability.get(table.id)?.status ?? "AVAILABLE",
  }));
}

export async function getNextTableNumber(): Promise<number> {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const max = await prisma.table.aggregate({
    where: { restaurantId: tenant.restaurantId },
    _max: { number: true },
  });

  return (max._max.number ?? 0) + 1;
}

export async function createTable(input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "tables");

  const data = tableSchema.parse(input);

  const duplicate = await prisma.table.findFirst({
    where: { restaurantId: tenant.restaurantId, number: data.number },
  });
  if (duplicate) {
    throw new AppError(`Table number ${data.number} already exists`, "DUPLICATE_NUMBER", 400);
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

  revalidateTablesPages();
  return table;
}

export async function updateTable(id: string, input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "tables");

  const data = tableSchema.partial().parse(input);

  const existing = await prisma.table.findFirst({
    where: { id, restaurantId: tenant.restaurantId, isActive: true },
  });
  if (!existing) throw new AppError("Table not found", "NOT_FOUND", 404);

  if (data.number !== undefined && data.number !== existing.number) {
    const duplicate = await prisma.table.findFirst({
      where: {
        restaurantId: tenant.restaurantId,
        number: data.number,
        id: { not: id },
      },
    });
    if (duplicate) {
      throw new AppError(`Table number ${data.number} already exists`, "DUPLICATE_NUMBER", 400);
    }
  }

  const table = await prisma.table.update({
    where: { id },
    data,
  });

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

  revalidateTablesPages();
  return table;
}

export async function deleteTable(id: string) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "tables");

  const existing = await prisma.table.findFirst({
    where: { id, restaurantId: tenant.restaurantId, isActive: true },
    include: {
      sessions: { where: { isActive: true }, take: 1 },
      orders: {
        where: openOrderStatusFilter(),
        take: 1,
      },
    },
  });
  if (!existing) throw new AppError("Table not found", "NOT_FOUND", 404);

  if (existing.sessions.length > 0) {
    throw new AppError("Cannot remove a table with an active customer session", "ACTIVE_SESSION", 400);
  }
  if (existing.orders.length > 0) {
    throw new AppError("Cannot remove a table with open orders", "OPEN_ORDERS", 400);
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

  revalidateTablesPages();
}
