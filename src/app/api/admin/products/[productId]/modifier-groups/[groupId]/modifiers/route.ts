import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addModifierToGroupService } from "@/lib/product-config-admin.service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string; groupId: string }> }
) {
  const { productId, groupId } = await params;
  const body = await request.json();
  const result = await addModifierToGroupService(groupId, { ...body, groupId });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/dashboard/products/${productId}`);
  return NextResponse.json(result);
}
