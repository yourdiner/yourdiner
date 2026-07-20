import type { SerializedKitchenTicket } from "@/features/fulfillment/fulfillment-queries";

type FloorSession = {
  id: string;
  status: string;
  source?: string;
  guestCount: number;
  table: { id: string; number: number; name: string | null };
  staff: { id: string; displayName: string } | null;
  customer: { name: string; phone: string } | null;
  orders: { total: number; status: string }[];
  events?: { type: string; createdAt: Date | string }[];
};

async function parseJson<T>(res: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { ok: boolean; data?: T; error?: string };
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error ?? `Request failed (${res.status})` };
    }
    return { ok: true, data: body.data as T };
  } catch {
    return { ok: false, error: text.slice(0, 200) || `Request failed (${res.status})` };
  }
}

export async function fetchActiveFloorSessions() {
  const res = await fetch("/api/admin/floor/sessions", { cache: "no-store" });
  return parseJson<FloorSession[]>(res);
}

export async function fetchStaffFloorTables() {
  const res = await fetch("/api/staff/floor", { cache: "no-store" });
  return parseJson<Awaited<ReturnType<typeof import("@/features/floor/queries").getFloorTables>>>(res);
}

export type { FloorSession };
