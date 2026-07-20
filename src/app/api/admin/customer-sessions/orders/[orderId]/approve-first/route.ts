import { NextResponse } from "next/server";
import { adminApproveFirstOrder } from "@/features/customer-order/customer-session-admin.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const result = await adminApproveFirstOrder(orderId);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
