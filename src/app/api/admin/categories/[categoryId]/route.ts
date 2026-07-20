import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteCategoryService } from "@/lib/menu-category-service";

export const runtime = "nodejs";

function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/dashboard/categories");
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params;
  const result = await deleteCategoryService(categoryId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidateCategories();
  return NextResponse.json(result);
}
