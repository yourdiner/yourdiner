import { NextResponse } from "next/server";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";
import { getActiveDiningSessions } from "@/features/dining-session/session.service";
import { requireTenantContext } from "@/lib/tenancy";
import { requireAdminOrderActor } from "@/features/dining-session/auth";

export const runtime = "nodejs";

export const GET = withSubscriptionGuard(
  async () => {
    const tenant = await requireTenantContext();
    await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });

    const sessions = await getActiveDiningSessions(tenant.restaurantId);
    const payload = sessions.map((session) => ({
      id: session.id,
      status: session.status,
      source: session.source,
      guestCount: session.guestCount,
      table: {
        id: session.table.id,
        number: session.table.number,
        name: session.table.name,
      },
      staff: session.staff,
      customer: session.customer,
      orders: session.orders.map((order) => ({ total: order.total, status: order.status })),
      events: session.events,
    }));

    return NextResponse.json({ ok: true, data: payload });
  },
  { feature: "orders" }
);
