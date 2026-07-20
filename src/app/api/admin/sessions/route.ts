import { NextRequest, NextResponse } from "next/server";
import { startAdminSession } from "@/lib/session-mutations";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

export const POST = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = await request.json();
    const result = await startAdminSession(body);
    const status = result.ok ? 200 : 400;
    return NextResponse.json(result, { status });
  },
  { feature: "orders" }
);
