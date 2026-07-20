import { NextRequest, NextResponse } from "next/server";
import { expireInactiveTableSessions } from "@/lib/table-sessions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await expireInactiveTableSessions();
  return NextResponse.json({ success: true, ...result });
}
