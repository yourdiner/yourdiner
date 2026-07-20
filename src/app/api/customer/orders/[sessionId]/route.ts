import { NextRequest, NextResponse } from "next/server";
import {
  runCustomerOrderMutation,
  type CustomerOrderAction,
} from "@/lib/customer-order-service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = (await request.json()) as CustomerOrderAction & {
    tableSlug?: string;
    tableToken?: string;
  };
  const tableSlug = body.tableSlug ?? body.tableToken ?? "";
  const { tableSlug: _s, tableToken: _t, ...action } = body;

  if (!tableSlug) {
    return NextResponse.json({ ok: false, error: "Missing table", code: "VALIDATION" }, { status: 400 });
  }

  const result = await runCustomerOrderMutation(sessionId, tableSlug, action);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
