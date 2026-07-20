import { NextRequest, NextResponse } from "next/server";
import { runAdminSessionMutation, type AdminSessionAction } from "@/lib/session-mutations";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = (await request.json()) as AdminSessionAction;
  const result = await runAdminSessionMutation(sessionId, body);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
