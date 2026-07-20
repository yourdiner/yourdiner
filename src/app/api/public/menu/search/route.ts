import { NextRequest, NextResponse } from "next/server";
import { searchPublicMenuService } from "@/lib/qr-service";
import { requireTenantContext } from "@/lib/tenancy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q) {
    return NextResponse.json([]);
  }

  try {
    const tenant = await requireTenantContext();
    // Host-bound only — ignore client restaurantId to prevent cross-tenant catalog search.
    const results = await searchPublicMenuService(tenant.restaurantId, q);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
