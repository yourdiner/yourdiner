import { NextRequest, NextResponse } from "next/server";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { getWalkInConflictWarning } from "@/features/reservations/availability.service";
import { getRestaurantReservationSettings } from "@/lib/reservation-settings";

export const runtime = "nodejs";

export const GET = withSubscriptionGuard(
  async (request: NextRequest) => {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, [
      "OWNER",
      "MANAGER",
      "CASHIER",
    ]);
    const tableId = request.nextUrl.searchParams.get("tableId");
    const at = request.nextUrl.searchParams.get("at");
    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId required" }, { status: 400 });
    }
    const settings = await getRestaurantReservationSettings(tenant.restaurantId);
    const warning = await getWalkInConflictWarning(
      tenant.restaurantId,
      tableId,
      at ? new Date(at) : new Date(),
      settings
    );
    return NextResponse.json({ ok: true, data: { warning } });
  },
  { feature: "reservations" }
);
