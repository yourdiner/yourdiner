import { redirect, notFound } from "next/navigation";
import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasModuleAccess } from "@/lib/plan-access";
import { adminGetOrderContext } from "@/features/dining-session/queries";
import { AdminOrderInterface } from "@/features/dining-session/components/admin-order-interface";
import { serializeActiveOrder } from "@/lib/serialize-order";
import { mapOrderCategories } from "@/lib/map-order-categories";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "orders");
  if (!hasAccess) redirect("/admin/orders");

  let ctx;
  try {
    ctx = await adminGetOrderContext(sessionId);
  } catch {
    notFound();
  }

  const { diningSession, categories, activeOrder } = ctx;

  if (diningSession.status === "CLOSED" || diningSession.status === "CANCELLED") {
    redirect(`/admin/orders/${sessionId}`);
  }

  return (
    <AdminOrderInterface
      sessionId={sessionId}
      tableLabel={diningSession.table.name || `Table ${diningSession.table.number}`}
      guestCount={diningSession.guestCount}
      customerName={diningSession.customer?.name ?? diningSession.guestName}
      categories={mapOrderCategories(categories)}
      activeOrder={serializeActiveOrder(activeOrder)}
    />
  );
}
