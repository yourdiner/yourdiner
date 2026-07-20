import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasModuleAccess } from "@/lib/plan-access";
import { redirect, notFound } from "next/navigation";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import {
  adminGetSessionDetail,
  adminGetWaitersForAssignment,
} from "@/features/dining-session/queries";
import { SessionDetailView } from "@/features/dining-session/components/session-detail-view";
import { getRestaurantLoyaltySettings } from "@/lib/loyalty-settings.server";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "orders");
  if (!hasAccess) redirect("/admin/orders");

  let session;
  try {
    session = await adminGetSessionDetail(sessionId);
  } catch {
    notFound();
  }

  const [waiters, loyaltySettings] = await Promise.all([
    adminGetWaitersForAssignment(),
    getRestaurantLoyaltySettings(tenant.restaurantId),
  ]);

  const tableLabel = session.table.name || `Table ${session.table.number}`;

  return (
    <AdminPageShell title={tableLabel} searchPlaceholder="Search items...">
      <SessionDetailView session={session} waiters={waiters} loyaltySettings={loyaltySettings} />
    </AdminPageShell>
  );
}
