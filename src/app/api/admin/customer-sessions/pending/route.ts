import { NextResponse } from "next/server";
import { adminListPendingCustomerSessions } from "@/features/customer-order/customer-session-admin.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await adminListPendingCustomerSessions();
    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sessions";
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }
}
