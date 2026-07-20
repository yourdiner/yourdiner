import { NextResponse } from "next/server";
import { exportMenuService } from "@/lib/menu-product-service";

export const runtime = "nodejs";

export async function GET() {
  const result = await exportMenuService();
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
