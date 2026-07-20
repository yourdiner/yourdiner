import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Stored amounts in the DB are in paise (1 ₹ = 100 paise). */
export function paiseToRupees(amountInPaise: number): number {
  return amountInPaise / 100;
}

export function rupeesToPaise(amountInRupees: number): number {
  return Math.round(amountInRupees * 100);
}

export function formatCurrency(amountInPaise: number, currency = "INR"): string {
  const amount = paiseToRupees(amountInPaise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Deterministic date/time formatting.
 *
 * `toLocaleDateString()` / `toLocaleString()` without an explicit locale and
 * timeZone use the runtime's defaults, so Node (server) and the browser
 * (client) can produce different output — e.g. "7/8/2026" vs "8/7/2026" — which
 * breaks React hydration. These helpers pin the locale and timeZone so server
 * and client always render identical strings.
 */
const DISPLAY_LOCALE = "en-IN";
const DISPLAY_TIME_ZONE = "Asia/Kolkata";

function toValidDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: Date | string | number | null | undefined,
  fallback = "—"
): string {
  const date = toValidDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  fallback = "—"
): string {
  const date = toValidDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

export function formatTime(
  value: Date | string | number | null | undefined,
  fallback = "—"
): string {
  const date = toValidDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateSubdomain(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "")
    .slice(0, 32);
}
