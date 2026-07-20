import { requireTenantPageContext } from "@/lib/tenancy";
import { prisma } from "@/lib/db";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getProducts, getCategories } from "@/features/menu/actions";
import { ProductsManager } from "@/features/menu/components/products-manager";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { Suspense } from "react";

type SearchParams = Promise<{
  page?: string;
  search?: string;
  category?: string;
  sort?: string;
}>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "products");

  if (!hasAccess) {
    return (
      <AdminPageShell title="Menu Management">
        <UpgradePrompt
          title={`Upgrade to ${getModuleUpgradeLabel("products")} Plan`}
          description="Menu management is available on the Starter plan and above."
        />
      </AdminPageShell>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() || undefined;
  const categoryId = params.category && params.category !== "all" ? params.category : undefined;
  const sort =
    params.sort === "price_asc" || params.sort === "price_desc" ? params.sort : "default";

  const restaurantId = tenant.restaurantId;

  const [{ products, total, limit }, categories, activeCount, draftCount] = await Promise.all([
    getProducts({ page, search, categoryId, sort, limit: 50 }),
    getCategories(),
    prisma.product.count({
      where: { restaurantId, isHidden: false, isAvailable: true },
    }),
    prisma.product.count({ where: { restaurantId, isHidden: true } }),
  ]);

  return (
    <AdminPageShell title="Menu Management" searchPlaceholder="Search artisanal items...">
      <Suspense fallback={null}>
        <ProductsManager
        products={products}
        categories={categories}
        total={total}
        page={page}
        pageSize={limit}
        search={search ?? ""}
        categoryId={categoryId ?? "all"}
        sort={sort}
        activeCount={activeCount}
        draftCount={draftCount}
        />
      </Suspense>
    </AdminPageShell>
  );
}
