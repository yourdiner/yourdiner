import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/tenancy";
import { getCachedCategoryProductCards } from "@/lib/menu-catalog";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params;
    const tenant = await requireTenantContext();
    const products = await getCachedCategoryProductCards(
      tenant.restaurantId,
      categoryId,
      "public"
    );
    return NextResponse.json(products, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return NextResponse.json([], { status: 403 });
  }
}
