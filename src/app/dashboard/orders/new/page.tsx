import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasModuleAccess, restaurantHasFeature } from "@/lib/plan-access";
import { redirect } from "next/navigation";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { OrderTypePicker } from "@/features/fulfillment/components/order-type-picker";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "orders");
  if (!hasAccess) redirect("/admin/orders");

  const fulfillmentEnabled = await restaurantHasFeature(
    tenant.restaurantId,
    "fulfillment_orders"
  );

  return (
    <AdminPageShell title="New Order" showSearch={false}>
      <OrderTypePicker fulfillmentEnabled={fulfillmentEnabled} />
    </AdminPageShell>
  );
}
