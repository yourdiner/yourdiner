import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/tenancy";
import { PlatformSidebarServer } from "@/components/layout/platform-sidebar-server";
import { getPlatformStats } from "@/features/restaurants/actions";
import { StatCard } from "@/components/stat-card";
import { Building2, Users, CreditCard, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getPlatformBrand } from "@/lib/platform-brand";

export default async function PlatformDashboardPage() {
  try {
    await requireSuperAdmin();
  } catch {
    redirect("/login");
  }

  const [stats, { brandName }] = await Promise.all([
    getPlatformStats(),
    getPlatformBrand(),
  ]);

  return (
    <div className="flex h-screen">
      <PlatformSidebarServer />
      <main className="flex-1 overflow-y-auto">
        <div className="border-b px-8 py-6">
          <h1 className="text-2xl font-bold">Platform Dashboard</h1>
          <p className="text-muted-foreground">Overview of your {brandName} platform</p>
        </div>
        <div className="p-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Restaurants"
              value={stats.totalRestaurants}
              icon={Building2}
            />
            <StatCard
              title="Active Restaurants"
              value={stats.activeRestaurants}
              icon={Users}
              description={`${stats.trialUsers} on trial`}
            />
            <StatCard
              title="Expired Users"
              value={stats.expiredUsers}
              icon={CreditCard}
            />
            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats.totalRevenue)}
              icon={TrendingUp}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
