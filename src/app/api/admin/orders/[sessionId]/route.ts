import { NextRequest, NextResponse } from "next/server";
import { runAdminOrderMutation, type AdminOrderAction } from "@/lib/order-mutations";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = (await request.json()) as AdminOrderAction;
  const result = await runAdminOrderMutation(sessionId, body);
  const status = result.ok ? 200 : result.error === "Unauthorized" ? 401 : 400;
  return NextResponse.json(result, { status });
}
