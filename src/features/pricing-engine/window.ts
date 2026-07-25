/**
 * Restaurant-timezone window helpers for promotion activation.
 */

export type LocalClock = {
  /** Calendar date YYYY-MM-DD in restaurant TZ */
  dateKey: string;
  dayOfWeek: number; // 0=Sun .. 6=Sat
  minutesOfDay: number;
  instant: Date;
};

/** Parse HH:mm → minutes since midnight; null if invalid. */
export function parseHhMm(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function getLocalClock(now: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const weekday = get("weekday"); // Sun, Mon, ...

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dateKey: `${year}-${month}-${day}`,
    dayOfWeek: dayMap[weekday] ?? 0,
    minutesOfDay: hour * 60 + minute,
    instant: now,
  };
}

/** Inclusive date range check using restaurant-local calendar date. */
export function isDateInRange(
  dateKey: string,
  startDate: Date | null,
  endDate: Date | null,
  timeZone: string
): boolean {
  if (startDate) {
    const startKey = getLocalClock(startDate, timeZone).dateKey;
    if (dateKey < startKey) return false;
  }
  if (endDate) {
    const endKey = getLocalClock(endDate, timeZone).dateKey;
    if (dateKey > endKey) return false;
  }
  return true;
}

export function isDayAllowed(dayOfWeek: number, daysOfWeek: number[]): boolean {
  if (!daysOfWeek.length) return true;
  return daysOfWeek.includes(dayOfWeek);
}

/**
 * Time window. Supports overnight ranges (e.g. 22:00–02:00).
 * Empty start/end → always in time window.
 */
export function isTimeInRange(
  minutesOfDay: number,
  startTime: string | null,
  endTime: string | null
): boolean {
  const start = parseHhMm(startTime);
  const end = parseHhMm(endTime);
  if (start == null && end == null) return true;
  if (start != null && end == null) return minutesOfDay >= start;
  if (start == null && end != null) return minutesOfDay <= end;
  if (start! <= end!) {
    return minutesOfDay >= start! && minutesOfDay <= end!;
  }
  // overnight
  return minutesOfDay >= start! || minutesOfDay <= end!;
}

export function isPromotionWindowActive(
  promo: {
    startDate: Date | null;
    endDate: Date | null;
    startTime: string | null;
    endTime: string | null;
    daysOfWeek: number[];
  },
  clock: LocalClock,
  timeZone: string
): boolean {
  if (!isDateInRange(clock.dateKey, promo.startDate, promo.endDate, timeZone)) {
    return false;
  }
  if (!isDayAllowed(clock.dayOfWeek, promo.daysOfWeek)) return false;
  if (!isTimeInRange(clock.minutesOfDay, promo.startTime, promo.endTime)) {
    return false;
  }
  return true;
}
