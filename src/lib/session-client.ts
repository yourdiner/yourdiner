import type { SessionMutationResult, AdminSessionAction } from "@/lib/session-mutations";

async function postSessionAction(
  sessionId: string,
  body: AdminSessionAction
): Promise<SessionMutationResult> {
  const res = await fetch(`/api/admin/sessions/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    const data = JSON.parse(text) as SessionMutationResult;
    if (!res.ok && !("error" in data)) return { ok: false, error: "Request failed" };
    return data;
  } catch {
    return { ok: false, error: text.slice(0, 200) || `Request failed (${res.status})` };
  }
}

export function createAdminSessionClient(sessionId: string) {
  return {
    reassignWaiter: (waiterId: string | null) =>
      postSessionAction(sessionId, { action: "reassignWaiter", waiterId }),
    requestBill: () => postSessionAction(sessionId, { action: "requestBill" }),
    closeSession: () => postSessionAction(sessionId, { action: "closeSession" }),
    updateSession: (data: {
      customerPhone?: string;
      customerName?: string;
      guestCount?: number;
      notes?: string;
    }) => postSessionAction(sessionId, { action: "updateSession", data }),
    transferTable: (newTableId: string) =>
      postSessionAction(sessionId, { action: "transferTable", newTableId }),
    applyDiscount: (discountAmount: number) =>
      postSessionAction(sessionId, { action: "applyDiscount", discountAmount }),
    recordPayment: (amount: number, method: "CASH" | "CARD" | "UPI" | "OTHER") =>
      postSessionAction(sessionId, { action: "recordPayment", amount, method }),
    recordPaymentAndClose: (amount: number, method: "CASH" | "CARD" | "UPI" | "OTHER") =>
      postSessionAction(sessionId, { action: "recordPaymentAndClose", amount, method }),
    checkout: (data: {
      discountType: "PERCENT" | "FLAT" | "NONE";
      discountValue: number;
      loyaltyPointsRedeemed?: number;
      paymentMethod: "CASH" | "CARD" | "UPI" | "OTHER";
    }) => postSessionAction(sessionId, { action: "checkoutSession", data }),
  };
}

export async function startAdminSession(input: {
  tableId: string;
  guestCount: number;
  customerPhone?: string;
  customerName?: string;
  notes?: string;
  staffId?: string | null;
  reservationOverrideAcknowledged?: boolean;
}): Promise<
  | { ok: true; session: { id: string } }
  | {
      ok: false;
      error: string;
      code?: string;
      conflict?: import("@/features/reservations/reservation-conflict.service").ReservationConflictPayload;
    }
> {
  const res = await fetch("/api/admin/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as
    | { ok: true; session?: { id: string }; sessionId?: string }
    | {
        ok: false;
        error: string;
        code?: string;
        conflict?: import("@/features/reservations/reservation-conflict.service").ReservationConflictPayload;
      };
  if (!data.ok) return data;
  const id = data.session?.id ?? data.sessionId;
  if (!id) return { ok: false, error: "Session created but no ID returned" };
  return { ok: true, session: { id } };
}

export async function lookupAdminCustomer(phone: string) {
  const res = await fetch(`/api/admin/customers/lookup?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) return null;
  return res.json();
}
