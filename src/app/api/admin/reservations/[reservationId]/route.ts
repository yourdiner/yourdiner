import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";
import { requireTenantContext } from "@/lib/tenancy";
import { requireAdminOrderActor } from "@/features/dining-session/auth";
import { requireRestaurantStaff } from "@/lib/tenancy";
import {
  updateReservation,
  confirmReservation,
  cancelReservation,
  markNoShow,
  changeReservationTable,
} from "@/features/reservations/reservation.service";
import { checkInReservation } from "@/features/reservations/check-in.service";
import { getReservationDetail } from "@/features/reservations/reservation-queries";
import { updateReservationSchema, changeTableSchema } from "@/features/reservations/schemas";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

function revalidate() {
  revalidatePath("/admin/reservations");
  revalidatePath("/dashboard/reservations");
}

export const GET = withSubscriptionGuard(
  async (_request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    const { reservationId } = await context.params;
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId);
    const reservation = await getReservationDetail(reservationId, tenant.restaurantId);
    if (!reservation) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: reservation });
  },
  { feature: "reservations" }
);

export const PATCH = withSubscriptionGuard(
  async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      const { reservationId } = await context.params;
      const tenant = await requireTenantContext();
      const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
      const body = updateReservationSchema.parse(await request.json());
      const reservation = await updateReservation(
        reservationId,
        tenant.restaurantId,
        body,
        actor
      );
      revalidate();
      return NextResponse.json({ ok: true, data: reservation });
    } catch (error) {
      return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 400 });
    }
  },
  { feature: "reservations", writable: true }
);

export const POST = withSubscriptionGuard(
  async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      const { reservationId } = await context.params;
      const tenant = await requireTenantContext();
      const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
      const body = (await request.json()) as { action: string; staffId?: string; tableId?: string };

      let result;
      switch (body.action) {
        case "confirm":
          result = await confirmReservation(reservationId, tenant.restaurantId, actor);
          break;
        case "cancel":
          result = await cancelReservation(reservationId, tenant.restaurantId, actor);
          break;
        case "checkIn":
          result = await checkInReservation(reservationId, tenant.restaurantId, actor, {
            staffId: body.staffId,
          });
          break;
        case "noShow":
          result = await markNoShow(reservationId, tenant.restaurantId, actor);
          break;
        case "changeTable":
          result = await changeReservationTable(
            reservationId,
            tenant.restaurantId,
            changeTableSchema.parse({ tableId: body.tableId }).tableId,
            actor
          );
          break;
        default:
          return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
      }

      revalidate();
      revalidatePath("/admin/orders");
      return NextResponse.json({ ok: true, data: result });
    } catch (error) {
      return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 400 });
    }
  },
  { feature: "reservations", writable: true }
);
