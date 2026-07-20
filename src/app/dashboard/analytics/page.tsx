import { requireTenantPageContext } from "@/lib/tenancy";
import { prisma } from "@/lib/db";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ShoppingBag, Users, TrendingUp, UtensilsCrossed } from "lucide-react";
import { getAnalyticsByOrderType } from "@/features/fulfillment/fulfillment-queries";
import { OrderType } from "@prisma/client";
import { cancelledOrderStatusFilter } from "@/lib/prisma-filters";
import { getThirtyDayOrderStats } from "@/features/dashboard/queries";

const TYPE_LABELS: Record<OrderType, string> = {
  DINE_IN: "Dine-In",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
};

export default async function AnalyticsPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "analytics");

  if (!hasAccess) {
    const planLabel = getModuleUpgradeLabel("analytics");
    return (
      <div>
        <div className="border-b px-8 py-4">
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>
        <div className="p-6">
          <UpgradePrompt
            title={`Upgrade to ${planLabel} Plan`}
            description="Full analytics dashboard is available on the Customer Ordering plan."
          />
        </div>
      </div>
    );
  }

  const restaurantId = tenant.restaurantId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [orderStats, customerCount, productCount, recentOrders, topProducts, byType] =
    await Promise.all([
      getThirtyDayOrderStats(restaurantId, thirtyDaysAgo),
      prisma.customer.count({ where: { restaurantId } }),
      prisma.product.count({ where: { restaurantId, isAvailable: true } }),
      prisma.order.findMany({
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { orderNumber: true, total: true, status: true, createdAt: true },
      }),
      prisma.orderItem.groupBy({
        by: ["name"],
        where: {
          order: {
            restaurantId,
            createdAt: { gte: thirtyDaysAgo },
            ...cancelledOrderStatusFilter(),
          },
        },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      getAnalyticsByOrderType(restaurantId, thirtyDaysAgo),
    ]);

  const revenue30d = orderStats.revenueTotal;
  const orders30d = orderStats.orderCount;

  const typeStats = (Object.values(OrderType) as OrderType[]).map((orderType) => {
    const row = byType.orders.find((o) => o.orderType === orderType);
    const count = row?._count ?? 0;
    const revenue = row?._sum.total ?? 0;
    const aov = count > 0 ? Math.round(revenue / count) : 0;
    const topItems = byType.topByType.find((t) => t.orderType === orderType)?.items ?? [];
    return { orderType, count, revenue, aov, topItems };
  });

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Revenue, orders, and performance insights</p>
      </div>
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Revenue (30d)"
            value={formatCurrency(revenue30d)}
            icon={TrendingUp}
          />
          <StatCard title="Orders (30d)" value={orders30d} icon={ShoppingBag} />
          <StatCard title="Customers" value={customerCount} icon={Users} />
          <StatCard title="Active Products" value={productCount} icon={UtensilsCrossed} />
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold">By order type (30d)</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {typeStats.map(({ orderType, count, revenue, aov }) => (
              <Card key={orderType}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{TYPE_LABELS[orderType]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>Revenue: {formatCurrency(revenue)}</p>
                  <p>Orders: {count}</p>
                  <p>AOV: {formatCurrency(aov)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {typeStats.map(({ orderType, topItems }) => (
            <Card key={`top-${orderType}`}>
              <CardHeader>
                <CardTitle className="text-base">Top products · {TYPE_LABELS[orderType]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">
                      {item._sum.quantity} sold · {formatCurrency(item._sum.totalPrice || 0)}
                    </span>
                  </div>
                ))}
                {topItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No sales data yet</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Products (30d)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topProducts.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">
                    {item._sum.quantity} sold · {formatCurrency(item._sum.totalPrice || 0)}
                  </span>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="text-sm text-muted-foreground">No sales data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.orderNumber} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">#{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p>{formatCurrency(order.total)}</p>
                    <p className="text-xs text-muted-foreground">{order.status}</p>
                  </div>
                </div>
              ))}
              {recentOrders.length === 0 && (
                <p className="text-sm text-muted-foreground">No orders yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
