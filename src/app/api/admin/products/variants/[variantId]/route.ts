import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteVariantService } from "@/lib/menu-product-service";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const { variantId } = await params;
  const result = await deleteVariantService(variantId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidatePath("/admin/products");
  return NextResponse.json(result);
}
