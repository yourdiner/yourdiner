type ApiResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

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

export type PendingCustomerSession = {
  id: string;
  createdAt: string;
  customer: { id: string; name: string; phone: string } | null;
  table: { id: string; number: number; name: string | null; qrSlug: string };
};

export type PendingFirstOrder = {
  id: string;
  total: number;
  items: { id: string; quantity: number; name: string }[];
  diningSession: {
    customer: { name: string; phone: string } | null;
    table: { number: number; name: string | null };
  };
};

export async function fetchPendingCustomerSessions() {
  const res = await fetch("/api/admin/customer-sessions/pending", { cache: "no-store" });
  return parseJson<PendingCustomerSession[]>(res);
}

export async function approveCustomerSession(sessionId: string) {
  const res = await fetch(`/api/admin/customer-sessions/${sessionId}/approve`, {
    method: "POST",
  });
  return parseJson(res);
}

export async function rejectCustomerSession(sessionId: string) {
  const res = await fetch(`/api/admin/customer-sessions/${sessionId}/reject`, {
    method: "POST",
  });
  return parseJson(res);
}

export async function fetchPendingFirstOrders() {
  const res = await fetch("/api/admin/customer-sessions/pending-first-orders", {
    cache: "no-store",
  });
  return parseJson<PendingFirstOrder[]>(res);
}

export async function approveFirstOrder(orderId: string) {
  const res = await fetch(`/api/admin/customer-sessions/orders/${orderId}/approve-first`, {
    method: "POST",
  });
  return parseJson(res);
}

export async function rejectFirstOrder(orderId: string) {
  const res = await fetch(`/api/admin/customer-sessions/orders/${orderId}/reject-first`, {
    method: "POST",
  });
  return parseJson(res);
}
