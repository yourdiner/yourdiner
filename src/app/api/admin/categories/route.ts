import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createCategoryService } from "@/lib/menu-category-service";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/dashboard/categories");
}

export const POST = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = await request.json();
    const result = await createCategoryService(body);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    revalidateCategories();
    return NextResponse.json(result);
  },
  { feature: "categories" }
);
