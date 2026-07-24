import type { KitchenMutationResult } from "@/features/fulfillment/kitchen-mutations";
import type { SerializedKitchenTicket } from "@/features/fulfillment/fulfillment-queries";
import type { SerializedKitchenItem } from "@/features/fulfillment/kitchen-item.service";

async function parseJsonResponse(text: string, status: number): Promise<KitchenMutationResult> {
  try {
    return JSON.parse(text) as KitchenMutationResult;
  } catch {
    return {
      ok: false,
      error: text.slice(0, 200) || `Request failed (${status})`,
    };
  }
}

export async function updateKitchenOrderStatusClient(
  kitchenOrderId: string,
  status: "COOKING" | "READY"
): Promise<KitchenMutationResult> {
  const res = await fetch(`/api/admin/kitchen/${kitchenOrderId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const text = await res.text();
  const data = await parseJsonResponse(text, res.status);
  if (!res.ok && data.ok !== false) {
    return { ok: false, error: `Request failed (${res.status})` };
  }
  return data;
}

export async function updateKitchenItemStatusClient(
  orderItemId: string,
  status: "PREPARING" | "READY" | "SERVED"
): Promise<KitchenMutationResult> {
  const res = await fetch(`/api/admin/kitchen/items/${orderItemId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const text = await res.text();
  const data = await parseJsonResponse(text, res.status);
  if (!res.ok && data.ok !== false) {
    return { ok: false, error: `Request failed (${res.status})` };
  }
  return data;
}

export type KitchenQueueResponse =
  | {
      ok: true;
      data: SerializedKitchenTicket[];
      items: SerializedKitchenItem[];
      clearedIds: string[];
      serverTime: string;
    }
  | { ok: false; error: string };

export async function fetchKitchenQueue(since?: string): Promise<KitchenQueueResponse> {
  const url = since
    ? `/api/admin/kitchen?since=${encodeURIComponent(since)}`
    : "/api/admin/kitchen";
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  try {
    const body = JSON.parse(text) as {
      ok: boolean;
      data?: SerializedKitchenTicket[];
      items?: SerializedKitchenItem[];
      clearedIds?: string[];
      serverTime?: string;
      error?: string;
    };
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error ?? `Request failed (${res.status})` };
    }
    return {
      ok: true,
      data: body.data ?? [],
      items: body.items ?? [],
      clearedIds: body.clearedIds ?? [],
      serverTime: body.serverTime ?? new Date().toISOString(),
    };
  } catch {
    return { ok: false, error: text.slice(0, 200) || `Request failed (${res.status})` };
  }
}
