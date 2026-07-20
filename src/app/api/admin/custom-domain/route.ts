import { NextRequest, NextResponse } from "next/server";
import {
  clearCustomDomainService,
  saveCustomDomainService,
  verifyCustomDomainService,
} from "@/lib/custom-domain.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    domain?: string;
  };

  if (body.action === "clear") {
    const result = await clearCustomDomainService();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (body.action === "verify") {
    const result = await verifyCustomDomainService();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (!body.domain) {
    return NextResponse.json({ ok: false, error: "Domain is required" }, { status: 400 });
  }

  const result = await saveCustomDomainService(body.domain);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
