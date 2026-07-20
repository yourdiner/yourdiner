import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";
import { requireTenantContext } from "@/lib/tenancy";
import { requireAdminOrderActor } from "@/features/dining-session/auth";
import { requireRestaurantStaff } from "@/lib/tenancy";
import { createReservation } from "@/features/reservations/reservation.service";
import { listReservations } from "@/features/reservations/reservation-queries";
import { createReservationSchema } from "@/features/reservations/schemas";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

function revalidate() {
  revalidatePath("/admin/reservations");
  revalidatePath("/dashboard/reservations");
}

export const GET = withSubscriptionGuard(
  async (request: NextRequest) => {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId);
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date");
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (date) {
      dateFrom = new Date(date);
      dateFrom.setHours(0, 0, 0, 0);
      dateTo = new Date(date);
      dateTo.setHours(23, 59, 59, 999);
    }
    const reservations = await listReservations(tenant.restaurantId, {
      dateFrom,
      dateTo,
      status: (searchParams.get("status") as never) || undefined,
      search: searchParams.get("q") || undefined,
    });
    return NextResponse.json({ ok: true, data: reservations });
  },
  { feature: "reservations" }
);

export const POST = withSubscriptionGuard(
  async (request: NextRequest) => {
    try {
      const tenant = await requireTenantContext();
      const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
      const { staff } = await requireRestaurantStaff(tenant.restaurantId, [
        "OWNER",
        "MANAGER",
        "CASHIER",
      ]);
      const body = createReservationSchema.parse(await request.json());
      const reservation = await createReservation(
        tenant.restaurantId,
        body,
        actor,
        staff.id
      );
      revalidate();
      return NextResponse.json({ ok: true, data: reservation });
    } catch (error) {
      return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 400 });
    }
  },
  { feature: "reservations", writable: true }
);
