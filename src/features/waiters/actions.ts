"use server";

import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { hashDefaultStaffPassword, DEFAULT_STAFF_PASSWORD } from "@/lib/staff-pin";
import { waiterSchema } from "@/features/waiters/schemas";
import { AppError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import {
  closeDiningSessionService,
  reassignWaiterService,
  getActiveDiningSessions,
} from "@/features/dining-session/session.service";
import { requireOrderActor } from "@/features/dining-session/auth";

function revalidateWaiters() {
  revalidatePath("/admin/waiters");
  revalidatePath("/dashboard/waiters");
}

export async function getWaiters() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "staff_accounts");

  return prisma.staff.findMany({
    where: {
      restaurantId: tenant.restaurantId,
      role: "STAFF",
    },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      mobile: true,
      employeeId: true,
      role: true,
      isActive: true,
      joiningDate: true,
      mustChangePassword: true,
      profilePhoto: { select: { url: true } },
      _count: { select: { assignedDiningSessions: true } },
    },
  });
}

export async function createWaiter(input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  const data = waiterSchema.parse(input);

  const normalizedMobile = data.mobile.replace(/\D/g, "").slice(-10);
  const duplicate = await prisma.staff.findFirst({
    where: { restaurantId: tenant.restaurantId, mobile: normalizedMobile },
  });
  if (duplicate) throw new AppError("Mobile already in use", "DUPLICATE", 400);

  const pinHash = await hashDefaultStaffPassword();

  const waiter = await prisma.staff.create({
    data: {
      restaurantId: tenant.restaurantId,
      displayName: data.displayName,
      mobile: normalizedMobile,
      employeeId: data.employeeId || null,
      pinHash,
      mustChangePassword: true,
      role: "STAFF",
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
      isActive: data.isActive ?? true,
    },
  });

  await prisma.activityLog.create({
    data: {
      restaurantId: tenant.restaurantId,
      userId: staff.userId,
      action: "CREATE",
      entity: "waiter",
      entityId: waiter.id,
      metadata: { displayName: waiter.displayName },
    },
  });

  revalidateWaiters();
  return { ...waiter, defaultPassword: DEFAULT_STAFF_PASSWORD };
}

export async function updateWaiter(id: string, input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  const data = waiterSchema.partial().parse(input);

  const existing = await prisma.staff.findFirst({
    where: { id, restaurantId: tenant.restaurantId },
  });
  if (!existing) throw new AppError("Waiter not found", "NOT_FOUND", 404);

  const normalizedMobile = data.mobile
    ? data.mobile.replace(/\D/g, "").slice(-10)
    : undefined;

  if (normalizedMobile) {
    const duplicate = await prisma.staff.findFirst({
      where: {
        restaurantId: tenant.restaurantId,
        mobile: normalizedMobile,
        NOT: { id },
      },
    });
    if (duplicate) throw new AppError("Mobile already in use", "DUPLICATE", 400);
  }

  const resetPassword = data.resetPassword === true;
  const pinHash = resetPassword ? await hashDefaultStaffPassword() : undefined;

  const waiter = await prisma.staff.update({
    where: { id },
    data: {
      displayName: data.displayName,
      mobile: normalizedMobile,
      employeeId: data.employeeId,
      role: data.role === undefined ? undefined : "STAFF",
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
      isActive: data.isActive,
      ...(pinHash ? { pinHash, mustChangePassword: true } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      restaurantId: tenant.restaurantId,
      userId: staff.userId,
      action: "UPDATE",
      entity: "waiter",
      entityId: waiter.id,
      metadata: resetPassword ? { passwordReset: true } : undefined,
    },
  });

  revalidateWaiters();
  return {
    ...waiter,
    ...(resetPassword ? { defaultPassword: DEFAULT_STAFF_PASSWORD } : {}),
  };
}

export async function deactivateWaiter(id: string) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const existing = await prisma.staff.findFirst({
    where: { id, restaurantId: tenant.restaurantId },
    select: { id: true },
  });
  if (!existing) throw new AppError("Waiter not found", "NOT_FOUND", 404);

  await prisma.staff.update({
    where: { id },
    data: { isActive: false },
  });

  await prisma.staffSession.updateMany({
    where: { staffId: id, restaurantId: tenant.restaurantId },
    data: { isActive: false },
  });

  revalidateWaiters();
}

export async function getLiveFloorData() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const [sessions, waiters] = await Promise.all([
    getActiveDiningSessions(tenant.restaurantId),
    prisma.staff.findMany({
      where: {
        restaurantId: tenant.restaurantId,
        role: "STAFF",
        isActive: true,
      },
      select: { id: true, displayName: true },
    }),
  ]);

  return { sessions, waiters };
}

export async function transferDiningSession(sessionId: string, newWaiterId: string) {
  const tenant = await requireTenantContext();
  const actor = await requireOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
  await reassignWaiterService(sessionId, tenant.restaurantId, newWaiterId, actor);
  revalidatePath("/admin/live-floor");
  revalidatePath("/staff/floor");
  revalidatePath("/admin/orders");
}

export async function adminCloseSession(sessionId: string) {
  const tenant = await requireTenantContext();
  const actor = await requireOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
  await closeDiningSessionService(sessionId, tenant.restaurantId, actor);
  revalidatePath("/admin/live-floor");
  revalidatePath("/staff/floor");
  revalidatePath("/admin/orders");
}
