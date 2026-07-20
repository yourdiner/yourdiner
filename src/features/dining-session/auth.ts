import { getStaffSession, assertStaffTenantMatch } from "@/lib/staff-session";
import { requireRestaurantStaff, requireTenantContext } from "@/lib/tenancy";
import { AppError } from "@/lib/errors";
import { StaffRole } from "@prisma/client";

export type OrderActor =
  | { type: "staff"; staffId: string; displayName: string; role: StaffRole }
  | { type: "admin"; userId: string; staffId: string; role: StaffRole; displayName: string }
  | { type: "customer"; displayName: string };

export function createCustomerActor(displayName: string): OrderActor {
  return { type: "customer", displayName };
}

export async function requireOrderActor(options?: {
  adminRoles?: StaffRole[];
}): Promise<OrderActor> {
  const adminRoles = options?.adminRoles ?? ["OWNER", "MANAGER"];

  const staffSession = await getStaffSession();
  if (staffSession) {
    const tenant = await requireTenantContext();
    assertStaffTenantMatch(staffSession, tenant);
    return {
      type: "staff",
      staffId: staffSession.staffId,
      displayName: staffSession.displayName,
      role: staffSession.role,
    };
  }

  return requireAdminOrderActor({ adminRoles });
}

/** Admin dashboard APIs — always use the logged-in owner/manager, not staff POS cookie. */
export async function requireAdminOrderActor(options?: {
  adminRoles?: StaffRole[];
}): Promise<OrderActor> {
  const adminRoles = options?.adminRoles ?? ["OWNER", "MANAGER"];

  const tenant = await requireTenantContext();
  // requireRestaurantStaff already calls requireSession (request-cached getSession)
  const { session, staff } = await requireRestaurantStaff(tenant.restaurantId, adminRoles);

  return {
    type: "admin",
    userId: session.user.id,
    staffId: staff.id,
    role: staff.role,
    displayName: staff.displayName || session.user.name,
  };
}
