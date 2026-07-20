import { NextRequest, NextResponse } from "next/server";
import { runStaffOrderMutation, type StaffOrderAction } from "@/lib/order-mutations";
import { requireTenantContext } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const tenant = await requireTenantContext();
    await requirePlanFeature(tenant.restaurantId, "waiter_ordering");
    const body = (await request.json()) as StaffOrderAction;
    const result = await runStaffOrderMutation(sessionId, body);
    const status = result.ok ? 200 : result.error === "STAFF_UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 403 });
  }
}
