import { redirect } from "next/navigation";
import { requireTenantPageContext } from "@/lib/tenancy";
import { prisma } from "@/lib/db";
import { getTableAvailability } from "@/features/tables/table-availability.service";
import { StartSessionForm } from "@/features/dining/components/start-session-form";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ tableId?: string }>;
}) {
  const { tableId } = await searchParams;
  if (!tableId) redirect("/staff/floor");

  const tenant = await requireTenantPageContext();
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId: tenant.restaurantId, isActive: true },
  });
  if (!table) redirect("/staff/floor");

  const availability = await getTableAvailability(tenant.restaurantId, tableId);

  if (availability?.activeSession) {
    redirect(`/staff/order/${availability.activeSession.id}`);
  }

  // Dining-window RESERVED can still start (conflict/override); hold-window cannot.
  const statusOk =
    availability &&
    (availability.status === "AVAILABLE" ||
      (availability.status === "RESERVED" && availability.canStartSession));

  if (!statusOk || !availability.canStartSession) {
    redirect("/staff/floor?error=table-unavailable");
  }

  return (
    <StartSessionForm
      tableId={table.id}
      tableLabel={table.name || `Table ${table.number}`}
      capacity={table.capacity}
    />
  );
}
