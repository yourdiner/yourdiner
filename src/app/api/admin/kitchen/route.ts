import { NextResponse } from "next/server";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import {
  getKitchenQueue,
  serializeKitchenTickets,
} from "@/features/fulfillment/fulfillment-queries";

export const runtime = "nodejs";

export const GET = withSubscriptionGuard(
  async () => {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, [
      "OWNER",
      "MANAGER",
      "CASHIER",
      "KITCHEN",
    ]);
    const tickets = serializeKitchenTickets(await getKitchenQueue(tenant.restaurantId));
    return NextResponse.json({ ok: true, data: tickets });
  },
  { feature: "kitchen" }
);
