"use server";

import { prisma } from "@/lib/db";
import { requireSuperAdmin, requireRestaurantStaff, requireTenantContext } from "@/lib/tenancy";
import { StaffRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  createRestaurantSchema,
  updateRestaurantStatusSchema,
  updateRestaurantSettingsSchema,
} from "@/features/restaurants/schemas";
import { revalidatePath } from "next/cache";
import { createRestaurantAndOwner } from "@/features/restaurants/create-restaurant-core";
import {
  getPermanentDeletePreview as getPermanentDeletePreviewService,
  permanentlyDeleteRestaurant as permanentlyDeleteRestaurantService,
  restoreRestaurant as restoreRestaurantService,
  softDeleteRestaurant,
} from "@/features/restaurants/restaurant-lifecycle.service";

export async function getRestaurants(params?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  await requireSuperAdmin();

  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const skip = (page - 1) * limit;

  const statusFilter =
    params?.status === "ALL"
      ? undefined
      : params?.status
        ? (params.status as "ACTIVE" | "SUSPENDED" | "INACTIVE" | "DELETED")
        : { not: "DELETED" as const };

  const where = {
    ...(statusFilter !== undefined ? { status: statusFilter } : {}),
    ...(params?.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" as const } },
            { subdomain: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      where,
      include: {
        subscription: { include: { plan: true } },
        deletedByUser: { select: { id: true, name: true, email: true } },
        staff: { where: { role: "OWNER" }, include: { user: { select: { email: true, name: true } } } },
        _count: { select: { products: true, categories: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.restaurant.count({ where }),
  ]);

  return { restaurants, total, page, limit };
}

export async function getRestaurantById(id: string) {
  await requireSuperAdmin();

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true, invoices: { orderBy: { createdAt: "desc" }, take: 10 } } },
      settings: true,
      branding: true,
      staff: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { products: true, categories: true, orders: true, customers: true } },
    },
  });

  if (!restaurant) throw new AppError("Restaurant not found", "NOT_FOUND", 404);
  return restaurant;
}

export async function getRestaurantPlatformDetail(id: string) {
  await requireSuperAdmin();

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      subscription: {
        include: {
          plan: true,
          planVersion: true,
          scheduledPlan: true,
          payments: { orderBy: { createdAt: "desc" } },
          invoices: { orderBy: { createdAt: "desc" } },
          events: { orderBy: { createdAt: "desc" } },
        },
      },
      settings: true,
      branding: true,
      deletedByUser: { select: { id: true, name: true, email: true } },
      staff: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { products: true, categories: true, orders: true, customers: true } },
    },
  });

  if (!restaurant) throw new AppError("Restaurant not found", "NOT_FOUND", 404);

  let auditLogs: Awaited<
    ReturnType<typeof import("@/modules/subscription-engine/services/billing-audit.service").getBillingAuditLogs>
  > = [];

  if (restaurant.subscription) {
    const { syncInvoicesForSubscription } = await import(
      "@/modules/subscription-engine/services/invoice-sync.service"
    );
    const { getBillingAuditLogs } = await import(
      "@/modules/subscription-engine/services/billing-audit.service"
    );
    await syncInvoicesForSubscription(restaurant.subscription.id);
    auditLogs = await getBillingAuditLogs({ restaurantId: id, limit: 30 });

    const freshInvoices = await prisma.invoice.findMany({
      where: { subscriptionId: restaurant.subscription.id },
      orderBy: { createdAt: "desc" },
    });
    restaurant.subscription.invoices = freshInvoices;
  }

  return { restaurant, auditLogs };
}

export async function createRestaurant(input: unknown) {
  await requireSuperAdmin();
  const parsed = createRestaurantSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path?.join(".") || "form";
    throw new AppError(
      first ? `${field}: ${first.message}` : "Invalid restaurant details",
      "VALIDATION_ERROR",
      400,
      { issues: parsed.error.issues }
    );
  }
  const data = parsed.data;

  const result = await createRestaurantAndOwner({
    name: data.name,
    subdomain: data.subdomain,
    planSlug: data.planSlug,
    ownerName: data.ownerName,
    ownerEmail: data.ownerEmail,
    ownerPhone: data.ownerPhone,
    address: data.ownerAddress,
  });

  revalidatePath("/platform/restaurants");
  return result;
}

export async function updateRestaurantStatus(input: unknown) {
  const session = await requireSuperAdmin();
  const data = updateRestaurantStatusSchema.parse(input);

  const restaurant = await prisma.restaurant.update({
    where: { id: data.restaurantId },
    data: { status: data.status },
  });

  await prisma.activityLog.create({
    data: {
      restaurantId: restaurant.id,
      userId: session.user.id,
      action: data.status === "ACTIVE" ? "ACTIVATE" : "SUSPEND",
      entity: "restaurant",
      entityId: restaurant.id,
      metadata: { status: data.status },
    },
  });

  revalidatePath("/platform/restaurants");
  return restaurant;
}

export async function deleteRestaurant(restaurantId: string, reason?: string) {
  const session = await requireSuperAdmin();
  const restaurant = await softDeleteRestaurant(restaurantId, { userId: session.user.id, email: session.user.email }, reason);
  revalidatePath("/platform/restaurants");
  revalidatePath(`/platform/restaurants/${restaurantId}`);
  revalidatePath("/platform/subscriptions");
  return restaurant;
}

export async function restoreRestaurant(restaurantId: string) {
  const session = await requireSuperAdmin();
  const restaurant = await restoreRestaurantService(restaurantId, {
    userId: session.user.id,
    email: session.user.email,
  });
  revalidatePath("/platform/restaurants");
  revalidatePath(`/platform/restaurants/${restaurantId}`);
  return restaurant;
}

export async function getPermanentDeletePreview(restaurantId: string) {
  await requireSuperAdmin();
  return getPermanentDeletePreviewService(restaurantId);
}

export async function permanentlyDeleteRestaurant(restaurantId: string, reason?: string) {
  const session = await requireSuperAdmin();
  const result = await permanentlyDeleteRestaurantService(
    restaurantId,
    { userId: session.user.id, email: session.user.email },
    reason
  );
  revalidatePath("/platform/restaurants");
  revalidatePath("/platform/billing/archive");
  revalidatePath(`/platform/billing/archive/${restaurantId}`);
  return result;
}

export async function getRestaurantSettings() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);

  return prisma.restaurant.findUnique({
    where: { id: tenant.restaurantId },
    include: {
      settings: true,
      branding: {
        include: { logo: true, cover: true, favicon: true },
      },
      subscription: { include: { plan: true } },
    },
  });
}

export async function updateRestaurantSettings(input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, [StaffRole.OWNER, StaffRole.MANAGER]);
  const data = updateRestaurantSettingsSchema.parse(input);

  const restaurant = await prisma.restaurant.update({
    where: { id: tenant.restaurantId },
    data: {
      ...(data.name ? { name: data.name } : {}),
        settings: {
          update: {
            ...(data.language ? { language: data.language } : {}),
            ...(data.currency ? { currency: data.currency } : {}),
            ...(data.timezone ? { timezone: data.timezone } : {}),
            ...(data.loyaltySettings ? { loyaltySettings: data.loyaltySettings } : {}),
            ...(data.reservationSettings
              ? {
                  reservationSettings: data.reservationSettings,
                  averageDiningMinutes: data.reservationSettings.averageDiningMinutes,
                }
              : {}),
          },
        },
    },
    include: { settings: true },
  });

  await prisma.activityLog.create({
    data: {
      restaurantId: tenant.restaurantId,
      userId: staff.userId,
      action: "UPDATE",
      entity: "restaurant_settings",
      entityId: tenant.restaurantId,
    },
  });

  revalidatePath("/dashboard/settings");
  return restaurant;
}

export async function getPlatformStats() {
  await requireSuperAdmin();

  const [totalRestaurants, activeRestaurants, trialUsers, expiredUsers, totalOrders] =
    await Promise.all([
      prisma.restaurant.count({ where: { status: { not: "DELETED" } } }),
      prisma.restaurant.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIAL" } }),
      prisma.subscription.count({ where: { status: "EXPIRED" } }),
      prisma.order.count(),
    ]);

  const paidInvoices = await prisma.invoice.aggregate({
    where: { status: "PAID" },
    _sum: { amount: true },
  });

  return {
    totalRestaurants,
    activeRestaurants,
    trialUsers,
    expiredUsers,
    totalOrders,
    totalRevenue: paidInvoices._sum.amount || 0,
  };
}
