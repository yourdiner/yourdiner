import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createTableService,
  updateTableService,
  deleteTableService,
  getNextTableNumberService,
} from "@/lib/table-service";
import { withSubscriptionGuard } from "@/lib/subscription/api-guard";

export const runtime = "nodejs";

function revalidateTables() {
  revalidatePath("/admin/tables");
  revalidatePath("/dashboard/tables");
}

export const GET = withSubscriptionGuard(
  async (_request, _context) => {
    const result = await getNextTableNumberService();
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  },
  { feature: "tables" }
);

export const POST = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = await request.json();
    const result = await createTableService(body);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    revalidateTables();
    return NextResponse.json(result);
  },
  { feature: "tables" }
);

export const PATCH = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const body = (await request.json()) as { id: string; data: unknown };
    const result = await updateTableService(body.id, body.data);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    revalidateTables();
    return NextResponse.json(result);
  },
  { feature: "tables" }
);

export const DELETE = withSubscriptionGuard(
  async (request: NextRequest, _context) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    const result = await deleteTableService(id);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    revalidateTables();
    return NextResponse.json(result);
  },
  { feature: "tables" }
);
