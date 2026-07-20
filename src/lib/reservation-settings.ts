import { getRestaurantSettingsCached } from "@/lib/request-cache";

export type ReservationIntervalMinutes = 15 | 30 | 60;

/** Controls walk-in seating when expected dining overlaps a future reservation. */
export type ReservationConflictPolicy = "BLOCK" | "WARN";

export type ReservationSettings = {
  enabled: boolean;
  averageDiningMinutes: number;
  holdTimeMinutes: number;
  cleaningBufferMinutes: number;
  autoMarkNoShow: boolean;
  autoReleaseOnNoShow: boolean;
  allowWalkInOverride: boolean;
  reservationIntervalMinutes: ReservationIntervalMinutes;
  reservationConflictPolicy: ReservationConflictPolicy;
};

export const DEFAULT_RESERVATION_SETTINGS: ReservationSettings = {
  enabled: true,
  averageDiningMinutes: 90,
  holdTimeMinutes: 30,
  cleaningBufferMinutes: 0,
  autoMarkNoShow: true,
  autoReleaseOnNoShow: true,
  allowWalkInOverride: true,
  reservationIntervalMinutes: 30,
  reservationConflictPolicy: "BLOCK",
};

function parseConflictPolicy(value: unknown): ReservationConflictPolicy {
  return value === "WARN" ? "WARN" : "BLOCK";
}

export function parseReservationSettings(
  raw: unknown,
  averageDiningMinutesFallback = 90
): ReservationSettings {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_RESERVATION_SETTINGS,
      averageDiningMinutes: averageDiningMinutesFallback,
    };
  }
  const o = raw as Record<string, unknown>;
  const interval = o.reservationIntervalMinutes;
  const validInterval: ReservationIntervalMinutes =
    interval === 15 || interval === 60 ? interval : 30;

  return {
    enabled: o.enabled !== false,
    averageDiningMinutes:
      typeof o.averageDiningMinutes === "number"
        ? o.averageDiningMinutes
        : averageDiningMinutesFallback,
    holdTimeMinutes:
      typeof o.holdTimeMinutes === "number" ? o.holdTimeMinutes : 30,
    cleaningBufferMinutes:
      typeof o.cleaningBufferMinutes === "number" ? o.cleaningBufferMinutes : 0,
    autoMarkNoShow: o.autoMarkNoShow !== false,
    autoReleaseOnNoShow: o.autoReleaseOnNoShow !== false,
    allowWalkInOverride: o.allowWalkInOverride !== false,
    reservationIntervalMinutes: validInterval,
    reservationConflictPolicy: parseConflictPolicy(o.reservationConflictPolicy),
  };
}

export async function getRestaurantReservationSettings(
  restaurantId: string
): Promise<ReservationSettings> {
  const settings = await getRestaurantSettingsCached(restaurantId);
  return parseReservationSettings(
    settings?.reservationSettings,
    settings?.averageDiningMinutes ?? 90
  );
}

export function snapToInterval(date: Date, intervalMinutes: number): Date {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const snapped = Math.round(minutes / intervalMinutes) * intervalMinutes;
  d.setMinutes(snapped, 0, 0);
  return d;
}

export function computeReservationWindow(
  reservedAt: Date,
  settings: ReservationSettings
): { expectedEndAt: Date; holdExpiresAt: Date } {
  const expectedEndAt = new Date(reservedAt);
  expectedEndAt.setMinutes(
    expectedEndAt.getMinutes() +
      settings.averageDiningMinutes +
      settings.cleaningBufferMinutes
  );

  const holdExpiresAt = new Date(reservedAt);
  holdExpiresAt.setMinutes(holdExpiresAt.getMinutes() + settings.holdTimeMinutes);

  return { expectedEndAt, holdExpiresAt };
}
