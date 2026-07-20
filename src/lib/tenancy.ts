import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { StaffRole } from "@prisma/client";
import {
  parseHostname,
  getRootDomain,
  buildTenantUrl,
  buildPlatformUrl,
  buildRestaurantUrl,
} from "@/lib/hostname";
import {
  resolveTenantByHostLabel,
  resolveTenantByCustomDomain,
} from "@/lib/tenancy-middleware";
import { maybeRedirectTenantToCustomDomain } from "@/lib/preferred-host";
import type { TenantContext } from "@/lib/tenancy-types";

export {
  getRootDomain,
  buildTenantUrl,
  buildPlatformUrl,
  buildRestaurantUrl,
  resolveTenantByHostLabel,
  resolveTenantByCustomDomain,
};
export type { TenantContext };

/** @deprecated Use resolveTenantByHostLabel */
export async function resolveTenantBySubdomain(
  subdomain: string
): Promise<TenantContext | null> {
  return resolveTenantByHostLabel(subdomain);
}

/** Request-scoped: one Host → tenant resolve per request. */
export const getTenantFromHeaders = cache(async (): Promise<TenantContext | null> => {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const parsed = parseHostname(host);

  // Tenant is derived from Host only — never trust client-supplied x-tenant-host-label.
  if (parsed.type === "tenant" && parsed.tenantKey) {
    return resolveTenantByHostLabel(parsed.tenantKey);
  }

  if (parsed.type === "custom" && parsed.hostname) {
    return resolveTenantByCustomDomain(parsed.hostname);
  }

  return null;
});

export async function requireTenantContext(): Promise<TenantContext> {
  const tenant = await getTenantFromHeaders();
  if (!tenant) {
    throw new AppError("Tenant context not found", "TENANT_NOT_FOUND", 404);
  }
  return tenant;
}

/** For server pages/layouts — redirects when the tenant host is unknown.
 *  Also redirects platform-subdomain → ACTIVE custom domain when applicable.
 */
export async function requireTenantPageContext(options?: {
  skipPreferredHostRedirect?: boolean;
}): Promise<TenantContext> {
  const tenant = await getTenantFromHeaders();
  if (!tenant) {
    redirect("/tenant-not-found");
  }

  if (!options?.skipPreferredHostRedirect) {
    const headersList = await headers();
    const pathname = headersList.get("x-url-pathname");
    if (pathname) {
      await maybeRedirectTenantToCustomDomain(
        tenant,
        pathname,
        headersList.get("x-url-search") || ""
      );
    }
  }

  return tenant;
}

export async function getTableTokenFromHeaders(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-table-token");
}

/** Request-scoped Better Auth session (one getSession call per request). */
export const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });

  if (user?.platformRole !== "SUPER_ADMIN") {
    throw new AppError("Super admin access required", "FORBIDDEN", 403);
  }

  return session;
}

/** Staff membership for (userId, restaurantId) — roles checked outside so array args don't bust cache. */
const getStaffMembershipCached = cache(async (userId: string, restaurantId: string) => {
  return prisma.staff.findUnique({
    where: {
      userId_restaurantId: {
        userId,
        restaurantId,
      },
    },
    include: {
      restaurant: { select: { status: true } },
    },
  });
});

export async function requireRestaurantStaff(
  restaurantId: string,
  allowedRoles?: StaffRole[]
) {
  const session = await requireSession();

  const staff = await getStaffMembershipCached(session.user.id, restaurantId);

  if (!staff || !staff.isActive) {
    throw new AppError("Not a member of this restaurant", "FORBIDDEN", 403);
  }

  if (staff.restaurant.status !== "ACTIVE") {
    throw new AppError("Restaurant is not active", "RESTAURANT_INACTIVE", 403);
  }

  if (allowedRoles && !allowedRoles.includes(staff.role)) {
    const roleHierarchy: Record<StaffRole, number> = {
      OWNER: 100,
      MANAGER: 80,
      CASHIER: 60,
      STAFF: 40,
      KITCHEN: 30,
      VIEWER: 10,
    };

    const hasAccess = allowedRoles.some(
      (role) => roleHierarchy[staff.role] >= roleHierarchy[role]
    );

    if (!hasAccess) {
      throw new AppError("Insufficient permissions", "FORBIDDEN", 403);
    }
  }

  return { session, staff };
}
