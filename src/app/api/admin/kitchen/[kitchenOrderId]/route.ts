import { NextRequest, NextResponse } from "next/server";
import { updateKitchenOrderStatusMutation } from "@/features/fulfillment/kitchen-mutations";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

export const POST = withSubscriptionGuard(
  async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ) => {
    const { kitchenOrderId } = await context.params;
    const body = await request.json();
    const result = await updateKitchenOrderStatusMutation(kitchenOrderId, body);
    const status = result.ok ? 200 : result.error === "Unauthorized" ? 401 : 400;
    return NextResponse.json(result, { status });
  },
  { feature: "kitchen" }
);
