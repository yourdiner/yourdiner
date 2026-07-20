import Image from "next/image";
import Link from "next/link";
import { requireTenantPageContext } from "@/lib/tenancy";
import { prisma } from "@/lib/db";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { MaterialIcon } from "@/components/layout/material-icon";
import { WeeklyRevenueChart } from "@/features/dashboard/components/weekly-revenue-chart";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { buildRestaurantUrl } from "@/lib/tenancy";
import {
  cancelledOrderStatusFilter,
  inProgressOrderStatusFilter,
} from "@/lib/prisma-filters";
import { getWeeklyRevenueStats } from "@/features/dashboard/queries";
import {
  getDashboardMenuCounts,
  getRestaurantWithSubscriptionCached,
} from "@/lib/request-cache";

export default async function DashboardPage() {
  const tenant = await requireTenantPageContext();
  const restaurantId = tenant.restaurantId;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    menuCounts,
    restaurant,
    weeklyRevenue,
    activeOrders,
    tableStats,
    recentOrders,
    topProducts,
  ] = await Promise.all([
    getDashboardMenuCounts(restaurantId),
    getRestaurantWithSubscriptionCached(restaurantId),
    getWeeklyRevenueStats(restaurantId, sevenDaysAgo),
    prisma.order.count({
      where: {
        restaurantId,
        ...inProgressOrderStatusFilter(),
      },
    }),
    prisma.table.groupBy({
      by: ["status"],
      where: { restaurantId, isActive: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        items: { take: 1, select: { name: true, quantity: true } },
      },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          restaurantId,
          createdAt: { gte: sevenDaysAgo },
          ...cancelledOrderStatusFilter(),
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 4,
    }),
  ]);

  const { categories, products, activeProducts, hiddenProducts } = menuCounts;

  const topProductIds = topProducts.map((t) => t.productId);
  const topProductDetails = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds }, restaurantId },
        include: { images: { include: { media: true }, take: 1, orderBy: { sortOrder: "asc" } } },
      })
    : [];
  const topProductMap = new Map(topProductDetails.map((p) => [p.id, p]));

  const { totalRevenue, dailyRevenue } = weeklyRevenue;

  const totalTables = tableStats.reduce((sum, t) => sum + t._count, 0);
  const occupiedTables =
    tableStats.find((t) => t.status === "OCCUPIED")?._count ?? 0;
  const occupancyPct = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;

  const menuUrl = buildRestaurantUrl(tenant, "/menu");

  const activityIcons: Record<string, { icon: string; bg: string; color: string }> = {
    PENDING: { icon: "coffee", bg: "bg-secondary-fixed", color: "text-secondary" },
    CONFIRMED: { icon: "coffee", bg: "bg-secondary-fixed", color: "text-secondary" },
    PREPARING: { icon: "coffee", bg: "bg-secondary-fixed", color: "text-secondary" },
    READY: { icon: "check_circle", bg: "bg-primary-fixed", color: "text-primary" },
    COMPLETED: { icon: "check_circle", bg: "bg-primary-fixed", color: "text-primary" },
    CANCELLED: { icon: "info", bg: "bg-tertiary-fixed", color: "text-tertiary" },
  };

  return (
    <AdminPageShell title="Overview" searchPlaceholder="Search analytics...">
      <div className="mx-auto max-w-[1440px]">
        {/* Hero Metrics */}
        <section className="mb-admin-xl grid grid-cols-12 gap-gutter">
          <div className="group col-span-12 border border-tertiary-fixed bg-white p-admin-lg luxury-shadow transition-transform duration-300 hover:-translate-y-1 md:col-span-4">
            <div className="mb-admin-md flex items-start justify-between">
              <span className="text-label-md uppercase text-on-surface-variant">Total Revenue</span>
              <MaterialIcon name="payments" className="text-primary" />
            </div>
            <div className="mb-admin-base">
              <span className="font-display text-headline-md font-semibold">
                {formatCurrency(totalRevenue)}
              </span>
            </div>
            <div className="flex items-center gap-admin-sm">
              <span className="font-bold text-primary">7 days</span>
              <span className="text-label-sm text-on-surface-variant">rolling window</span>
            </div>
          </div>

          <div className="group col-span-12 border border-tertiary-fixed bg-white p-admin-lg luxury-shadow transition-transform duration-300 hover:-translate-y-1 md:col-span-4">
            <div className="mb-admin-md flex items-start justify-between">
              <span className="text-label-md uppercase text-on-surface-variant">Active Orders</span>
              <MaterialIcon name="receipt_long" className="text-primary" />
            </div>
            <div className="mb-admin-base">
              <span className="font-display text-headline-md font-semibold">{activeOrders}</span>
            </div>
            <div className="flex items-center gap-admin-sm">
              <span className="font-bold text-secondary">{products}</span>
              <span className="text-label-sm text-on-surface-variant">menu items</span>
            </div>
          </div>

          <div className="group col-span-12 border border-tertiary-fixed bg-white p-admin-lg luxury-shadow transition-transform duration-300 hover:-translate-y-1 md:col-span-4">
            <div className="mb-admin-md flex items-start justify-between">
              <span className="text-label-md uppercase text-on-surface-variant">Occupancy</span>
              <MaterialIcon name="table_restaurant" className="text-primary" />
            </div>
            <div className="mb-admin-base">
              <span className="font-display text-headline-md font-semibold">{occupancyPct}%</span>
            </div>
            <div className="mt-admin-md h-1 w-full overflow-hidden bg-tertiary-fixed">
              <div
                className="h-full bg-primary transition-all duration-1000"
                style={{ width: `${occupancyPct}%` }}
              />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-12 gap-gutter">
          {/* Weekly Revenue Chart */}
          <section className="col-span-12 border border-tertiary-fixed bg-white p-admin-lg luxury-shadow lg:col-span-8">
            <div className="mb-admin-xl flex items-center justify-between">
              <div>
                <h3 className="font-display text-headline-sm font-semibold">Weekly Revenue Trends</h3>
                <p className="text-body-md text-on-surface-variant">
                  Financial performance over the last 7 days.
                </p>
              </div>
              <Link
                href="/admin/analytics"
                className="border border-tertiary-fixed px-admin-md py-admin-sm text-label-md transition-colors hover:bg-surface-container-low"
              >
                View Analytics
              </Link>
            </div>
            <WeeklyRevenueChart data={dailyRevenue} />
          </section>

          {/* Activity Feed */}
          <section className="col-span-12 flex flex-col border border-tertiary-fixed bg-white p-admin-lg luxury-shadow lg:col-span-4">
            <div className="mb-admin-lg">
              <h3 className="font-display text-headline-sm font-semibold">Real-time Activity</h3>
              <p className="text-label-sm text-on-surface-variant">Updates from the floor</p>
            </div>
            <div className="flex-grow space-y-admin-md">
              {recentOrders.length === 0 ? (
                <p className="text-body-md text-on-surface-variant opacity-60">No recent activity</p>
              ) : (
                recentOrders.map((order) => {
                  const style = activityIcons[order.status] ?? activityIcons.PENDING;
                  const itemLabel = order.items[0]
                    ? `${order.items[0].name}${order.items[0].quantity > 1 ? ` (${order.items[0].quantity})` : ""}`
                    : formatCurrency(order.total);
                  return (
                    <div key={order.id} className="flex gap-admin-md">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.bg}`}
                      >
                        <MaterialIcon name={style.icon} className={style.color} />
                      </div>
                      <div className="w-full border-b border-tertiary-fixed pb-admin-sm">
                        <p className="text-body-md">
                          <span className="font-bold">Order #{order.orderNumber}</span> — {itemLabel}
                        </p>
                        <p className="text-label-sm text-on-surface-variant opacity-60">
                          {formatDateTime(order.createdAt)} • {order.status}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Link
              href="/admin/orders"
              className="mt-admin-lg text-label-md text-primary underline underline-offset-4 transition-transform hover:-translate-y-0.5"
            >
              View Full History
            </Link>
          </section>
        </div>

        {/* Menu Highlights + Quick Stats */}
        <section className="mt-admin-xl">
          <div className="mb-admin-lg grid grid-cols-12 gap-gutter">
            <div className="col-span-12 lg:col-span-7">
              <h3 className="font-display text-headline-sm font-semibold">Top Performing Items</h3>
            </div>
            <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-5">
              <div className="flex flex-col justify-between border border-tertiary-fixed bg-surface-container-low p-admin-md quiet-shadow">
                <span className="text-label-sm uppercase text-secondary">Active Items</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-headline-md font-bold">{activeProducts}</span>
                  <span className="text-label-sm text-primary">Live</span>
                </div>
              </div>
              <div className="flex flex-col justify-between border border-tertiary-fixed bg-white p-admin-md quiet-shadow">
                <span className="text-label-sm uppercase text-tertiary">Drafts</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-headline-md font-bold">{hiddenProducts}</span>
                  <span className="text-label-sm text-tertiary-fixed-dim">Hidden</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-4">
            {topProducts.length === 0 ? (
              <div className="col-span-full border border-tertiary-fixed bg-white p-admin-lg text-center text-on-surface-variant">
                No sales data yet — add menu items to get started.
              </div>
            ) : (
              topProducts.map((item, i) => {
                const product = topProductMap.get(item.productId);
                const imageUrl = product?.images[0]?.media.url;
                return (
                <div
                  key={item.productId}
                  className="group border border-tertiary-fixed bg-white luxury-shadow"
                >
                  <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-surface-container">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={product?.name ?? "Menu item"}
                        fill
                        className="object-cover"
                        sizes="(max-width:768px) 50vw, 25vw"
                      />
                    ) : (
                      <MaterialIcon
                        name="restaurant"
                        className="text-5xl text-primary-fixed-dim opacity-40"
                      />
                    )}
                  </div>
                  <div className="p-admin-md">
                    <h4 className="font-display text-headline-sm font-semibold text-on-background">
                      {product?.name ?? "Unknown item"}
                    </h4>
                    <div className="mt-admin-sm flex items-center justify-between">
                      <span className="text-label-sm text-on-surface-variant">
                        {item._sum.quantity} sold this week
                      </span>
                      <span className="bg-primary-fixed px-2 py-1 text-label-sm text-on-primary-fixed">
                        {i === 0 ? "Trending" : "Popular"}
                      </span>
                    </div>
                  </div>
                </div>
              );
              })
            )}
          </div>
        </section>

        {/* Quick Links */}
        <section className="mt-admin-xl grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/staff/floor"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 border border-tertiary-fixed bg-white p-admin-md transition-colors hover:border-primary"
          >
            <MaterialIcon name="point_of_sale" className="text-primary" />
            <span className="font-medium">Waiter POS</span>
          </a>
          <a
            href="/staff/login"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 border border-tertiary-fixed bg-white p-admin-md transition-colors hover:border-primary"
          >
            <MaterialIcon name="badge" className="text-primary" />
            <span className="font-medium">Staff Login</span>
          </a>
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 border border-tertiary-fixed bg-white p-admin-md transition-colors hover:border-primary"
          >
            <MaterialIcon name="menu_book" className="text-primary" />
            <span className="font-medium">Public Menu</span>
          </a>
          <Link
            href="/admin/orders"
            className="flex items-center gap-3 border border-tertiary-fixed bg-white p-admin-md transition-colors hover:border-primary"
          >
            <MaterialIcon name="receipt_long" className="text-primary" />
            <span className="font-medium">Floor & Orders</span>
          </Link>
        </section>

        <div className="mt-admin-lg max-w-2xl border-l-2 border-secondary py-2 pl-6">
          <p className="text-body-md italic text-on-surface-variant">
            Welcome back to {tenant.name}. Your public menu is live at{" "}
            <a href={menuUrl} target="_blank" className="text-primary underline">
              {menuUrl}
            </a>
            . Plan: {restaurant?.subscription?.plan.name ?? "—"} ({categories} categories).
          </p>
        </div>
      </div>
    </AdminPageShell>
  );
}
