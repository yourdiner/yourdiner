import { NextResponse } from "next/server";
import { destroyStaffSession } from "@/lib/staff-session";

export const runtime = "nodejs";

export async function POST() {
  await destroyStaffSession();
  return NextResponse.json({ ok: true });
}
