import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { brandingSchema } from "@/features/branding/schemas";
import { StaffRole } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export async function updateBrandingService(input: unknown): Promise<ServiceResult<{ id: string }>> {
  try {
    const tenant = await requireTenantContext();
    const { staff } = await requireRestaurantStaff(tenant.restaurantId, [
      StaffRole.OWNER,
      StaffRole.MANAGER,
    ]);
    await requirePlanFeature(tenant.restaurantId, "branding");

    const data = brandingSchema.parse(input);

    const branding = await prisma.restaurantBranding.upsert({
      where: { restaurantId: tenant.restaurantId },
      update: data,
      create: { restaurantId: tenant.restaurantId, ...data },
    });

    await prisma.activityLog.create({
      data: {
        restaurantId: tenant.restaurantId,
        userId: staff.userId,
        action: "UPDATE",
        entity: "branding",
        entityId: branding.id,
      },
    });

    return { ok: true, data: { id: branding.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
