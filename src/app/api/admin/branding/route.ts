import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateBrandingService } from "@/lib/branding-service";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";
import { requireTenantContext } from "@/lib/tenancy";
import { revalidatePublicMenuCache } from "@/lib/menu-cache";

export const runtime = "nodejs";

export const PATCH = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = await request.json();
    const result = await updateBrandingService(body);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    const tenant = await requireTenantContext();
    revalidatePublicMenuCache(tenant.restaurantId);
    revalidatePath("/admin/branding");
    revalidatePath("/dashboard/branding");
    revalidatePath("/public-menu/menu");
    return NextResponse.json(result);
  },
  { feature: "branding" }
);
