import { NextRequest, NextResponse } from "next/server";
import { requireMenuCatalogStaff } from "@/lib/menu-catalog/auth";
import { listCategoryProductCards, getProductConfig, searchMenuProductCards } from "@/lib/menu-catalog";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Staff/admin/waiter catalog:
 * GET ?categoryId=... → product cards
 * GET ?productId=... → full config
 * GET ?q=... → search cards
 */
export async function GET(request: NextRequest) {
  try {
    const { tenant } = await requireMenuCatalogStaff();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const productId = searchParams.get("productId");
    const q = searchParams.get("q");

    if (productId) {
      const product = await getProductConfig(tenant.restaurantId, productId, "staff");
      if (!product) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(product);
    }

    if (categoryId) {
      const products = await listCategoryProductCards(
        tenant.restaurantId,
        categoryId,
        "staff"
      );
      return NextResponse.json(products);
    }

    if (q != null) {
      const products = await searchMenuProductCards(tenant.restaurantId, q, "staff");
      return NextResponse.json(products);
    }

    return NextResponse.json({ error: "Missing categoryId, productId, or q" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 403 });
  }
}
