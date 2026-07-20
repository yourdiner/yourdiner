import { NextRequest, NextResponse } from "next/server";
import { getCustomerSessionStatus } from "@/lib/customer-order-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tableSlug = new URL(request.url).searchParams.get("tableSlug") ??
    new URL(request.url).searchParams.get("table") ??
    "";

  if (!tableSlug) {
    return NextResponse.json({ ok: false, error: "Table is required" }, { status: 400 });
  }

  const result = await getCustomerSessionStatus(tableSlug);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
