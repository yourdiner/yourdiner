import { NextRequest, NextResponse } from "next/server";
import {
  createTakeawayOrderMutation,
  createDeliveryOrderMutation,
} from "@/features/fulfillment/fulfillment-mutations";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

export const POST = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = (await request.json()) as {
      type: "takeaway" | "delivery";
      [key: string]: unknown;
    };

    const result =
      body.type === "delivery"
        ? await createDeliveryOrderMutation(body)
        : await createTakeawayOrderMutation(body);

    const status = result.ok ? 200 : 400;
    return NextResponse.json(result, { status });
  },
  { feature: "fulfillment" }
);
