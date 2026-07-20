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

export type SuggestedTable = {
  id: string;
  name: string;
  number: number;
  capacity: number;
} | null;

export async function createReservationApi(body: unknown) {
  const res = await fetch("/api/admin/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function suggestTableApi(input: { reservedAt: string; guestCount: number }) {
  const res = await fetch("/api/admin/reservations/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<SuggestedTable>(res);
}

export type ReservationDetail = {
  id: string;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  reservedAt: string;
  status: string;
  source: string;
  specialRequest: string | null;
  diningSessionId: string | null;
  table: { id: string; name: string; number: number } | null;
  events: Array<{ id: string; type: string; message: string; createdAt: string }>;
};

export async function getReservationDetailApi(reservationId: string) {
  const res = await fetch(`/api/admin/reservations/${reservationId}`, { cache: "no-store" });
  return parseJson<ReservationDetail>(res);
}

export async function reservationActionApi(
  reservationId: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`/api/admin/reservations/${reservationId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function reservationMutateApi(
  reservationId: string,
  action: "confirm" | "cancel" | "checkIn" | "noShow",
  extra?: { staffId?: string }
) {
  return reservationActionApi(reservationId, { action, ...extra });
}

export async function getReservationConflictsApi(tableId: string, at?: string) {
  const params = new URLSearchParams({ tableId });
  if (at) params.set("at", at);
  const res = await fetch(`/api/admin/reservations/conflicts?${params}`);
  return parseJson<{ warning: string | null }>(res);
}

export async function updateReservationApi(reservationId: string, body: unknown) {
  const res = await fetch(`/api/admin/reservations/${reservationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}
