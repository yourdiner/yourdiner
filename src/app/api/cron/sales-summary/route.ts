import { NextRequest, NextResponse } from "next/server";
import { syncDailySalesSummaries } from "@/features/analytics/daily-sales-summary.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lookbackDays = Number(request.nextUrl.searchParams.get("lookbackDays") ?? "2");
  const safeLookback = Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : 2;

  const result = await syncDailySalesSummaries({ lookbackDays: safeLookback });
  return NextResponse.json({ success: true, ...result });
}
