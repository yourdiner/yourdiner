import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasFeature, getModuleUpgradeLabel } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getWaiters } from "@/features/waiters/actions";
import { WaitersManager } from "@/features/waiters/components/waiters-manager";

export const dynamic = "force-dynamic";

export default async function WaitersPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasFeature(tenant.restaurantId, "staff_accounts");

  if (!hasAccess) {
    return (
      <div>
        <div className="border-b px-8 py-4">
          <h1 className="text-2xl font-bold">Waiters</h1>
        </div>
        <div className="p-6">
          <UpgradePrompt
            title={`Upgrade to ${getModuleUpgradeLabel("staff")} Plan`}
            description="Staff and waiter management is available on the Professional plan and above."
          />
        </div>
      </div>
    );
  }

  const waiters = await getWaiters();
  return <WaitersManager waiters={waiters} />;
}
