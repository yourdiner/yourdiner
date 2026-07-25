import { requireTenantPageContext } from "@/lib/tenancy";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getPromotions } from "@/features/pricing-engine/actions";
import { PromotionsManager } from "@/features/pricing-engine/components/promotions-manager";

export default async function PromotionsPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "promotions");

  if (!hasAccess) {
    return (
      <div>
        <div className="border-b px-8 py-4">
          <h1 className="text-2xl font-bold">Promotions</h1>
        </div>
        <div className="p-6">
          <UpgradePrompt
            title={`Upgrade to ${getModuleUpgradeLabel("promotions")} Plan`}
            description="Promotions and the pricing engine are available on the Premium plan."
          />
        </div>
      </div>
    );
  }

  const promotions = await getPromotions();

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">Promotions</h1>
        <p className="text-muted-foreground">
          Happy hours, day pricing, combos, and bill discounts — one engine for every order.
        </p>
      </div>
      <div className="p-6">
        <PromotionsManager promotions={promotions} />
      </div>
    </div>
  );
}
