import { prisma } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { AppError } from "@/lib/errors";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import {
  approveTableSession,
  getPendingTableSessions,
  rejectTableSession,
  resetTableCustomerSession,
} from "@/lib/table-sessions";
import { requireAdminOrderActor } from "@/features/dining-session/auth";
import {
  approveFirstCustomerOrder,
  getPendingFirstCustomerOrders,
  rejectFirstCustomerOrder,
} from "@/features/customer-order/customer-order-approval.service";

export type AdminSessionResult = { ok: true } | { ok: false; error: string };

export async function adminListPendingCustomerSessions() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER", "CASHIER"]);
  return getPendingTableSessions(tenant.restaurantId);
}

export async function adminApproveCustomerSession(
  tableSessionId: string
): Promise<AdminSessionResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
    await approveTableSession(tableSessionId, tenant.restaurantId, actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function adminRejectCustomerSession(
  tableSessionId: string
): Promise<AdminSessionResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
    await rejectTableSession(tableSessionId, tenant.restaurantId, actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function adminResetTable(tableId: string): Promise<AdminSessionResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
    await resetTableCustomerSession(tableId, tenant.restaurantId, actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function adminListPendingFirstOrders() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER", "CASHIER"]);
  return getPendingFirstCustomerOrders(tenant.restaurantId);
}

export async function adminApproveFirstOrder(orderId: string): Promise<AdminSessionResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
    await approveFirstCustomerOrder(orderId, tenant.restaurantId, actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function adminRejectFirstOrder(orderId: string): Promise<AdminSessionResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
    await rejectFirstCustomerOrder(orderId, tenant.restaurantId, actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
