import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  linkModifierGroupToProductService,
  unlinkModifierGroupFromProductService,
} from "@/lib/product-config-admin.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ productId: string; groupId: string }> }
) {
  const { productId, groupId } = await params;
  const result = await linkModifierGroupToProductService(productId, groupId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidatePath(`/dashboard/products/${productId}`);
  return NextResponse.json(result);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ productId: string; groupId: string }> }
) {
  const { productId, groupId } = await params;
  const result = await unlinkModifierGroupFromProductService(productId, groupId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidatePath(`/dashboard/products/${productId}`);
  return NextResponse.json(result);
}
