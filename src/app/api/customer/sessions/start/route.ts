import { NextRequest, NextResponse } from "next/server";
import { startCustomerSessionFromTableSlug } from "@/lib/customer-order-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    tableSlug?: string;
    tableToken?: string;
    phone: string;
    name: string;
    deviceId?: string;
  };

  const tableSlug = body.tableSlug ?? body.tableToken;
  if (!tableSlug) {
    return NextResponse.json({ ok: false, error: "Table is required" }, { status: 400 });
  }

  const result = await startCustomerSessionFromTableSlug({
    tableSlug,
    phone: body.phone,
    name: body.name,
    deviceId: body.deviceId,
  });

  const status = result.ok ? 200 : result.code === "TABLE_HAS_ACTIVE_SESSION" ? 409 : 400;
  return NextResponse.json(result, { status });
}
