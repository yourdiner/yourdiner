export async function lookupStaffCustomer(phone: string) {
  const res = await fetch(`/api/staff/sessions?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function startStaffSession(input: {
  tableId: string;
  guestCount: number;
  customerPhone?: string;
  customerName?: string;
  notes?: string;
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
  const res = await fetch("/api/staff/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}
