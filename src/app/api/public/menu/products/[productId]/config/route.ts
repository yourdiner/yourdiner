import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/tenancy";
import { getCachedOrFreshProductConfig } from "@/lib/menu-catalog";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const tenant = await requireTenantContext();
    const product = await getCachedOrFreshProductConfig(
      tenant.restaurantId,
      productId,
      "public"
    );
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(product, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
