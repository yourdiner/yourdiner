import { NextRequest, NextResponse } from "next/server";
import { runBillingSync } from "@/modules/subscription-engine/services/billing-sync.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBillingSync();
  return NextResponse.json({ success: true, ...result });
}
