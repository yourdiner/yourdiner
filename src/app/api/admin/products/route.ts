import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createProductService } from "@/lib/menu-product-service";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

export const POST = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = await request.json();
    const result = await createProductService(body);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    revalidatePath("/admin/products");
    revalidatePath("/dashboard/products");
    return NextResponse.json(result);
  },
  { feature: "products" }
);
