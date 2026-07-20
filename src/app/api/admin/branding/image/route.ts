import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { uploadBrandingImageFile } from "@/lib/media-upload-service";
import { requireTenantContext } from "@/lib/tenancy";
import { revalidatePublicMenuCache } from "@/lib/menu-cache";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as "logo" | "cover" | "favicon" | null;

  if (!file) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }
  if (!type || !["logo", "cover", "favicon"].includes(type)) {
    return NextResponse.json({ ok: false, error: "Invalid image type" }, { status: 400 });
  }

  const result = await uploadBrandingImageFile(type, file);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  const tenant = await requireTenantContext();
  revalidatePublicMenuCache(tenant.restaurantId);
  revalidatePath("/admin/branding");
  revalidatePath("/dashboard/branding");
  revalidatePath("/public-menu/menu");
  return NextResponse.json(result);
}
