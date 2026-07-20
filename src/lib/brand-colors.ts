/** Ethos design-system greens used across admin + public surfaces. */
export const BRAND_PRIMARY_GREEN = "#425646";
export const BRAND_SECONDARY = "#8d4c40";
export const BRAND_ACCENT_GREEN = "#d2e8d3";
export const BRAND_PRIMARY_CONTAINER = "#5a6e5d";

/** Legacy prisma / seed defaults that looked almost black on the menu. */
const LEGACY_PRIMARY = new Set(["#1a1a2e", "#1A1A2E"]);
const LEGACY_SECONDARY = new Set(["#16213e", "#16213E"]);
const LEGACY_ACCENT = new Set(["#e94560", "#E94560"]);

export function normalizeBrandPrimary(color: string | null | undefined): string {
  if (!color || LEGACY_PRIMARY.has(color)) return BRAND_PRIMARY_GREEN;
  return color;
}

export function normalizeBrandSecondary(color: string | null | undefined): string {
  if (!color || LEGACY_SECONDARY.has(color)) return BRAND_SECONDARY;
  return color;
}

export function normalizeBrandAccent(color: string | null | undefined): string {
  if (!color || LEGACY_ACCENT.has(color)) return BRAND_ACCENT_GREEN;
  return color;
}
