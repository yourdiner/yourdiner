import type { KitchenMutationResult } from "@/features/fulfillment/kitchen-mutations";

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

export async function fetchKitchenQueue(): Promise<
  { ok: true; data: import("@/features/fulfillment/fulfillment-queries").SerializedKitchenTicket[] } | { ok: false; error: string }
> {
  const res = await fetch("/api/admin/kitchen", { cache: "no-store" });
  const text = await res.text();
  try {
    const body = JSON.parse(text) as {
      ok: boolean;
      data?: import("@/features/fulfillment/fulfillment-queries").SerializedKitchenTicket[];
      error?: string;
    };
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error ?? `Request failed (${res.status})` };
    }
    return { ok: true, data: body.data ?? [] };
  } catch {
    return { ok: false, error: text.slice(0, 200) || `Request failed (${res.status})` };
  }
}
