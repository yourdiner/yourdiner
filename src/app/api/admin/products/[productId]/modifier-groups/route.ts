import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createModifierGroupForProductService,
  linkModifierGroupToProductService,
} from "@/lib/product-config-admin.service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const body = await request.json();
  const result = await createModifierGroupForProductService(productId, body);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/dashboard/products/${productId}`);
  return NextResponse.json(result);
}
