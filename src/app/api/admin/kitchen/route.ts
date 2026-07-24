import { NextRequest, NextResponse } from "next/server";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import {
  getKitchenQueue,
  serializeKitchenTickets,
} from "@/features/fulfillment/fulfillment-queries";
import { listKitchenQueueItems } from "@/features/fulfillment/kitchen-item.service";

export const runtime = "nodejs";

export const GET = withSubscriptionGuard(
  async (request: NextRequest) => {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, [
      "OWNER",
      "MANAGER",
      "CASHIER",
      "KITCHEN",
    ]);

    const sinceParam = request.nextUrl.searchParams.get("since");
    const since = sinceParam ? new Date(sinceParam) : undefined;
    if (since && Number.isNaN(since.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Invalid since timestamp" },
        { status: 400 }
      );
    }

    const [tickets, itemPayload] = await Promise.all([
      // Full ticket list only on snapshot (no since) for backward compatibility
      since
        ? Promise.resolve([])
        : getKitchenQueue(tenant.restaurantId).then(serializeKitchenTickets),
      listKitchenQueueItems(tenant.restaurantId, { since }),
    ]);

    return NextResponse.json({
      ok: true,
      data: tickets,
      items: itemPayload.items,
      clearedIds: itemPayload.clearedIds,
      serverTime: itemPayload.serverTime,
    });
  },
  { feature: "kitchen" }
);
