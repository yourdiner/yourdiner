import { prisma } from "@/lib/db";
import { ReservationStatus } from "@prisma/client";

const EARLY_CHECK_IN_MS = 2 * 60 * 60 * 1000;

export const CUSTOMER_QR_RESERVATION_BLOCKED_MESSAGE =
  "This table already has an active reservation. Please contact the restaurant staff.";

export type CustomerCheckInReservation = {
  id: string;
  guestName: string;
  guestCount: number;
  guestPhone: string;
  reservedAt: Date;
  holdExpiresAt: Date;
};

export function normalizeGuestPhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/** Eligible when reservedAt - 2h <= now < holdExpiresAt */
export function isWithinCustomerQrCheckInWindow(
  reservedAt: Date,
  holdExpiresAt: Date,
  now: Date
): boolean {
  const t = now.getTime();
  const earliest = reservedAt.getTime() - EARLY_CHECK_IN_MS;
  return t >= earliest && t < holdExpiresAt.getTime();
}

/**
 * Find a CONFIRMED reservation for this table whose guest phone matches,
 * within the early/hold check-in window for customer QR.
 */
export async function findCustomerCheckInReservation(input: {
  restaurantId: string;
  tableId: string;
  phone: string;
  now?: Date;
}): Promise<CustomerCheckInReservation | null> {
  const now = input.now ?? new Date();
  const normalizedPhone = normalizeGuestPhone(input.phone);
  if (normalizedPhone.length < 10) return null;

  const candidates = await prisma.reservation.findMany({
    where: {
      restaurantId: input.restaurantId,
      tableId: input.tableId,
      status: ReservationStatus.CONFIRMED,
    },
    select: {
      id: true,
      guestName: true,
      guestCount: true,
      guestPhone: true,
      reservedAt: true,
      holdExpiresAt: true,
    },
    orderBy: { reservedAt: "asc" },
  });

  for (const reservation of candidates) {
    if (normalizeGuestPhone(reservation.guestPhone) !== normalizedPhone) {
      continue;
    }
    if (
      !isWithinCustomerQrCheckInWindow(
        reservation.reservedAt,
        reservation.holdExpiresAt,
        now
      )
    ) {
      continue;
    }
    return reservation;
  }

  return null;
}
