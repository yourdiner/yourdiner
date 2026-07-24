/** Premium SaaS landing tokens — light canvas, forest-teal accent (not black). */

export const EASE_OUT_STRONG = [0.23, 1, 0.32, 1] as const;
export const EASE_ISLAND = [0.32, 0.72, 0, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

export const LANDING = {
  bg: {
    page: "#f7f8f6",
    canvas: "#ffffff",
    mist: "#eef2ef",
    band: "#0f3d36",
  },
  text: {
    primary: "#14201c",
    secondary: "#5c6b64",
    muted: "#7a8a82",
    onBand: "#ecf4f1",
  },
  /** Forest teal — calm ops, high contrast CTAs */
  accent: "#0f766e",
  accentStrong: "#0d9488",
  accentSoft: "rgba(15, 118, 110, 0.12)",
  accentGlow: "rgba(15, 118, 110, 0.22)",
  glass: {
    border: "rgba(20, 32, 28, 0.08)",
    fill: "rgba(255, 255, 255, 0.72)",
    highlight: "rgba(255, 255, 255, 0.9)",
  },
  radius: {
    shell: "1.25rem",
    inner: "calc(1.25rem - 0.25rem)",
    pill: "9999px",
  },
  space: {
    sectionY: "py-16 sm:py-24 lg:py-32",
    sectionX: "px-5 sm:px-6 lg:px-8",
  },
} as const;
