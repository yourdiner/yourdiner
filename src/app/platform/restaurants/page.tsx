import { Suspense } from "react";
import { PlatformSidebarServer } from "@/components/layout/platform-sidebar-server";
import { getRestaurants } from "@/features/restaurants/actions";
import { CreateRestaurantDialog } from "@/features/admin/components/create-restaurant-dialog";
import { RestaurantRow } from "@/features/admin/components/restaurant-row";
import { RestaurantStatusFilters } from "@/features/platform/components/restaurant-status-filters";
import { getAllPlansAdmin } from "@/features/subscriptions/platform-actions";

type SearchParams = Promise<{ status?: string }>;

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const statusParam =
    params.status === "DELETED"
      ? "DELETED"
      : params.status === "ACTIVE"
        ? "ACTIVE"
        : params.status === "SUSPENDED"
          ? "SUSPENDED"
          : params.status === "ALL"
            ? "ALL"
            : undefined;

  const [{ restaurants }, allPlans] = await Promise.all([
    getRestaurants({
      status: statusParam,
      limit: 100,
    }),
    getAllPlansAdmin(),
  ]);

  const planOptions = allPlans
    .filter((p) => p.status === "ACTIVE" && p.isActive)
    .map((p) => ({ slug: p.slug, name: p.name }));

  const showDeletedMeta = params.status === "DELETED";

  return (
    <div className="flex h-screen">
      <PlatformSidebarServer />
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">Restaurants</h1>
            <p className="text-muted-foreground">Manage all restaurants on the platform</p>
          </div>
          <CreateRestaurantDialog plans={planOptions} />
        </div>
        <div className="p-8">
          <Suspense fallback={null}>
            <RestaurantStatusFilters />
          </Suspense>
          <div className="rounded-xl border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-sm">
                  <th className="px-4 py-3 font-medium">Restaurant</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Menu</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((r) => (
                  <RestaurantRow key={r.id} restaurant={r} showDeletedMeta={showDeletedMeta} />
                ))}
              </tbody>
            </table>
            {restaurants.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">No restaurants found</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
