import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/staff-session";
import { requireOperationalTenantPageContext } from "@/lib/restaurant-access";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getRestaurantSubscriptionState } from "@/lib/permissions";
import { restaurantHasFeature } from "@/lib/plan-access";
import { StaffProtectedShell } from "@/features/staff/components/staff-protected-shell";
import { PlatformPoweredBy } from "@/components/platform-powered-by";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StaffProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  const tenant = await requireOperationalTenantPageContext();
  if (session.restaurantId !== tenant.restaurantId) redirect("/staff/login");

  const staffFlags = await prisma.staff.findUnique({
    where: { id: session.staffId },
    select: { mustChangePassword: true },
  });
  if (staffFlags?.mustChangePassword) {
    redirect("/staff/change-password");
  }

  const subscriptionState = await getRestaurantSubscriptionState(tenant.restaurantId);

  if (!subscriptionState.isActive || subscriptionState.isSuspended) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-bold">Staff Access Unavailable</h1>
          <p className="text-sm text-muted-foreground">
            Restaurant operations are paused because the subscription is inactive or expired.
            Please contact the restaurant owner to renew.
          </p>
          <Link href="/staff/login">
            <Button variant="outline">Back to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasWaiterOrdering = await restaurantHasFeature(
    tenant.restaurantId,
    "waiter_ordering"
  );

  if (!hasWaiterOrdering) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-bold">Waiter Ordering Not Available</h1>
          <p className="text-sm text-muted-foreground">
            Your restaurant plan does not include waiter POS ordering. Upgrade to
            Professional or Premium to enable staff order taking.
          </p>
          <Link href="/staff/login">
            <Button variant="outline">Back to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <StaffProtectedShell
      restaurantName={tenant.name}
      staffName={session.displayName}
      staffRole={session.role}
    >
      {children}
      <div className="px-4 py-4">
        <PlatformPoweredBy />
      </div>
    </StaffProtectedShell>
  );
}
