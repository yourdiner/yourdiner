import { NextResponse } from "next/server";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { prisma } from "@/lib/db";
import { restaurantHasCustomerQrOrdering } from "@/lib/customer-order-service";
import { AppError } from "@/lib/errors";
import { buildCustomerTableUrlForRestaurant } from "@/lib/table-qr";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  return GET(_request, { params });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

    const orderingAllowed = await restaurantHasCustomerQrOrdering(tenant.restaurantId);
    if (!orderingAllowed) {
      throw new AppError(
        "Table QR codes require a plan with customer QR ordering",
        "FEATURE_LOCKED",
        403
      );
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurantId: tenant.restaurantId, isActive: true },
      select: { qrSlug: true },
    });
    if (!table) {
      throw new AppError("Table not found", "NOT_FOUND", 404);
    }

    const url = buildCustomerTableUrlForRestaurant(tenant, table.qrSlug);

    return NextResponse.json({
      ok: true,
      data: {
        url,
        qrSlug: table.qrSlug,
        permanent: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get QR URL";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
