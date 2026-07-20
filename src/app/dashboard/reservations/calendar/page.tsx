import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasModuleAccess } from "@/lib/plan-access";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { getCalendarData } from "@/features/reservations/reservation-queries";
import { ReservationCalendar } from "@/features/reservations/components/reservation-calendar";
import { CalendarDatePicker } from "@/features/reservations/components/calendar-date-picker";

export const dynamic = "force-dynamic";

export default async function ReservationsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "reservations");
  if (!hasAccess) redirect("/admin/reservations");

  const params = await searchParams;
  const day = params.date ? new Date(params.date) : new Date();
  const data = await getCalendarData(tenant.restaurantId, day);
  const dateStr = data.day.toISOString().slice(0, 10);

  return (
    <AdminPageShell title="Reservation Calendar" showSearch={false}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/reservations" className="text-sm text-primary underline">
          Back to dashboard
        </Link>
        <CalendarDatePicker dateStr={dateStr} />
      </div>
      <ReservationCalendar
        tables={data.tables}
        reservations={data.reservations}
        sessions={data.sessions}
        day={data.day}
      />
    </AdminPageShell>
  );
}
