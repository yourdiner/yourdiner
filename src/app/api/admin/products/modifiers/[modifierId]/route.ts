import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteModifierService } from "@/lib/product-config-admin.service";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ modifierId: string }> }
) {
  const { modifierId } = await params;
  const result = await deleteModifierService(modifierId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidatePath("/admin/products");
  return NextResponse.json(result);
}
