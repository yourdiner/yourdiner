import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { toggleProductVisibilityService } from "@/lib/menu-product-service";

export const runtime = "nodejs";

function revalidateProducts(productId: string) {
  revalidatePath("/admin/products");
  revalidatePath("/dashboard/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/dashboard/products/${productId}`);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const result = await toggleProductVisibilityService(productId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidateProducts(productId);
  return NextResponse.json(result);
}
