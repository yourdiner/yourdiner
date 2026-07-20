import { RestaurantStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { requireTenantContext, requireTenantPageContext } from "@/lib/tenancy";

export function isRestaurantOperational(status: RestaurantStatus | string): boolean {
  return status === RestaurantStatus.ACTIVE;
}

export function getInactiveRedirectPath(status: RestaurantStatus | string): string {
  if (status === RestaurantStatus.DELETED) {
    return "/restaurant-inactive?status=DELETED";
  }
  if (status === RestaurantStatus.SUSPENDED) {
    return "/restaurant-inactive?status=SUSPENDED";
  }
  return "/restaurant-inactive?status=INACTIVE";
}

export async function requireOperationalTenantPageContext() {
  const tenant = await requireTenantPageContext();
  if (!isRestaurantOperational(tenant.restaurantStatus)) {
    redirect(getInactiveRedirectPath(tenant.restaurantStatus));
  }
  return tenant;
}

export async function requireOperationalTenantContext() {
  const tenant = await requireTenantContext();
  if (!isRestaurantOperational(tenant.restaurantStatus)) {
    throw new AppError("Restaurant is not active", "RESTAURANT_INACTIVE", 403);
  }
  return tenant;
}
