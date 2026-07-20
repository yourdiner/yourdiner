import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { getStaffSession } from "@/lib/staff-session";
import { AppError } from "@/lib/errors";

/**
 * Allow either Better Auth restaurant staff (POS/admin) or pin staff session (waiter).
 */
export async function requireMenuCatalogStaff() {
  const tenant = await requireTenantContext();
  const pinStaff = await getStaffSession();
  if (pinStaff && pinStaff.restaurantId === tenant.restaurantId) {
    return { tenant, via: "pin" as const };
  }

  try {
    await requireRestaurantStaff(tenant.restaurantId);
    return { tenant, via: "auth" as const };
  } catch {
    throw new AppError("Unauthorized", "FORBIDDEN", 403);
  }
}
