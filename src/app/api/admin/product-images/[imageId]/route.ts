import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { removeProductImageById } from "@/lib/media-upload-service";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;
  const result = await removeProductImageById(imageId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  revalidatePath("/admin/products");
  revalidatePath("/dashboard/products");
  return NextResponse.json(result);
}
