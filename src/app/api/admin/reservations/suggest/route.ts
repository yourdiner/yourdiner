import { NextRequest, NextResponse } from "next/server";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { suggestBestTable } from "@/features/reservations/assignment.service";
import {
  computeReservationWindow,
  getRestaurantReservationSettings,
  snapToInterval,
} from "@/lib/reservation-settings";
import { getErrorMessage } from "@/lib/errors";
import { z } from "zod";

export const runtime = "nodejs";

const suggestSchema = z.object({
  reservedAt: z.string(),
  guestCount: z.number().int().min(1),
});

export const POST = withSubscriptionGuard(
  async (request: NextRequest) => {
    try {
      const tenant = await requireTenantContext();
      await requireRestaurantStaff(tenant.restaurantId, [
        "OWNER",
        "MANAGER",
        "CASHIER",
      ]);
      const body = suggestSchema.parse(await request.json());
      const settings = await getRestaurantReservationSettings(tenant.restaurantId);
      const reservedAt = snapToInterval(
        new Date(body.reservedAt),
        settings.reservationIntervalMinutes
      );
      const { expectedEndAt } = computeReservationWindow(reservedAt, settings);
      const table = await suggestBestTable(
        tenant.restaurantId,
        reservedAt,
        expectedEndAt,
        body.guestCount
      );
      return NextResponse.json({ ok: true, data: table });
    } catch (error) {
      return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 400 });
    }
  },
  { feature: "reservations" }
);
