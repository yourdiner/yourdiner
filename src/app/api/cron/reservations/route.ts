import { NextRequest, NextResponse } from "next/server";
import { runReservationScheduler } from "@/features/reservations/scheduler.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReservationScheduler();
  return NextResponse.json({ success: true, ...result });
}
