import type { CustomerOrderAction } from "@/lib/customer-order-service";

type ApiResult<T = void> = { ok: true; data: T } | { ok: false; error: string; code?: string };

export type CustomerSessionStatus = {
  status: string;
  tableOccupied?: boolean;
  tableSessionId?: string | null;
  diningSessionId?: string | null;
  customerName?: string | null;
  firstOrderApprovedAt?: string | null;
};

async function parseJson<T>(res: Response): Promise<ApiResult<T>> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as ApiResult<T>;
    if (!res.ok && !("error" in data)) {
      return { ok: false, error: text.slice(0, 200) || "Request failed" };
    }
    return data;
  } catch {
    return { ok: false, error: text.slice(0, 200) || `Request failed (${res.status})` };
  }
}

export async function lookupCustomerForOrder(phone: string): Promise<{
  name: string;
} | null> {
  const res = await fetch(
    `/api/customer/customers/lookup?phone=${encodeURIComponent(phone)}`
  );
  if (!res.ok) return null;
  return res.json();
}

export async function fetchCustomerSessionStatus(tableSlug: string) {
  const res = await fetch(
    `/api/customer/sessions/status?tableSlug=${encodeURIComponent(tableSlug)}`
  );
  return parseJson<CustomerSessionStatus>(res);
}

export async function startCustomerSession(input: {
  tableSlug: string;
  phone: string;
  name: string;
  deviceId?: string;
}): Promise<
  ApiResult<{
    tableSessionId: string;
    status: string;
    customerName: string;
    diningSessionId?: string | null;
  }>
> {
  const res = await fetch("/api/customer/sessions/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function customerOrderMutation(
  diningSessionId: string,
  tableSlug: string,
  body: CustomerOrderAction
): Promise<ApiResult<{ awaitingApproval?: boolean }>> {
  const res = await fetch(`/api/customer/orders/${diningSessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, tableSlug }),
  });
  const result = await parseJson<{ awaitingApproval?: boolean }>(res);
  if (!result.ok && result.code === "SESSION_ENDED") {
    return { ok: false, error: result.error, code: result.code };
  }
  return result;
}

export async function fetchCustomerActiveOrder(diningSessionId: string) {
  const res = await fetch(`/api/customer/orders/${diningSessionId}`);
  return parseJson<{
    id: string;
    status: string;
    total: number;
    subtotal: number;
    discountAmount: number;
    items: Array<{
      id: string;
      productId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      kitchenStatus: string;
      variantId?: string | null;
      variantNameSnapshot?: string | null;
      modifiers?: unknown;
      notes?: string | null;
      kitchenNotes?: string | null;
    }>;
  } | null>(res);
}
