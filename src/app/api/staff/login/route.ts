import { NextRequest, NextResponse } from "next/server";
import { verifyStaffPasswordLogin } from "@/lib/staff-login-service";
import { createStaffSession } from "@/lib/staff-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    mobile?: string;
    password?: string;
    pin?: string;
  };
  const mobile = body.mobile ?? "";
  // Accept legacy `pin` field during transition
  const password = body.password ?? body.pin ?? "";

  const result = await verifyStaffPasswordLogin(mobile, password);
  if (!result.ok) {
    return NextResponse.json(result, { status: 401 });
  }

  await createStaffSession(result.staffId);

  return NextResponse.json({
    ok: true,
    displayName: result.displayName,
    role: result.role,
    mustChangePassword: result.mustChangePassword,
  });
}
