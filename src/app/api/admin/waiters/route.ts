import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createWaiterService,
  updateWaiterService,
  deactivateWaiterService,
} from "@/lib/waiter-service";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

function revalidateWaiters() {
  revalidatePath("/admin/waiters");
  revalidatePath("/dashboard/waiters");
}

export const POST = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = await request.json();
    const result = await createWaiterService(body);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    revalidateWaiters();
    return NextResponse.json(result);
  },
  { feature: "staff" }
);

export const PATCH = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = (await request.json()) as { id: string; data: unknown };
    const result = await updateWaiterService(body.id, body.data);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    revalidateWaiters();
    return NextResponse.json(result);
  },
  { feature: "staff" }
);

export const DELETE = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    const result = await deactivateWaiterService(id);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    revalidateWaiters();
    return NextResponse.json(result);
  },
  { feature: "staff" }
);
