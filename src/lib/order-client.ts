import type { OrderMutationResult } from "@/lib/order-mutations";

export type AddItemPayload = {
  productId: string;
  quantity: number;
  kitchenNotes?: string;
  notes?: string;
  variantId?: string | null;
  modifierIds?: string[];
};

export type UpdateItemConfigPayload = {
  itemId: string;
  variantId?: string | null;
  modifierIds?: string[];
  quantity?: number;
  notes?: string;
  kitchenNotes?: string;
};

async function postOrderAction(
  basePath: string,
  sessionId: string,
  body: Record<string, unknown>
): Promise<OrderMutationResult> {
  const res = await fetch(`${basePath}/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as OrderMutationResult;
  if (!res.ok && "error" in data) return data;
  if (!res.ok) return { ok: false, error: "Request failed" };
  return data;
}

export function createStaffOrderClient(sessionId: string) {
  return {
    addItem: (payload: AddItemPayload) =>
      postOrderAction("/api/staff/orders", sessionId, { action: "addItem", ...payload }),
    updateItemConfig: (payload: UpdateItemConfigPayload) =>
      postOrderAction("/api/staff/orders", sessionId, { action: "updateItemConfig", ...payload }),
    updateQty: (itemId: string, quantity: number) =>
      postOrderAction("/api/staff/orders", sessionId, {
        action: "updateQty",
        itemId,
        quantity,
      }),
    removeItem: (itemId: string) =>
      postOrderAction("/api/staff/orders", sessionId, { action: "removeItem", itemId }),
    submitKitchen: () =>
      postOrderAction("/api/staff/orders", sessionId, { action: "submitKitchen" }),
    requestBill: () =>
      postOrderAction("/api/staff/orders", sessionId, { action: "requestBill" }),
    closeSession: () =>
      postOrderAction("/api/staff/orders", sessionId, { action: "closeSession" }),
  };
}

export function createAdminOrderClient(sessionId: string) {
  return {
    addItem: (payload: AddItemPayload) =>
      postOrderAction("/api/admin/orders", sessionId, { action: "addItem", ...payload }),
    updateItemConfig: (payload: UpdateItemConfigPayload) =>
      postOrderAction("/api/admin/orders", sessionId, { action: "updateItemConfig", ...payload }),
    updateQty: (itemId: string, quantity: number) =>
      postOrderAction("/api/admin/orders", sessionId, {
        action: "updateQty",
        itemId,
        quantity,
      }),
    removeItem: (itemId: string) =>
      postOrderAction("/api/admin/orders", sessionId, { action: "removeItem", itemId }),
    submitKitchen: () =>
      postOrderAction("/api/admin/orders", sessionId, { action: "submitKitchen" }),
    requestBill: () =>
      postOrderAction("/api/admin/orders", sessionId, { action: "requestBill" }),
    closeSession: () =>
      postOrderAction("/api/admin/orders", sessionId, { action: "closeSession" }),
  };
}
