import { requireTenantContext } from "@/lib/tenancy";
import { requireAdminOrderActor, requireOrderActor } from "@/features/dining-session/auth";
import {
  getActiveDiningSessions,
  getRecentClosedSessions,
  getDiningSessionDetail,
  getTablesForSessionWizard,
} from "@/features/dining-session/session.service";
import { getOrderContext } from "@/features/dining-session/order.service";
import { prisma } from "@/lib/db";
import { waiterStaffRoleFilter } from "@/lib/prisma-filters";

export async function adminGetActiveSessions() {
  const tenant = await requireTenantContext();
  await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
  return getActiveDiningSessions(tenant.restaurantId);
}

export async function adminGetSessionDetail(sessionId: string) {
  const tenant = await requireTenantContext();
  await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
  return getDiningSessionDetail(sessionId, tenant.restaurantId);
}

export async function adminGetWizardTables() {
  const tenant = await requireTenantContext();
  await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
  return getTablesForSessionWizard(tenant.restaurantId);
}

export async function adminGetOrderContext(sessionId: string) {
  const tenant = await requireTenantContext();
  const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
  return getOrderContext(sessionId, tenant.restaurantId, actor);
}

export async function adminGetWaitersForAssignment() {
  const tenant = await requireTenantContext();
  await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
  return prisma.staff.findMany({
    where: {
      restaurantId: tenant.restaurantId,
      ...waiterStaffRoleFilter(),
      isActive: true,
    },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
}

export async function adminGetRecentSessions(limit = 50) {
  const tenant = await requireTenantContext();
  await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
  return getRecentClosedSessions(tenant.restaurantId, limit);
}

export async function adminGetAvailableTablesForTransfer(sessionId: string) {
  const tenant = await requireTenantContext();
  await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
  return getTablesForSessionWizard(tenant.restaurantId);
}
