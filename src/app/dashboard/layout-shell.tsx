import { redirect } from "next/navigation";
import { getSession, requireRestaurantStaff } from "@/lib/tenancy";
import { requireOperationalTenantPageContext } from "@/lib/restaurant-access";
import { prisma } from "@/lib/db";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { AdminThemeLock } from "@/components/layout/admin-theme-lock";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { SubscriptionGateOverlay } from "@/components/subscription-gate-overlay";
import { PlatformPoweredBy } from "@/components/platform-powered-by";
import { getEffectiveFeatures } from "@/lib/subscription";
import { getRestaurantWithSubscriptionCached } from "@/lib/request-cache";

export const dynamic = "force-dynamic";

export default async function DashboardLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const mustChangePassword = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  if (mustChangePassword?.mustChangePassword) {
    redirect("/change-password");
  }

  let tenant;
  try {
    tenant = await requireOperationalTenantPageContext();
    await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  } catch {
    redirect("/login");
  }

  const restaurant = await getRestaurantWithSubscriptionCached(tenant.restaurantId);

  if (!restaurant) redirect("/login");

  const { state: subscriptionState, codes: enabledFeatures } = await getEffectiveFeatures(
    tenant.restaurantId
  );

  const featureList = Array.from(enabledFeatures);

  return (
    <div className="light min-h-screen bg-surface text-on-surface">
      <AdminThemeLock />
      <DashboardSidebar
        restaurantName={restaurant.name}
        enabledFeatures={featureList}
        planName={subscriptionState.planName}
        logoUrl={restaurant.branding?.logo?.url ?? null}
      />
      <div className="ml-64 flex min-h-screen flex-col bg-surface">
        {subscriptionState.banner && (
          <SubscriptionBanner banner={subscriptionState.banner} />
        )}
        <main className="flex-1 bg-surface">{children}</main>
        <footer className="border-t bg-surface px-6 py-4">
          <PlatformPoweredBy />
        </footer>
        {subscriptionState.isSuspended && !subscriptionState.isGracePeriod && (
          <SubscriptionGateOverlay />
        )}
      </div>
    </div>
  );
}
