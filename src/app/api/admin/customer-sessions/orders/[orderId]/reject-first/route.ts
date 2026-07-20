import { NextResponse } from "next/server";
import { adminRejectFirstOrder } from "@/features/customer-order/customer-session-admin.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const result = await adminRejectFirstOrder(orderId);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
