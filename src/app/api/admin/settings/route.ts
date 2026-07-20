import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateRestaurantSettingsService } from "@/lib/restaurant-settings-service";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

export const PATCH = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = await request.json();
    const result = await updateRestaurantSettingsService(body);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    revalidatePath("/admin/settings");
    revalidatePath("/dashboard/settings");
    return NextResponse.json(result);
  },
  { writable: true }
);
