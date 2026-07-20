import { NextResponse } from "next/server";
import { adminApproveCustomerSession } from "@/features/customer-order/customer-session-admin.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const result = await adminApproveCustomerSession(sessionId);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
