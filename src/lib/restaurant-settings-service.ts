import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { updateRestaurantSettingsSchema } from "@/features/restaurants/schemas";
import { StaffRole } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export async function updateRestaurantSettingsService(
  input: unknown
): Promise<ServiceResult<{ id: string }>> {
  try {
    const tenant = await requireTenantContext();
    const { staff } = await requireRestaurantStaff(tenant.restaurantId, [
      StaffRole.OWNER,
      StaffRole.MANAGER,
    ]);
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
            ...(data.taxPercent !== undefined ? { taxPercent: data.taxPercent } : {}),
            ...(data.taxInclusive !== undefined ? { taxInclusive: data.taxInclusive } : {}),
            ...(data.loyaltySettings ? { loyaltySettings: data.loyaltySettings } : {}),
            ...(data.reservationSettings
              ? {
                  reservationSettings: data.reservationSettings,
                  averageDiningMinutes: data.reservationSettings.averageDiningMinutes,
                }
              : {}),
            ...(data.orderSettings ? { orderSettings: data.orderSettings } : {}),
          },
        },
      },
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

    return { ok: true, data: { id: restaurant.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
