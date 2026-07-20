import { NextRequest, NextResponse } from "next/server";
import {
  runFulfillmentOrderMutation,
  type FulfillmentOrderAction,
} from "@/features/fulfillment/fulfillment-mutations";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

export const POST = withSubscriptionGuard(
  async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ) => {
    const { orderId } = await context.params;
    const body = (await request.json()) as FulfillmentOrderAction;
    const result = await runFulfillmentOrderMutation(orderId, body);
    const status = result.ok ? 200 : result.error === "Unauthorized" ? 401 : 400;
    return NextResponse.json(result, { status });
  },
  { feature: "fulfillment" }
);
