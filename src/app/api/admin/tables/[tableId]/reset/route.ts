import { NextResponse } from "next/server";
import { adminResetTable } from "@/features/customer-order/customer-session-admin.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const { tableId } = await params;
  const result = await adminResetTable(tableId);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
