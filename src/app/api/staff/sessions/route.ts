import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireStaffTenantSession } from "@/lib/staff-session";
import { requirePlanFeature } from "@/lib/permissions";
import { requireOrderActor } from "@/features/dining-session/auth";
import { startDiningSessionService } from "@/features/dining-session/session.service";
import { lookupCustomerByPhone } from "@/features/dining-session/customer.service";

export const runtime = "nodejs";

function revalidateDining(sessionId?: string) {
  revalidatePath("/staff/floor");
  revalidatePath("/staff/session/new");
  revalidatePath("/admin/live-floor");
  revalidatePath("/admin/orders");
  if (sessionId) {
    revalidatePath(`/staff/order/${sessionId}`);
    revalidatePath(`/admin/orders/${sessionId}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staffSession, tenant } = await requireStaffTenantSession();
    await requirePlanFeature(tenant.restaurantId, "waiter_ordering");
    const actor = await requireOrderActor();

    const input = (await request.json()) as {
      tableId: string;
      guestCount: number;
      customerPhone?: string;
      customerName?: string;
      notes?: string;
      reservationOverrideAcknowledged?: boolean;
    };

    const normalizedPhone = input.customerPhone?.replace(/\D/g, "").slice(-10) ?? "";
    if (normalizedPhone.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Customer phone is required (10 digits)" },
        { status: 400 }
      );
    }

    const session = await startDiningSessionService({
      restaurantId: tenant.restaurantId,
      staffId: staffSession.staffId,
      tableId: input.tableId,
      guestCount: input.guestCount,
      customerPhone: normalizedPhone,
      customerName: input.customerName,
      notes: input.notes,
      reservationOverrideAcknowledged: input.reservationOverrideAcknowledged,
      actor,
    });

    revalidateDining(session.id);
    return NextResponse.json({ ok: true, session: { id: session.id } });
  } catch (error) {
    const { startSessionFailureFromError } = await import(
      "@/features/reservations/start-session-result"
    );
    const failure = startSessionFailureFromError(error);
    return NextResponse.json(failure, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { tenant } = await requireStaffTenantSession();
    const phone = new URL(request.url).searchParams.get("phone");
    if (!phone) return NextResponse.json(null);
    const customer = await lookupCustomerByPhone(tenant.restaurantId, phone);
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json(null);
  }
}
