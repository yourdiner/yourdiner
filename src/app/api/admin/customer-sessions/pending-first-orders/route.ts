import { NextResponse } from "next/server";
import { adminListPendingFirstOrders } from "@/features/customer-order/customer-session-admin.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const orders = await adminListPendingFirstOrders();
    return NextResponse.json({ ok: true, data: orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load orders";
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }
}
