import { NextResponse } from "next/server";
import { requireStaffTenantSession } from "@/lib/staff-session";
import { fetchFloorTablesForRestaurant } from "@/features/floor/queries";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { staffSession, tenant } = await requireStaffTenantSession();
    const tables = await fetchFloorTablesForRestaurant(tenant.restaurantId);
    return NextResponse.json({
      ok: true,
      data: {
        tables,
        viewer: { staffId: staffSession.staffId, role: staffSession.role },
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
