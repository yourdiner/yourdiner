import { NextRequest, NextResponse } from "next/server";
import { lookupCustomerForOrder } from "@/lib/customer-order-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const phone = new URL(request.url).searchParams.get("phone");
  if (!phone) return NextResponse.json(null);

  try {
    const { requireTenantContext } = await import("@/lib/tenancy");
    const tenant = await requireTenantContext();
    const customer = await lookupCustomerForOrder(tenant.restaurantId, phone);
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json(null);
  }
}
