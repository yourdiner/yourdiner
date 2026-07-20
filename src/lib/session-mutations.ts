import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenancy";
import { requireAdminOrderActor } from "@/features/dining-session/auth";
import { getErrorMessage } from "@/lib/errors";
import { startSessionFailureFromError } from "@/features/reservations/start-session-result";
import {
  startDiningSessionService,
  requestBillService,
  closeDiningSessionService,
  reassignWaiterService,
  updateSessionCustomerService,
  transferTableService,
  recordSessionPayment,
  applyOrderDiscountService,
  checkoutSessionService,
} from "@/features/dining-session/session.service";
import { canApplyDiscount, canCloseSession, canOverrideTable } from "@/features/dining-session/permissions";
import { lookupCustomerByPhone } from "@/features/dining-session/customer.service";

export type SessionMutationResult =
  | { ok: true; sessionId?: string; warnings?: string[] }
  | {
      ok: false;
      error: string;
      code?: string;
      conflict?: import("@/features/reservations/reservation-conflict.service").ReservationConflictPayload;
    };

function revalidateSession(sessionId?: string) {
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/live-floor");
  revalidatePath("/staff/floor");
  if (sessionId) {
    revalidatePath(`/admin/orders/${sessionId}`);
    revalidatePath(`/admin/orders/${sessionId}/order`);
    revalidatePath(`/staff/order/${sessionId}`);
  }
}

export type AdminSessionAction =
  | { action: "reassignWaiter"; waiterId: string | null }
  | { action: "requestBill" }
  | { action: "closeSession" }
  | {
      action: "updateSession";
      data: { customerPhone?: string; customerName?: string; guestCount?: number; notes?: string };
    }
  | { action: "transferTable"; newTableId: string }
  | { action: "applyDiscount"; discountAmount: number }
  | { action: "recordPayment"; amount: number; method: "CASH" | "CARD" | "UPI" | "OTHER" }
  | {
      action: "recordPaymentAndClose";
      amount: number;
      method: "CASH" | "CARD" | "UPI" | "OTHER";
    }
  | {
      action: "checkoutSession";
      data: {
        discountType: "PERCENT" | "FLAT" | "NONE";
        discountValue: number;
        loyaltyPointsRedeemed?: number;
        paymentMethod: "CASH" | "CARD" | "UPI" | "OTHER";
      };
    };

export async function runAdminSessionMutation(
  sessionId: string,
  body: AdminSessionAction
): Promise<SessionMutationResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });

    switch (body.action) {
      case "reassignWaiter":
        await reassignWaiterService(sessionId, tenant.restaurantId, body.waiterId, actor);
        break;
      case "requestBill":
        await requestBillService(sessionId, tenant.restaurantId, actor);
        break;
      case "closeSession":
        await closeDiningSessionService(sessionId, tenant.restaurantId, actor);
        break;
      case "updateSession":
        await updateSessionCustomerService(sessionId, tenant.restaurantId, body.data, actor);
        break;
      case "transferTable":
        if (!canOverrideTable(actor)) return { ok: false, error: "Forbidden" };
        await transferTableService(sessionId, tenant.restaurantId, body.newTableId, actor);
        break;
      case "applyDiscount":
        if (!canApplyDiscount(actor)) return { ok: false, error: "Forbidden" };
        await applyOrderDiscountService(sessionId, tenant.restaurantId, body.discountAmount, actor);
        break;
      case "recordPayment":
        await recordSessionPayment(sessionId, tenant.restaurantId, body.amount, body.method, actor);
        break;
      case "recordPaymentAndClose":
        await recordSessionPayment(sessionId, tenant.restaurantId, body.amount, body.method, actor);
        await closeDiningSessionService(sessionId, tenant.restaurantId, actor);
        break;
      case "checkoutSession": {
        if (!canCloseSession(actor)) return { ok: false, error: "Forbidden" };
        const hasDiscount =
          body.data.discountType !== "NONE" && body.data.discountValue > 0;
        if (hasDiscount && !canApplyDiscount(actor)) {
          return { ok: false, error: "You do not have permission to apply discounts" };
        }
        await checkoutSessionService(sessionId, tenant.restaurantId, actor, body.data);
        break;
      }
      default:
        return { ok: false, error: "Unknown action" };
    }

    revalidateSession(sessionId);
    return { ok: true, sessionId };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function startAdminSession(input: {
  tableId: string;
  guestCount: number;
  customerPhone?: string;
  customerName?: string;
  notes?: string;
  staffId?: string | null;
  reservationOverrideAcknowledged?: boolean;
}): Promise<SessionMutationResult & { session?: { id: string } }> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });

    const session = await startDiningSessionService({
      restaurantId: tenant.restaurantId,
      ...input,
      actor,
    });

    revalidateSession(session.id);
    return { ok: true, sessionId: session.id, session: { id: session.id } };
  } catch (error) {
    return startSessionFailureFromError(error);
  }
}

export async function lookupAdminCustomer(phone: string) {
  try {
    const tenant = await requireTenantContext();
    await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER"] });
    return lookupCustomerByPhone(tenant.restaurantId, phone);
  } catch {
    return null;
  }
}
