import { requireTenantPageContext } from "@/lib/tenancy";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getCategories } from "@/features/menu/actions";
import { CategoriesManager } from "@/features/menu/components/categories-manager";

export default async function CategoriesPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "categories");

  if (!hasAccess) {
    return (
      <div>
        <div className="border-b px-8 py-4">
          <h1 className="text-2xl font-bold">Categories</h1>
        </div>
        <div className="p-6">
          <UpgradePrompt
            title={`Upgrade to ${getModuleUpgradeLabel("categories")} Plan`}
            description="Category management is available on the Starter plan and above."
          />
        </div>
      </div>
    );
  }

  const categories = await getCategories();

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-muted-foreground">Organize your menu with categories</p>
      </div>
      <div className="p-6">
        <CategoriesManager categories={categories} />
      </div>
    </div>
  );
}
