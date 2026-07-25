import { requireTenantPageContext } from "@/lib/tenancy";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getPromotionPickerData } from "@/features/pricing-engine/actions";
import { PromotionForm } from "@/features/pricing-engine/components/promotion-form";

export default async function NewPromotionPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "promotions");

  if (!hasAccess) {
    return (
      <div className="p-6">
        <UpgradePrompt
          title={`Upgrade to ${getModuleUpgradeLabel("promotions")} Plan`}
          description="Promotions are available on the Premium plan."
        />
      </div>
    );
  }

  const picker = await getPromotionPickerData();

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">Create promotion</h1>
      </div>
      <div className="p-6">
        <PromotionForm mode="create" categories={picker.categories} products={picker.products} />
      </div>
    </div>
  );
}
