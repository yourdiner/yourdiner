import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { reorderCategoriesService } from "@/lib/menu-category-service";

export const runtime = "nodejs";

function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/dashboard/categories");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await reorderCategoriesService(body);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  revalidateCategories();
  return NextResponse.json(result);
}
