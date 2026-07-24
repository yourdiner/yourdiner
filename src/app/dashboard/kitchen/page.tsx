import { requireTenantPageContext } from "@/lib/tenancy";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { listKitchenQueueItems } from "@/features/fulfillment/kitchen-item.service";
import { KitchenDashboardPoller } from "@/features/fulfillment/components/kitchen-dashboard-poller";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "kitchen");

  if (!hasAccess) {
    const planLabel = getModuleUpgradeLabel("kitchen");
    return (
      <AdminPageShell title="Kitchen Display">
        <UpgradePrompt
          title={`Upgrade to ${planLabel} Plan`}
          description="Kitchen display is available on the Cafe Staff plan and above."
        />
      </AdminPageShell>
    );
  }

  const { items, serverTime } = await listKitchenQueueItems(tenant.restaurantId);

  return (
    <AdminPageShell title="Kitchen Display">
      <div className="mb-6">
        <p className="text-label-md uppercase tracking-widest text-secondary">Operations</p>
        <h3 className="font-display text-display-lg-mobile font-bold leading-tight md:text-display-lg">
          Kitchen queue
        </h3>
        <p className="mt-2 max-w-xl text-body-md text-on-surface-variant opacity-80">
          One row per item, oldest kitchen submission first.
        </p>
      </div>
      <KitchenDashboardPoller initialItems={items} initialServerTime={serverTime} />
    </AdminPageShell>
  );
}
