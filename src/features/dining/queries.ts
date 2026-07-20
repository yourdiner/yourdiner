import { redirect } from "next/navigation";
import {
  getStaffSession,
  assertStaffTenantMatch,
} from "@/lib/staff-session";
import { requireTenantContext } from "@/lib/tenancy";
import { getDiningSessionDetail } from "@/features/dining-session/session.service";
import { getOrderContext } from "@/features/dining-session/order.service";
import { requireOrderActor } from "@/features/dining-session/auth";

async function requireStaffPageContext() {
  const staffSession = await getStaffSession();
  if (!staffSession) redirect("/staff/login");
  const tenant = await requireTenantContext();
  assertStaffTenantMatch(staffSession, tenant);
  return { staffSession, tenant };
}

export async function getDiningSession(sessionId: string) {
  const { tenant } = await requireStaffPageContext();
  return getDiningSessionDetail(sessionId, tenant.restaurantId);
}

export async function getWaiterOrderContext(sessionId: string) {
  const { tenant } = await requireStaffPageContext();
  const actor = await requireOrderActor();
  return getOrderContext(sessionId, tenant.restaurantId, actor);
}
