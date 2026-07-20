import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateProductService, deleteProductService } from "@/lib/menu-product-service";

export const runtime = "nodejs";

function revalidateProducts(productId?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/dashboard/products");
  if (productId) {
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath(`/dashboard/products/${productId}`);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const body = await request.json();
  const result = await updateProductService(productId, body);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidateProducts(productId);
  return NextResponse.json(result);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const result = await deleteProductService(productId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidateProducts();
  return NextResponse.json(result);
}
