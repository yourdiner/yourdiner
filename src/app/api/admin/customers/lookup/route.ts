import { NextRequest, NextResponse } from "next/server";
import { lookupAdminCustomer } from "@/lib/session-mutations";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

export const GET = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const phone = request.nextUrl.searchParams.get("phone") ?? "";
    const customer = await lookupAdminCustomer(phone);
    return NextResponse.json(customer);
  },
  { feature: "customers" }
);
