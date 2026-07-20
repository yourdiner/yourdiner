import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { duplicateProductService } from "@/lib/menu-product-service";

export const runtime = "nodejs";

function revalidateProducts(productId?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/dashboard/products");
  if (productId) {
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath(`/dashboard/products/${productId}`);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const result = await duplicateProductService(productId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidateProducts(result.data.id);
  return NextResponse.json(result);
}
