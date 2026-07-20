import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { hashDefaultStaffPassword, DEFAULT_STAFF_PASSWORD } from "@/lib/staff-pin";
import { waiterSchema } from "@/features/waiters/schemas";
import { getErrorMessage } from "@/lib/errors";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export { DEFAULT_STAFF_PASSWORD };

async function requireWaiterAdmin() {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  return { tenant, staff };
}

export async function createWaiterService(input: unknown): Promise<
  ServiceResult<{ id: string; defaultPassword: string }>
> {
  try {
    const { tenant, staff } = await requireWaiterAdmin();
    const data = waiterSchema.parse(input);

    const normalizedMobile = data.mobile.replace(/\D/g, "").slice(-10);
    const duplicate = await prisma.staff.findFirst({
      where: { restaurantId: tenant.restaurantId, mobile: normalizedMobile },
    });
    if (duplicate) return { ok: false, error: "Mobile already in use" };

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

    return {
      ok: true,
      data: { id: waiter.id, defaultPassword: DEFAULT_STAFF_PASSWORD },
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateWaiterService(
  id: string,
  input: unknown
): Promise<ServiceResult<{ id: string; defaultPassword?: string }>> {
  try {
    const { tenant, staff } = await requireWaiterAdmin();
    const data = waiterSchema.partial().parse(input);

    const existing = await prisma.staff.findFirst({
      where: { id, restaurantId: tenant.restaurantId },
    });
    if (!existing) return { ok: false, error: "Waiter not found" };

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
      if (duplicate) return { ok: false, error: "Mobile already in use" };
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
        ...(pinHash
          ? { pinHash, mustChangePassword: true }
          : {}),
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

    return {
      ok: true,
      data: {
        id: waiter.id,
        ...(resetPassword ? { defaultPassword: DEFAULT_STAFF_PASSWORD } : {}),
      },
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deactivateWaiterService(id: string): Promise<ServiceResult> {
  try {
    const { tenant } = await requireWaiterAdmin();

    const existing = await prisma.staff.findFirst({
      where: { id, restaurantId: tenant.restaurantId },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Waiter not found" };

    await prisma.staff.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.staffSession.updateMany({
      where: { staffId: id, restaurantId: tenant.restaurantId },
      data: { isActive: false },
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
