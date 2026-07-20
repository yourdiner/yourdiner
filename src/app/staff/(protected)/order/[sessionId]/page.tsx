import { redirect } from "next/navigation";
import { getWaiterOrderContext } from "@/features/dining/queries";
import { getPublicBranding } from "@/features/branding/actions";
import { WaiterOrderView } from "@/features/waiter-order/components/waiter-order-view";
import type { MenuActiveOrder } from "@/features/menu/components/public-menu-types";
import { serializeActiveOrder } from "@/lib/serialize-order";
import { buildMenuDataFromOrderContext } from "@/lib/map-order-context-menu";
import { requireTenantContext } from "@/lib/tenancy";
import { getStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export default async function WaiterOrderPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const tenant = await requireTenantContext();
  const staffSession = await getStaffSession();
  if (!staffSession) redirect("/staff/floor");

  let ctx;
  try {
    ctx = await getWaiterOrderContext(sessionId);
  } catch (error) {
    // Surface assignment conflicts on the floor instead of a silent bounce
    // that looks like a broken "Open order" link.
    console.error("[staff/order] failed to load order context", error);
    redirect("/staff/floor");
  }

  const branding = await getPublicBranding(tenant.restaurantId);
  const menuData = buildMenuDataFromOrderContext(
    { id: tenant.restaurantId, name: tenant.name },
    ctx.categories,
    branding
  );

  const { diningSession, activeOrder } = ctx;
  const serialized = serializeActiveOrder(activeOrder);

  return (
    <WaiterOrderView
      menu={menuData}
      sessionId={sessionId}
      tableLabel={diningSession.table.name || `Table ${diningSession.table.number}`}
      guestCount={diningSession.guestCount}
      customerName={diningSession.customer?.name}
      activeOrder={serialized as MenuActiveOrder | null}
      staffShell={{
        restaurantName: tenant.name,
        staffName: staffSession.displayName,
        staffRole: staffSession.role,
      }}
    />
  );
}
