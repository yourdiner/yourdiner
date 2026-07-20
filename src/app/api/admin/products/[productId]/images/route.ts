import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addProductImageFile } from "@/lib/media-upload-service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const isPrimary = formData.get("isPrimary") === "true";

  if (!file) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }

  const result = await addProductImageFile(productId, file, isPrimary);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/dashboard/products");
  return NextResponse.json(result);
}
