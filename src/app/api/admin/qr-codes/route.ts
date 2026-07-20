import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  generateMenuQRService,
  regenerateQRService,
  invalidateQRService,
  generateQRImageDataUrlService,
} from "@/lib/qr-service";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";

export const runtime = "nodejs";

function revalidateQr() {
  revalidatePath("/admin/qr-codes");
  revalidatePath("/dashboard/qr-codes");
}

export const POST = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = (await request.json()) as { action: string; qrCodeId?: string };
    if (body.action === "generate") {
      const result = await generateMenuQRService();
      if (!result.ok) return NextResponse.json(result, { status: 400 });
      revalidateQr();
      return NextResponse.json(result);
    }
    if (body.action === "regenerate" && body.qrCodeId) {
      const result = await regenerateQRService(body.qrCodeId);
      if (!result.ok) return NextResponse.json(result, { status: 400 });
      revalidateQr();
      return NextResponse.json(result);
    }
    if (body.action === "invalidate" && body.qrCodeId) {
      const result = await invalidateQRService(body.qrCodeId);
      if (!result.ok) return NextResponse.json(result, { status: 400 });
      revalidateQr();
      return NextResponse.json(result);
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  },
  { feature: "qr_codes" }
);

export const GET = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

    const url = new URL(request.url).searchParams.get("url");
    if (!url) return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });
    const result = await generateQRImageDataUrlService(url);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  },
  { feature: "qr_codes" }
);
