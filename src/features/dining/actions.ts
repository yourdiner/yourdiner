"use server";

import { revalidatePath } from "next/cache";
import { requireStaffTenantSession } from "@/lib/staff-session";
import { requireTenantContext } from "@/lib/tenancy";
import { requireOrderActor } from "@/features/dining-session/auth";
import { actionOk, actionFail, type ActionResult } from "@/lib/action-result";
import {
  startDiningSessionService,
  requestBillService,
  closeDiningSessionService,
} from "@/features/dining-session/session.service";
import {
  addItemToOrderService,
  updateOrderItemQuantityService,
  removeOrderItemService,
  submitOrderToKitchenService,
  holdOrderService,
} from "@/features/dining-session/order.service";
import { lookupCustomerByPhone as lookupCustomerByPhoneService } from "@/features/dining-session/customer.service";

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

export async function lookupCustomerByPhone(phone: string) {
  try {
    const { tenant } = await requireStaffTenantSession();
    return lookupCustomerByPhoneService(tenant.restaurantId, phone);
  } catch {
    return null;
  }
}

export type StartDiningSessionResult =
  | { ok: true; session: { id: string } }
  | {
      ok: false;
      error: string;
      code?: string;
      conflict?: import("@/features/reservations/reservation-conflict.service").ReservationConflictPayload;
    };

export async function startDiningSession(input: {
  tableId: string;
  guestCount: number;
  customerPhone?: string;
  customerName?: string;
  notes?: string;
  reservationOverrideAcknowledged?: boolean;
}): Promise<StartDiningSessionResult> {
  try {
    const { staffSession, tenant } = await requireStaffTenantSession();
    const actor = await requireOrderActor();

    const normalizedPhone = input.customerPhone?.replace(/\D/g, "").slice(-10) ?? "";
    if (normalizedPhone.length < 10) {
      return { ok: false, error: "Customer phone is required (10 digits)" };
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
    return { ok: true, session: { id: session.id } };
  } catch (error) {
    const { startSessionFailureFromError } = await import(
      "@/features/reservations/start-session-result"
    );
    return startSessionFailureFromError(error);
  }
}

export async function requestBill(sessionId: string): Promise<ActionResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireOrderActor();
    await requestBillService(sessionId, tenant.restaurantId, actor);
    revalidateDining(sessionId);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function closeDiningSession(sessionId: string): Promise<ActionResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireOrderActor();
    await closeDiningSessionService(sessionId, tenant.restaurantId, actor);
    revalidateDining(sessionId);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function addItemToOrder(
  sessionId: string,
  productId: string,
  quantity: number,
  kitchenNotes?: string,
  variantId?: string
): Promise<ActionResult> {
  try {
    const { staffSession, tenant } = await requireStaffTenantSession();
    const actor = await requireOrderActor();

    await addItemToOrderService(sessionId, tenant.restaurantId, productId, quantity, actor, {
      kitchenNotes,
      staffId: staffSession.staffId,
      variantId,
    });
    revalidateDining(sessionId);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function updateOrderItemQuantity(
  sessionId: string,
  itemId: string,
  quantity: number
): Promise<ActionResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireOrderActor();
    await updateOrderItemQuantityService(sessionId, tenant.restaurantId, itemId, quantity, actor);
    revalidateDining(sessionId);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function removeOrderItem(sessionId: string, itemId: string): Promise<ActionResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireOrderActor();
    await removeOrderItemService(sessionId, tenant.restaurantId, itemId, actor);
    revalidateDining(sessionId);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function submitOrderToKitchen(sessionId: string): Promise<ActionResult> {
  try {
    const { staffSession, tenant } = await requireStaffTenantSession();
    const actor = await requireOrderActor();
    await submitOrderToKitchenService(
      sessionId,
      tenant.restaurantId,
      actor,
      staffSession.staffId
    );
    revalidateDining(sessionId);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function holdOrder(sessionId: string): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffTenantSession();
    await holdOrderService(sessionId, tenant.restaurantId);
    revalidateDining(sessionId);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}
