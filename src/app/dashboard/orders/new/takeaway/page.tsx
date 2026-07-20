import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasFeature } from "@/lib/plan-access";
import { redirect } from "next/navigation";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { TakeawayOrderWizard } from "@/features/fulfillment/components/takeaway-order-wizard";

export const dynamic = "force-dynamic";

export default async function NewTakeawayPage() {
  const tenant = await requireTenantPageContext();
  const allowed = await restaurantHasFeature(tenant.restaurantId, "fulfillment_orders");
  if (!allowed) redirect("/admin/orders/new");

  return (
    <AdminPageShell title="New Takeaway Order" showSearch={false}>
      <TakeawayOrderWizard />
    </AdminPageShell>
  );
}
