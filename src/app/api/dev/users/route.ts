import { NextResponse } from "next/server";
import { isDevAuthEnabled, getDevUsers } from "@/lib/dev-auth";

export const runtime = "nodejs";

export async function GET() {
  if (!isDevAuthEnabled()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const users = await getDevUsers();
  return NextResponse.json({ users });
}
