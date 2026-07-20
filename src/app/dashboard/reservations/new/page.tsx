import { redirect } from "next/navigation";
import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasModuleAccess } from "@/lib/plan-access";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { prisma } from "@/lib/db";
import { ReservationForm } from "@/features/reservations/components/reservation-form";

export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "reservations");
  if (!hasAccess) redirect("/admin/reservations");

  const tables = await prisma.table.findMany({
    where: { restaurantId: tenant.restaurantId, isActive: true, status: { not: "DISABLED" } },
    orderBy: { number: "asc" },
    select: { id: true, name: true, number: true, capacity: true },
  });

  return (
    <AdminPageShell title="New Reservation" showSearch={false}>
      <ReservationForm tables={tables} />
    </AdminPageShell>
  );
}
