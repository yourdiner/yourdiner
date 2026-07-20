import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasFeature } from "@/lib/plan-access";
import { redirect } from "next/navigation";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { DeliveryOrderWizard } from "@/features/fulfillment/components/delivery-order-wizard";

export const dynamic = "force-dynamic";

export default async function NewDeliveryPage() {
  const tenant = await requireTenantPageContext();
  const allowed = await restaurantHasFeature(tenant.restaurantId, "fulfillment_orders");
  if (!allowed) redirect("/admin/orders/new");

  return (
    <AdminPageShell title="New Delivery Order" showSearch={false}>
      <DeliveryOrderWizard />
    </AdminPageShell>
  );
}
