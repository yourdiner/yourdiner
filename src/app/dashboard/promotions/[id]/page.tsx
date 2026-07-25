import { notFound } from "next/navigation";
import { requireTenantPageContext } from "@/lib/tenancy";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getPromotion, getPromotionPickerData } from "@/features/pricing-engine/actions";
import { PromotionForm } from "@/features/pricing-engine/components/promotion-form";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  let promotion;
  try {
    promotion = await getPromotion(id);
  } catch {
    notFound();
  }

  const picker = await getPromotionPickerData();

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">Edit promotion</h1>
      </div>
      <div className="p-6">
        <PromotionForm
          mode="edit"
          promotionId={promotion.id}
          initial={promotion}
          categories={picker.categories}
          products={picker.products}
        />
      </div>
    </div>
  );
}
