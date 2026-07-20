import Link from "next/link";
import { requireTenantPageContext } from "@/lib/tenancy";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { getReservationsDashboard } from "@/features/reservations/reservation-queries";
import { ReservationsDashboard } from "@/features/reservations/components/reservations-dashboard";
import { ReservationsList } from "@/features/reservations/components/reservations-list";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "reservations");

  if (!hasAccess) {
    const planLabel = getModuleUpgradeLabel("reservations");
    return (
      <AdminPageShell title="Reservations">
        <UpgradePrompt
          title={`Upgrade to ${planLabel} Plan`}
          description="Reservation management is available on the Starter plan and above."
        />
      </AdminPageShell>
    );
  }

  const data = await getReservationsDashboard(tenant.restaurantId);

  const tables = await prisma.table.findMany({
    where: { restaurantId: tenant.restaurantId, isActive: true, status: { not: "DISABLED" } },
    orderBy: { number: "asc" },
    select: { id: true, name: true, number: true, capacity: true },
  });

  return (
    <AdminPageShell title="Reservations">
      <div className="space-y-8">
        <ReservationsDashboard data={data} />
        <section>
          <h2 className="mb-4 font-display text-headline-sm font-semibold">
            Today&apos;s reservations
          </h2>
          <ReservationsList reservations={data.today} tables={tables} />
        </section>
      </div>
    </AdminPageShell>
  );
}
