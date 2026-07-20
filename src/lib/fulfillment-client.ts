import type { FulfillmentOrderAction } from "@/features/fulfillment/fulfillment-mutations";
import type {
  FulfillmentCreateResult,
  FulfillmentMutationResult,
} from "@/features/fulfillment/fulfillment-mutations";

export type FulfillmentAddItemPayload = {
  productId: string;
  quantity: number;
  kitchenNotes?: string;
  notes?: string;
  variantId?: string | null;
  modifierIds?: string[];
};

export type FulfillmentUpdateItemConfigPayload = {
  itemId: string;
  variantId?: string | null;
  modifierIds?: string[];
  quantity?: number;
  notes?: string;
  kitchenNotes?: string;
};

async function parseJsonResponse<T>(res: Response): Promise<T | { ok: false; error: string }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      ok: false,
      error: text.slice(0, 200) || `Request failed (${res.status})`,
    };
  }
}

async function postFulfillmentAction(
  orderId: string,
  body: Record<string, unknown>
): Promise<FulfillmentMutationResult> {
  const res = await fetch(`/api/admin/fulfillment-orders/${orderId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse<FulfillmentMutationResult>(res);
  if ("error" in data && data.ok === false) return data;
  if (!res.ok) return { ok: false, error: "Request failed" };
  return data as FulfillmentMutationResult;
}

async function postCreateFulfillmentOrder(
  body: Record<string, unknown>
): Promise<FulfillmentCreateResult> {
  const res = await fetch("/api/admin/fulfillment-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse<FulfillmentCreateResult>(res);
  if ("error" in data && data.ok === false) return data;
  if (!res.ok) return { ok: false, error: "Request failed" };
  return data as FulfillmentCreateResult;
}

export function createFulfillmentOrderClient(orderId: string) {
  return {
    addItem: (payload: FulfillmentAddItemPayload) =>
      postFulfillmentAction(orderId, { action: "addItem", ...payload }),
    updateItemConfig: (payload: FulfillmentUpdateItemConfigPayload) =>
      postFulfillmentAction(orderId, { action: "updateItemConfig", ...payload }),
    updateQty: (itemId: string, quantity: number) =>
      postFulfillmentAction(orderId, { action: "updateQty", itemId, quantity }),
    removeItem: (itemId: string) =>
      postFulfillmentAction(orderId, { action: "removeItem", itemId }),
    submitKitchen: () => postFulfillmentAction(orderId, { action: "submitKitchen" }),
    markReady: () => postFulfillmentAction(orderId, { action: "markReady" }),
    markPickedUp: () => postFulfillmentAction(orderId, { action: "markPickedUp" }),
    markOutForDelivery: () =>
      postFulfillmentAction(orderId, { action: "markOutForDelivery" }),
    markDelivered: () => postFulfillmentAction(orderId, { action: "markDelivered" }),
    recordPayment: (
      amount: number,
      method: "CASH" | "CARD" | "UPI" | "OTHER",
      notes?: string
    ) => postFulfillmentAction(orderId, { action: "recordPayment", amount, method, notes }),
    complete: () => postFulfillmentAction(orderId, { action: "complete" }),
    cancel: () => postFulfillmentAction(orderId, { action: "cancel" }),
  };
}

export async function createTakeawayOrderClient(input: {
  phone: string;
  name: string;
  pickupTime?: string | null;
  notes?: string;
}): Promise<FulfillmentCreateResult> {
  return postCreateFulfillmentOrder({ type: "takeaway", ...input });
}

export async function createDeliveryOrderClient(input: {
  phone: string;
  name: string;
  address: string;
  landmark?: string;
  instructions?: string;
  deliveryCharges?: number;
  estimatedDeliveryAt?: string | null;
  deliveryPartner?: string;
  notes?: string;
}): Promise<FulfillmentCreateResult> {
  return postCreateFulfillmentOrder({ type: "delivery", ...input });
}

export type { FulfillmentOrderAction };
